-- Operational role (refer / receive / both) stays separate from the provider's COMMERCIAL status.
-- Anchors are free forever. Providers apply and get verified for free, may receive ONE complimentary opportunity,
-- and only Growth clients (or BookedUp's internal contingency providers) receive a continuous flow.

-- ---------------------------------------------------------------- schema
alter table public.organizations
  add column provider_track text check (provider_track in ('trial','overflow','paused','rejected'));
comment on column public.organizations.provider_track is
  'Set by BookedUp only: trial = may receive one complimentary opportunity; overflow = contingency provider; paused; rejected.';
grant select (provider_track) on public.organizations to authenticated;

alter table public.referral_assignments
  add column kind text not null default 'standard' check (kind in ('growth','trial','overflow','standard'));

alter table public.growth_deliveries
  add column validation text not null default 'pending_validation'
    check (validation in ('pending_validation','qualified','under_dispute','invalidated','replacement_required'));
update public.growth_deliveries set validation = case when excluded then 'invalidated' else 'qualified' end
 where validation = 'pending_validation';
grant update (validation) on public.growth_deliveries to authenticated;

create table public.growth_review_requests (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references public.organizations (id) on delete set null,
  user_id      uuid references auth.users (id) on delete set null,
  source       text not null check (source in ('platform','public')),
  name         text not null check (char_length(name) between 2 and 120),
  company      text not null check (char_length(company) between 2 and 160),
  email        text not null check (char_length(email) <= 254),
  phone        text check (char_length(phone) <= 32),
  city         text check (char_length(city) <= 80),
  services     text check (char_length(services) <= 300),
  best_time    text check (char_length(best_time) <= 120),
  message      text check (char_length(message) <= 2000),
  status       text not null default 'new' check (status in ('new','contacted','qualified','not_a_fit','closed')),
  admin_notes  text check (char_length(admin_notes) <= 2000),
  ip_hash      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger growth_review_requests_updated_at before update on public.growth_review_requests
  for each row execute function public.set_updated_at();
alter table public.growth_review_requests enable row level security;
create policy growth_reviews_read on public.growth_review_requests for select to authenticated
  using (app_private.is_platform_admin() or (org_id is not null and app_private.is_org_member(org_id)));
revoke all on public.growth_review_requests from anon;
revoke insert, update, delete on public.growth_review_requests from authenticated;
grant select on public.growth_review_requests to authenticated;

-- ---------------------------------------------------------------- commercial stage
create or replace function app_private.provider_stage(p_org uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  o record; rcv public.capability_status; b text[];
begin
  select status, provider_track, deleted_at into o from public.organizations where id = p_org;
  if not found or o.deleted_at is not null then return 'rejected'; end if;
  select status into rcv from public.organization_capabilities where org_id = p_org and capability = 'receive';
  if rcv is null then return 'not_applied'; end if;
  if o.status = 'rejected' or rcv = 'revoked' or o.provider_track = 'rejected' then return 'rejected'; end if;

  if exists (select 1 from public.growth_contracts c where c.provider_org_id = p_org and c.status = 'active'
             and current_date between c.start_date and c.deadline) then return 'growth_active'; end if;
  if exists (select 1 from public.growth_contracts c where c.provider_org_id = p_org and c.status = 'continuation_required') then
    return 'growth_extended'; end if;

  b := app_private.provider_blockers(p_org);
  if b && array['license_missing','license_expired','license_rejected','insurance_missing','insurance_expired','insurance_rejected',
                'capacity_missing','capacity_incomplete','capacity_stale','no_services','no_areas'] then
    return 'application_incomplete'; end if;
  if o.status = 'pending_review' or rcv = 'requested' or b && array['license_in_review','insurance_in_review'] then
    return 'under_review'; end if;

  if o.provider_track = 'paused' or o.status = 'suspended' then return 'paused'; end if;
  if o.provider_track = 'overflow' then return 'overflow_provider'; end if;
  if exists (select 1 from public.referral_assignments a where a.provider_org_id = p_org and a.kind = 'trial'
             and a.status not in ('declined','withdrawn')) then return 'trial_delivered'; end if;
  if exists (select 1 from public.growth_contracts c where c.provider_org_id = p_org and c.status = 'completed') then
    return 'growth_completed'; end if;
  if o.provider_track = 'trial' then return 'trial_eligible'; end if;
  return 'verified';
end $$;

-- What kind of delivery a provider may receive right now (null = none).
create or replace function app_private.provider_delivery_kind(p_org uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case app_private.provider_stage(p_org)
    when 'growth_active' then 'growth' when 'growth_extended' then 'growth'
    when 'trial_eligible' then 'trial' when 'overflow_provider' then 'overflow' end;
$$;

create or replace function public.org_standing(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  o record; ref public.capability_status; rcv public.capability_status; blockers text[];
  verification text; v_kind text;
begin
  if not (app_private.is_org_member(p_org) or app_private.is_platform_admin()) then
    raise exception 'Not allowed' using errcode = '42501'; end if;
  select status into o from public.organizations where id = p_org;
  select status into ref from public.organization_capabilities where org_id = p_org and capability = 'refer';
  select status into rcv from public.organization_capabilities where org_id = p_org and capability = 'receive';
  blockers := app_private.provider_blockers(p_org);
  v_kind := app_private.provider_delivery_kind(p_org);
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
    'operational_ready', rcv is not null and cardinality(blockers) = 0,
    'eligible_to_receive', rcv is not null and cardinality(blockers) = 0 and v_kind is not null,
    'stage', app_private.provider_stage(p_org),
    'delivery_kind', v_kind,
    'blockers', to_jsonb(case when rcv is null then array[]::text[] else blockers end),
    'license', app_private.doc_state(p_org, array['contractor_license','business_license']),
    'insurance', app_private.doc_state(p_org, array['general_liability','workers_comp']));
end $$;

create or replace function public.admin_set_provider_track(p_org uuid, p_track text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_track is not null and p_track not in ('trial','overflow','paused','rejected') then
    raise exception 'Invalid track' using errcode = '22023'; end if;
  update public.organizations set provider_track = p_track where id = p_org;
end $$;

-- ---------------------------------------------------------------- Growth progress: only validated deliveries count
create or replace view public.growth_contract_progress with (security_invoker = true) as
with d as (
  select c.id as contract_id, dl.validation,
         (not dl.excluded and dl.validation = 'qualified' and r.qualified_at is not null
          and a.status not in ('declined','withdrawn')
          and (dl.delivered_at::date between c.start_date and c.deadline or c.status = 'continuation_required')
          and app_private.current_consent(r.id) = 'granted') as counts
  from public.growth_contracts c
  join public.growth_deliveries dl on dl.contract_id = c.id
  join public.referral_assignments a on a.id = dl.assignment_id
  join public.referrals r on r.id = dl.referral_id
)
select c.id as contract_id, c.provider_org_id, o.name as provider_name, c.start_date, c.deadline, c.target, c.status,
       coalesce(sum(case when d.counts then 1 else 0 end), 0)::bigint as delivered,
       greatest(c.target - coalesce(sum(case when d.counts then 1 else 0 end), 0), 0)::int as remaining,
       greatest(c.deadline - current_date, 0) as days_left,
       coalesce(sum(case when d.validation = 'pending_validation' then 1 else 0 end), 0)::int as pending_validation,
       coalesce(sum(case when d.validation = 'under_dispute' then 1 else 0 end), 0)::int as under_dispute,
       coalesce(sum(case when d.validation = 'replacement_required' then 1 else 0 end), 0)::int as replacement_required,
       least(greatest(current_date - c.start_date, 0), 90) as elapsed_days,
       round(c.target * 30.0 / 90, 1) as expected_per_month,
       round(coalesce(sum(case when d.counts then 1 else 0 end), 0) * 30.0 / greatest(least(current_date - c.start_date, 90), 1), 1) as current_per_month,
       case
         when c.status <> 'active' then c.status::text
         when coalesce(sum(case when d.counts then 1 else 0 end), 0) >= c.target then 'on_track'
         when least(greatest(current_date - c.start_date, 0), 90) < 7 then 'on_track'
         when coalesce(sum(case when d.counts then 1 else 0 end), 0) >= c.target * least(greatest(current_date - c.start_date, 0), 90) / 90.0 then 'on_track'
         when coalesce(sum(case when d.counts then 1 else 0 end), 0) >= 0.75 * c.target * least(greatest(current_date - c.start_date, 0), 90) / 90.0 then 'attention'
         else 'at_risk' end as health
from public.growth_contracts c
join public.organizations o on o.id = c.provider_org_id
left join d on d.contract_id = c.id
group by c.id, o.name;
grant select on public.growth_contract_progress to authenticated;
revoke all on public.growth_contract_progress from anon;

-- ---------------------------------------------------------------- matching: compatibility first, then commercial priority
create or replace function public.admin_match_suggestions_v4(p_referral uuid)
returns table (org_id uuid, name text, city text, docs_verified boolean, trusted boolean, suggested_by_referrer boolean,
               covers_city boolean, open_assignments bigint, accepting_new_work boolean, capacity_confirmed_at timestamptz,
               weekly_capacity int, min_project_value numeric, max_project_value numeric, lead_time_days int,
               provider_score numeric, growth_remaining int, blockers text[], stage text, delivery_kind text, priority int)
language sql stable security definer set search_path = '' as $$
  with s as (
    select v.*, app_private.provider_stage(v.org_id) as stage, app_private.provider_delivery_kind(v.org_id) as kind
    from public.admin_match_suggestions_v3(p_referral) v
  )
  select s.org_id, s.name, s.city, s.docs_verified, s.trusted, s.suggested_by_referrer, s.covers_city, s.open_assignments,
         s.accepting_new_work, s.capacity_confirmed_at, s.weekly_capacity, s.min_project_value, s.max_project_value,
         s.lead_time_days, s.provider_score, s.growth_remaining, s.blockers, s.stage, s.kind,
         case when cardinality(s.blockers) > 0 or s.kind is null then 9
              when s.kind = 'growth' and coalesce(s.growth_remaining, 0) > 0 then 1
              when s.kind = 'growth' then 2
              when s.kind = 'trial' then 3
              when s.kind = 'overflow' then 4 end as priority
  from s
  order by priority, s.covers_city desc, s.growth_remaining desc nulls last, s.open_assignments, s.name;
$$;

create or replace function public.admin_assign_referral(p_referral uuid, p_provider uuid, p_suggested_by text default 'admin')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_status public.referral_status; v_contract uuid; v_blockers text[]; v_kind text;
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select status into v_status from public.referrals where id = p_referral;
  if v_status not in ('qualified','matching') then raise exception 'Only qualified referrals can be assigned' using errcode = '22023'; end if;
  if app_private.current_consent(p_referral) <> 'granted' then raise exception 'Authorization is not confirmed' using errcode = '22023'; end if;
  v_blockers := app_private.provider_blockers(p_provider);
  if cardinality(v_blockers) > 0 then
    raise exception 'Provider is not eligible to receive projects: %', array_to_string(v_blockers, ', ') using errcode = '22023'; end if;
  v_kind := app_private.provider_delivery_kind(p_provider);
  if v_kind is null then
    raise exception 'Provider has no active Growth program, complimentary opportunity or contingency status (stage: %)',
      app_private.provider_stage(p_provider) using errcode = '22023'; end if;
  if exists (select 1 from public.referral_assignments where referral_id = p_referral
             and status not in ('declined','withdrawn')) then
    raise exception 'This referral already has an active provider' using errcode = '22023'; end if;

  insert into public.referral_assignments (referral_id, provider_org_id, suggested_by, assigned_by, kind)
  values (p_referral, p_provider, p_suggested_by, auth.uid(), v_kind) returning id into v_id;
  perform app_private.log_referral_event(p_referral, v_id, null, 'offered', null);
  perform app_private.set_referral_status(p_referral, 'assigned', null);

  if v_kind = 'growth' then
    select c.id into v_contract from public.growth_contracts c
    where c.provider_org_id = p_provider
      and (c.status = 'continuation_required' or (c.status = 'active' and current_date between c.start_date and c.deadline))
    order by c.start_date limit 1;
    if v_contract is not null then
      insert into public.growth_deliveries (contract_id, assignment_id, referral_id)
      values (v_contract, v_id, p_referral) on conflict do nothing;
    end if;
  end if;

  insert into public.notifications (org_id, type, title, link)
  values (p_provider, 'opportunity_assigned',
          case v_kind when 'trial' then 'Your complimentary opportunity is available' else 'New opportunity available' end,
          '/provider/opportunities/' || v_id);
  return v_id;
end $$;

-- ---------------------------------------------------------------- Growth Review requests
create or replace function public.request_growth_review(p_org uuid, p_phone text, p_best_time text, p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; o record; u record;
begin
  if not app_private.has_org_role(p_org, array['owner','manager']::public.member_role[]) then
    raise exception 'Only owners and managers can request a Growth Review' using errcode = '42501'; end if;
  if exists (select 1 from public.growth_review_requests r where r.org_id = p_org and r.status in ('new','contacted')
             and r.created_at > now() - interval '7 days') then
    raise exception 'You already have a Growth Review request in progress' using errcode = '22023'; end if;
  select name, email, phone, city into o from public.organizations where id = p_org;
  select coalesce(nullif(trim(p.full_name), ''), split_part(x.email, '@', 1)) as full_name, x.email into u
    from auth.users x left join public.profiles p on p.id = x.id where x.id = auth.uid();
  insert into public.growth_review_requests (org_id, user_id, source, name, company, email, phone, city, services, best_time, message)
  values (p_org, auth.uid(), 'platform', left(case when char_length(coalesce(u.full_name, '')) >= 2 then u.full_name else o.name end, 120), o.name, coalesce(u.email, o.email),
          left(coalesce(nullif(trim(p_phone), ''), o.phone), 32), o.city,
          (select string_agg(c.name, ', ' order by c.sort) from public.organization_services s join public.service_categories c on c.id = s.category_id
           where s.org_id = p_org and s.kind = 'offered'),
          left(nullif(trim(p_best_time), ''), 120), left(nullif(trim(p_message), ''), 2000))
  returning id into v_id;
  insert into public.notifications (for_admins, type, title, link)
  values (true, 'growth_review_requested', o.name || ' requested a Growth Review', '/admin/growth/requests');
  return v_id;
end $$;

create or replace function public.submit_growth_interest(p_name text, p_company text, p_email text, p_phone text,
  p_city text, p_services text, p_message text, p_ip_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if char_length(trim(coalesce(p_name, ''))) < 2 or char_length(trim(coalesce(p_company, ''))) < 2
     or coalesce(p_email, '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Name, company and a valid e-mail are required' using errcode = '22023'; end if;
  if (select count(*) from public.growth_review_requests r where r.ip_hash = p_ip_hash and r.created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Too many requests. Try again later.' using errcode = '54000'; end if;
  insert into public.growth_review_requests (source, name, company, email, phone, city, services, message, ip_hash)
  values ('public', left(trim(p_name), 120), left(trim(p_company), 160), lower(left(trim(p_email), 254)),
          left(nullif(trim(p_phone), ''), 32), left(nullif(trim(p_city), ''), 80), left(nullif(trim(p_services), ''), 300),
          left(nullif(trim(p_message), ''), 2000), p_ip_hash);
  insert into public.notifications (for_admins, type, title, link)
  values (true, 'growth_review_requested', trim(p_company) || ' asked about BookedUp Growth', '/admin/growth/requests');
end $$;

create or replace function public.admin_update_growth_review(p_id uuid, p_status text, p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_status not in ('new','contacted','qualified','not_a_fit','closed') then raise exception 'Invalid status' using errcode = '22023'; end if;
  update public.growth_review_requests set status = p_status, admin_notes = left(nullif(trim(p_notes), ''), 2000) where id = p_id;
end $$;

-- ---------------------------------------------------------------- grants
revoke execute on function app_private.provider_stage(uuid), app_private.provider_delivery_kind(uuid) from public, anon;
grant execute on function app_private.provider_stage(uuid), app_private.provider_delivery_kind(uuid) to authenticated;
revoke execute on function public.admin_set_provider_track(uuid, text), public.admin_match_suggestions_v4(uuid),
  public.request_growth_review(uuid, text, text, text), public.admin_update_growth_review(uuid, text, text) from public, anon;
grant execute on function public.admin_set_provider_track(uuid, text), public.admin_match_suggestions_v4(uuid),
  public.request_growth_review(uuid, text, text, text), public.admin_update_growth_review(uuid, text, text) to authenticated;
revoke execute on function public.submit_growth_interest(text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_growth_interest(text, text, text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------- provider-facing Growth reads (providers can't read referrals directly)
create or replace function public.my_growth_program(p_org uuid)
returns setof public.growth_contract_progress language sql stable security definer set search_path = '' as $$
  select * from public.growth_contract_progress p
  where p.provider_org_id = p_org and (app_private.is_org_member(p_org) or app_private.is_platform_admin())
  order by (p.status in ('active','continuation_required')) desc, p.start_date desc;
$$;

create or replace function public.my_growth_deliveries(p_org uuid)
returns table (assignment_id uuid, referral_number bigint, service text, delivered_at timestamptz, validation text, excluded boolean, assignment_status public.assignment_status)
language sql stable security definer set search_path = '' as $$
  select d.assignment_id, r.number, c.name, d.delivered_at, d.validation, d.excluded, a.status
  from public.growth_deliveries d
  join public.growth_contracts g on g.id = d.contract_id
  join public.referrals r on r.id = d.referral_id
  join public.referral_assignments a on a.id = d.assignment_id
  join public.service_categories c on c.id = r.category_id
  where g.provider_org_id = p_org and (app_private.is_org_member(p_org) or app_private.is_platform_admin())
  order by d.delivered_at desc;
$$;
revoke execute on function public.my_growth_program(uuid), public.my_growth_deliveries(uuid) from public, anon;
grant execute on function public.my_growth_program(uuid), public.my_growth_deliveries(uuid) to authenticated;
