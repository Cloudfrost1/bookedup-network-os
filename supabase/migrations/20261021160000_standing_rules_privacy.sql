-- Platform rules: separated standing (membership / referral partner / provider verification / eligibility),
-- validated capacity and documents, required referral scope, masked directory contacts.

-- ---------------------------------------------------------------- 1. standing + eligibility
create or replace function app_private.doc_state(p_org uuid, p_kinds text[])
returns text language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.professional_documents d where d.org_id = p_org and d.kind::text = any(p_kinds)
                 and d.status = 'verified' and (d.expires_on is null or d.expires_on >= current_date)) then 'valid'
    when exists (select 1 from public.professional_documents d where d.org_id = p_org and d.kind::text = any(p_kinds)
                 and d.status = 'submitted' and (d.expires_on is null or d.expires_on >= current_date)) then 'in_review'
    when exists (select 1 from public.professional_documents d where d.org_id = p_org and d.kind::text = any(p_kinds)
                 and d.status = 'verified') then 'expired'
    when exists (select 1 from public.professional_documents d where d.org_id = p_org and d.kind::text = any(p_kinds)
                 and d.status = 'rejected') then 'rejected'
    else 'missing' end;
$$;

-- Everything that keeps a business from receiving projects, as stable codes (explained in the app).
create or replace function app_private.provider_blockers(p_org uuid)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare
  o record; cap record; b text[] := '{}'; lic text; ins text; rcv public.capability_status;
begin
  select status, deleted_at, available_for_referrals into o from public.organizations where id = p_org;
  if not found or o.deleted_at is not null then return array['membership_removed']; end if;
  if o.status <> 'approved' then b := b || ('membership_' || o.status::text); end if;

  select status into rcv from public.organization_capabilities where org_id = p_org and capability = 'receive';
  if rcv is null then b := b || 'receive_not_requested'::text;
  elsif rcv = 'requested' then b := b || 'receive_pending'::text;
  elsif rcv = 'revoked' then b := b || 'receive_revoked'::text; end if;

  lic := app_private.doc_state(p_org, array['contractor_license','business_license']);
  ins := app_private.doc_state(p_org, array['general_liability','workers_comp']);
  if lic <> 'valid' then b := b || ('license_' || lic); end if;
  if ins <> 'valid' then b := b || ('insurance_' || ins); end if;

  select * into cap from public.provider_capacity where org_id = p_org;
  if not found then b := b || 'capacity_missing'::text;
  else
    if cap.weekly_capacity is null or cap.min_project_value is null or cap.max_project_value is null or cap.lead_time_days is null then
      b := b || 'capacity_incomplete'::text; end if;
    if cap.confirmed_at < now() - interval '30 days' then b := b || 'capacity_stale'::text; end if;
    if not cap.accepting_new_work then b := b || 'paused'::text;
    elsif coalesce(cap.weekly_capacity, 0) = 0 then b := b || 'capacity_zero'::text; end if;
  end if;

  if not o.available_for_referrals then b := b || 'unavailable'::text; end if;
  if not exists (select 1 from public.organization_services s where s.org_id = p_org and s.kind = 'offered') then
    b := b || 'no_services'::text; end if;
  if not exists (select 1 from public.organization_service_areas a where a.org_id = p_org) then
    b := b || 'no_areas'::text; end if;
  return b;
end $$;

create or replace function public.org_standing(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  o record; ref public.capability_status; rcv public.capability_status; blockers text[];
  verification text;
begin
  if not (app_private.is_org_member(p_org) or app_private.is_platform_admin()) then
    raise exception 'Not allowed' using errcode = '42501'; end if;
  select status into o from public.organizations where id = p_org;
  select status into ref from public.organization_capabilities where org_id = p_org and capability = 'refer';
  select status into rcv from public.organization_capabilities where org_id = p_org and capability = 'receive';
  blockers := app_private.provider_blockers(p_org);
  verification := case
    when rcv is null then 'not_requested'
    when not (blockers && array['license_missing','license_expired','license_in_review','license_rejected',
                                'insurance_missing','insurance_expired','insurance_in_review','insurance_rejected',
                                'capacity_missing','capacity_incomplete','capacity_stale']) then 'complete'
    else 'incomplete' end;
  return jsonb_build_object(
    'membership', o.status,
    'refer', ref, 'receive', rcv,
    'referral_partner', case
       when ref is null then 'not_requested'
       when ref = 'approved' and o.status = 'approved' then 'active'
       when ref = 'revoked' or o.status in ('suspended','rejected') then 'inactive'
       else 'pending' end,
    'provider_verification', verification,
    'eligible_to_receive', rcv is not null and cardinality(blockers) = 0,
    'blockers', to_jsonb(case when rcv is null then array[]::text[] else blockers end),
    'license', app_private.doc_state(p_org, array['contractor_license','business_license']),
    'insurance', app_private.doc_state(p_org, array['general_liability','workers_comp']));
end $$;

-- Matching suggestions now carry eligibility; ineligible providers can't be sent a project.
create or replace function public.admin_match_suggestions_v3(p_referral uuid)
returns table (org_id uuid, name text, city text, docs_verified boolean, trusted boolean, suggested_by_referrer boolean,
               covers_city boolean, open_assignments bigint, accepting_new_work boolean, capacity_confirmed_at timestamptz,
               weekly_capacity int, min_project_value numeric, max_project_value numeric, lead_time_days int,
               provider_score numeric, growth_remaining int, blockers text[])
language sql stable security definer set search_path = '' as $$
  select s.*, app_private.provider_blockers(s.org_id)
  from public.admin_match_suggestions_v2(p_referral) s
  order by cardinality(app_private.provider_blockers(s.org_id)) = 0 desc, s.suggested_by_referrer desc, s.covers_city desc, s.name;
$$;

create or replace function public.admin_assign_referral(p_referral uuid, p_provider uuid, p_suggested_by text default 'admin')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_status public.referral_status; v_contract uuid; v_blockers text[];
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select status into v_status from public.referrals where id = p_referral;
  if v_status not in ('qualified','matching') then raise exception 'Only qualified referrals can be assigned' using errcode = '22023'; end if;
  if app_private.current_consent(p_referral) <> 'granted' then raise exception 'Authorization is not confirmed' using errcode = '22023'; end if;
  v_blockers := app_private.provider_blockers(p_provider);
  if cardinality(v_blockers) > 0 then
    raise exception 'Provider is not eligible to receive projects: %', array_to_string(v_blockers, ', ') using errcode = '22023'; end if;
  if exists (select 1 from public.referral_assignments where referral_id = p_referral
             and status not in ('declined','withdrawn')) then
    raise exception 'This referral already has an active provider' using errcode = '22023'; end if;

  insert into public.referral_assignments (referral_id, provider_org_id, suggested_by, assigned_by)
  values (p_referral, p_provider, p_suggested_by, auth.uid()) returning id into v_id;
  perform app_private.log_referral_event(p_referral, v_id, null, 'offered', null);
  perform app_private.set_referral_status(p_referral, 'assigned', null);

  select c.id into v_contract from public.growth_contracts c
  where c.provider_org_id = p_provider and c.status = 'active' and now()::date between c.start_date and c.deadline
  order by c.start_date limit 1;
  if v_contract is not null then
    insert into public.growth_deliveries (contract_id, assignment_id, referral_id)
    values (v_contract, v_id, p_referral) on conflict do nothing;
  end if;

  insert into public.notifications (org_id, type, title, link)
  values (p_provider, 'opportunity_assigned', 'New opportunity available', '/provider/opportunities/' || v_id);
  return v_id;
end $$;

-- ---------------------------------------------------------------- 2. capacity validation
create or replace function app_private.validate_capacity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.weekly_capacity is null or new.min_project_value is null or new.max_project_value is null or new.lead_time_days is null then
    raise exception 'Weekly capacity, minimum and maximum project value and lead time are required' using errcode = '22023'; end if;
  if new.weekly_capacity < 0 or new.weekly_capacity > 100 then
    raise exception 'Weekly capacity must be between 0 and 100' using errcode = '22023'; end if;
  if new.accepting_new_work and new.weekly_capacity = 0 then
    raise exception 'Weekly capacity must be at least 1 while taking new projects' using errcode = '22023'; end if;
  if new.min_project_value < 0 or new.max_project_value > 10000000 then
    raise exception 'Project values must be between $0 and $10,000,000' using errcode = '22023'; end if;
  if new.max_project_value < new.min_project_value then
    raise exception 'The largest project must be equal to or higher than the smallest' using errcode = '22023'; end if;
  if new.lead_time_days < 0 or new.lead_time_days > 365 then
    raise exception 'Lead time must be between 0 and 365 days' using errcode = '22023'; end if;
  return new;
end $$;
create trigger provider_capacity_validate before insert or update on public.provider_capacity
  for each row execute function app_private.validate_capacity();

-- ---------------------------------------------------------------- 3. document submission validation
create or replace function app_private.validate_document()
returns trigger language plpgsql set search_path = '' as $$
begin
  if app_private.is_platform_admin() then return new; end if;
  if nullif(trim(coalesce(new.number, '')), '') is null then
    raise exception 'The license or policy number is required' using errcode = '22023'; end if;
  if nullif(trim(coalesce(new.issuer, '')), '') is null then
    raise exception 'The issuer is required' using errcode = '22023'; end if;
  if new.expires_on is null or new.expires_on <= current_date then
    raise exception 'The expiration date must be in the future' using errcode = '22023'; end if;
  if new.file_path is null then
    raise exception 'A copy of the document is required' using errcode = '22023'; end if;
  return new;
end $$;
create trigger professional_documents_validate before insert on public.professional_documents
  for each row execute function app_private.validate_document();

-- ---------------------------------------------------------------- 4. required referral scope
create or replace function app_private.check_referral_scope(p_timeline text, p_budget text, p_property_type text, p_phone text, p_email text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_budget is null or p_budget not in ('under_5k','5k_15k','15k_30k','30k_60k','60k_plus','unknown') then
    raise exception 'Choose the estimated budget (or "Not sure yet")' using errcode = '22023'; end if;
  if p_property_type is null or p_property_type not in ('single_family','townhouse','condo','multi_family','commercial','other') then
    raise exception 'Choose the property type (or "Other")' using errcode = '22023'; end if;
  if nullif(trim(coalesce(p_phone, '')), '') is null and nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'Add a phone number or e-mail' using errcode = '22023'; end if;
  if p_timeline = 'asap' and nullif(trim(coalesce(p_phone, '')), '') is null then
    raise exception 'A phone number is required for urgent projects' using errcode = '22023'; end if;
end $$;

create or replace function public.submit_referral_v2(
  p_org uuid, p_category uuid, p_city text, p_zip text, p_description text, p_timeline text,
  p_budget text, p_property_type text, p_needs text,
  p_name text, p_phone text, p_email text, p_address text, p_attested boolean, p_suggested_provider uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform app_private.check_referral_scope(p_timeline, p_budget, p_property_type, p_phone, p_email);
  v_id := public.submit_referral(p_org, p_category, p_city, p_zip, p_description, p_timeline,
                                 p_name, p_phone, p_email, p_address, p_attested, p_suggested_provider);
  update public.referrals set budget_range = p_budget, property_type = p_property_type,
         specific_needs = nullif(trim(p_needs), '') where id = v_id;
  return v_id;
end $$;

create or replace function public.submit_public_referral_v2(
  p_code text, p_category uuid, p_city text, p_zip text, p_description text, p_timeline text,
  p_budget text, p_property_type text, p_needs text,
  p_name text, p_phone text, p_email text, p_consent boolean, p_consent_version text,
  p_ip_hash text, p_user_agent text
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_num bigint;
begin
  perform app_private.check_referral_scope(p_timeline, p_budget, p_property_type, p_phone, p_email);
  v_num := public.submit_public_referral(p_code, p_category, p_city, p_zip, p_description, p_timeline,
                                         p_name, p_phone, p_email, p_consent, p_consent_version, p_ip_hash, p_user_agent);
  update public.referrals set budget_range = p_budget, property_type = p_property_type,
         specific_needs = nullif(trim(p_needs), '') where number = v_num;
  return v_num;
end $$;

-- v1 entry points skip the scope rules: server-only from now on
revoke execute on function public.submit_referral(uuid, uuid, text, text, text, text, text, text, text, text, boolean, uuid) from public, anon, authenticated;
revoke execute on function public.submit_public_referral(text, uuid, text, text, text, text, text, text, text, boolean, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- 5. directory: contacts only after a connection or a shared project
create or replace function app_private.contact_unlocked(p_target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.user_id = auth.uid() and m.org_id <> p_target and (
      exists (select 1 from public.organization_connections c where c.status = 'accepted'
              and ((c.requester_org = m.org_id and c.addressee_org = p_target) or (c.addressee_org = m.org_id and c.requester_org = p_target)))
      or exists (select 1 from public.referral_assignments a join public.referrals r on r.id = a.referral_id
              where a.status in ('accepted','contacted','estimate_scheduled','estimate_sent','won','lost')
                and ((r.source_org_id = m.org_id and a.provider_org_id = p_target) or (r.source_org_id = p_target and a.provider_org_id = m.org_id)))
    ));
$$;

create or replace function public.directory_search(
  p_category uuid default null, p_region uuid default null, p_zip text default null,
  p_query text default null, p_private boolean default false, p_limit int default 50, p_offset int default 0
) returns table (
  id uuid, slug text, name text, logo_path text, primary_category text, city text, state text,
  verified boolean, can_receive boolean, services text[], areas text[],
  phone text, email text, website text, description text
) language sql stable security definer set search_path = '' as $$
  with viewer as (
    select (p_private and auth.uid() is not null and exists (
      select 1 from public.organization_members m join public.organizations o on o.id = m.org_id
      where m.user_id = auth.uid() and o.status = 'approved' and o.deleted_at is null
    )) as is_member
  )
  select o.id, o.slug, o.name, o.logo_path, c.name, o.city, o.state,
         app_private.org_docs_verified(o.id),
         app_private.org_has_capability_any(o.id, 'receive'),
         coalesce((select array_agg(sc.name order by sc.sort) from public.organization_services s
                   join public.service_categories sc on sc.id = s.category_id
                   where s.org_id = o.id and s.kind = 'offered'), '{}'),
         coalesce((select array_agg(r.city order by r.sort) from public.organization_service_areas a
                   join public.regions r on r.id = a.region_id where a.org_id = o.id), '{}'),
         case when v.is_member and app_private.contact_unlocked(o.id) then o.phone end,
         case when v.is_member and app_private.contact_unlocked(o.id) then o.email end,
         o.website,
         o.description
  from public.organizations o
  cross join viewer v
  left join public.service_categories c on c.id = o.category_id
  where o.status = 'approved' and o.deleted_at is null
    and (o.public_profile or v.is_member)
    and (p_category is null or exists (select 1 from public.organization_services s
           where s.org_id = o.id and s.category_id = p_category and s.kind = 'offered'))
    and (p_region is null or exists (select 1 from public.organization_service_areas a
           where a.org_id = o.id and a.region_id = p_region))
    and (p_zip is null or o.zip = p_zip)
    and (p_query is null or o.name ilike '%' || p_query || '%')
  order by app_private.org_docs_verified(o.id) desc, o.name
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

-- connection requests now land where each business can answer them
create or replace function public.request_connection(p_from uuid, p_to uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not app_private.has_org_role(p_from, array['owner','manager','member']::public.member_role[]) then
    raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.organizations o where o.id = p_from and o.status = 'approved')
     or not exists (select 1 from public.organizations o where o.id = p_to and o.status = 'approved') then
    raise exception 'Both businesses must be approved' using errcode = '22023'; end if;
  insert into public.organization_connections (requester_org, addressee_org, requested_by)
  values (p_from, p_to, auth.uid())
  on conflict do nothing returning id into v_id;
  if v_id is null then raise exception 'A connection already exists' using errcode = '23505'; end if;
  insert into public.notifications (org_id, type, title, link)
  values (p_to, 'connection_requested', (select name from public.organizations where id = p_from) || ' wants to connect',
          case when exists (select 1 from public.organization_capabilities c where c.org_id = p_to and c.capability = 'refer')
               then '/partner/network' else '/provider' end);
  return v_id;
end $$;

-- ---------------------------------------------------------------- grants
revoke execute on function app_private.doc_state(uuid, text[]), app_private.provider_blockers(uuid),
  app_private.contact_unlocked(uuid), app_private.check_referral_scope(text, text, text, text, text) from public, anon;
grant execute on function app_private.doc_state(uuid, text[]), app_private.provider_blockers(uuid),
  app_private.contact_unlocked(uuid), app_private.check_referral_scope(text, text, text, text, text) to authenticated;
grant execute on function app_private.check_referral_scope(text, text, text, text, text), app_private.contact_unlocked(uuid) to anon;
revoke execute on function public.org_standing(uuid), public.admin_match_suggestions_v3(uuid) from public, anon;
grant execute on function public.org_standing(uuid), public.admin_match_suggestions_v3(uuid) to authenticated;
