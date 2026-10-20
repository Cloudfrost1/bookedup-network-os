-- Provider operational capacity, full-scope requests (budget, needs, photos), reliability history with verified feedback.
-- Quality badges are earned from verified documents and track record, never granted by signing up.

-- ---------------------------------------------------------------- 1. provider capacity
create table public.provider_capacity (
  org_id              uuid primary key references public.organizations (id) on delete cascade,
  accepting_new_work  boolean not null default true,
  weekly_capacity     int check (weekly_capacity between 0 and 100),
  min_project_value   numeric(12,2) check (min_project_value >= 0),
  max_project_value   numeric(12,2) check (max_project_value >= 0),
  lead_time_days      int check (lead_time_days between 0 and 365),
  notes               text check (char_length(notes) <= 1000),
  confirmed_at        timestamptz not null default now(),
  confirmed_by        uuid references auth.users (id) on delete set null,
  updated_at          timestamptz not null default now(),
  check (max_project_value is null or min_project_value is null or max_project_value >= min_project_value)
);
create trigger provider_capacity_updated_at before update on public.provider_capacity
  for each row execute function public.set_updated_at();

create type public.document_kind as enum ('contractor_license', 'business_license', 'general_liability', 'workers_comp', 'other');
create type public.document_status as enum ('submitted', 'verified', 'rejected');
create table public.professional_documents (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  kind        public.document_kind not null,
  number      text check (char_length(number) <= 80),
  issuer      text check (char_length(issuer) <= 120),
  expires_on  date,
  file_path   text check (char_length(file_path) <= 300),
  status      public.document_status not null default 'submitted',
  review_note text check (char_length(review_note) <= 500),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index professional_documents_org_idx on public.professional_documents (org_id);

alter table public.provider_capacity      enable row level security;
alter table public.professional_documents enable row level security;
create policy capacity_read on public.provider_capacity for select to authenticated
  using (app_private.is_org_member(org_id) or app_private.is_platform_admin());
create policy capacity_write on public.provider_capacity for all to authenticated
  using (app_private.has_org_role(org_id, array['owner','manager']::public.member_role[]) or app_private.is_platform_admin())
  with check (app_private.has_org_role(org_id, array['owner','manager']::public.member_role[]) or app_private.is_platform_admin());
create policy documents_read on public.professional_documents for select to authenticated
  using (app_private.is_org_member(org_id) or app_private.is_platform_admin());
create policy documents_insert on public.professional_documents for insert to authenticated
  with check (status = 'submitted' and app_private.has_org_role(org_id, array['owner','manager']::public.member_role[]));
revoke all on public.provider_capacity, public.professional_documents from anon;
revoke update, delete on public.professional_documents from authenticated;
create trigger audit_professional_documents after insert or update on public.professional_documents
  for each row execute function public.audit_row_change();

create or replace function public.admin_review_document(p_doc uuid, p_status public.document_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.professional_documents
     set status = p_status, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_doc;
end $$;

-- Documents verified = at least one verified, unexpired license AND one verified, unexpired insurance.
create or replace function app_private.org_docs_verified(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.professional_documents d where d.org_id = p_org and d.status = 'verified'
                   and d.kind in ('contractor_license','business_license') and (d.expires_on is null or d.expires_on >= current_date))
     and exists (select 1 from public.professional_documents d where d.org_id = p_org and d.status = 'verified'
                   and d.kind in ('general_liability','workers_comp') and (d.expires_on is null or d.expires_on >= current_date));
$$;

-- ---------------------------------------------------------------- 2. full-scope requests
alter table public.referrals
  add column budget_range text check (budget_range in ('under_5k','5k_15k','15k_30k','30k_60k','60k_plus','unknown')),
  add column property_type text check (property_type in ('single_family','townhouse','condo','multi_family','commercial','other')),
  add column specific_needs text check (char_length(specific_needs) <= 2000);

create table public.referral_photos (
  id          uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals (id) on delete cascade,
  path        text not null unique check (char_length(path) <= 300),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index referral_photos_referral_idx on public.referral_photos (referral_id);
alter table public.referral_photos enable row level security;

-- Who may see a referral's project details (never the contact): admin, the referring business, a provider it was sent to.
create or replace function app_private.can_view_referral(p_referral uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_platform_admin()
      or exists (select 1 from public.referrals r where r.id = p_referral and r.source_org_id is not null
                 and app_private.is_org_member(r.source_org_id))
      or exists (select 1 from public.referral_assignments a where a.referral_id = p_referral
                 and a.status not in ('declined','withdrawn') and app_private.is_org_member(a.provider_org_id));
$$;
create or replace function app_private.can_add_referral_photo(p_referral uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_platform_admin()
      or exists (select 1 from public.referrals r where r.id = p_referral and r.source_org_id is not null
                 and app_private.is_org_member(r.source_org_id) and r.created_at > now() - interval '1 day');
$$;
create policy photos_read on public.referral_photos for select to authenticated using (app_private.can_view_referral(referral_id));
create policy photos_insert on public.referral_photos for insert to authenticated
  with check (app_private.can_add_referral_photo(referral_id)
              and (select count(*) from public.referral_photos p where p.referral_id = referral_photos.referral_id) < 8);
revoke all on public.referral_photos from anon;
revoke update, delete on public.referral_photos from authenticated;

-- Storage: private buckets; object names start with the referral id / organization id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('referral-photos', 'referral-photos', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic']),
       ('provider-docs', 'provider-docs', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create or replace function app_private.uuid_or_null(p text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin return p::uuid; exception when others then return null; end $$;

create policy referral_photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'referral-photos' and app_private.can_add_referral_photo(app_private.uuid_or_null(split_part(name, '/', 1))));
create policy referral_photos_view on storage.objects for select to authenticated
  using (bucket_id = 'referral-photos' and app_private.can_view_referral(app_private.uuid_or_null(split_part(name, '/', 1))));
create policy provider_docs_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'provider-docs'
              and app_private.has_org_role(app_private.uuid_or_null(split_part(name, '/', 1)), array['owner','manager']::public.member_role[]));
create policy provider_docs_view on storage.objects for select to authenticated
  using (bucket_id = 'provider-docs'
         and (app_private.is_org_member(app_private.uuid_or_null(split_part(name, '/', 1))) or app_private.is_platform_admin()));

create or replace function public.submit_referral_v2(
  p_org uuid, p_category uuid, p_city text, p_zip text, p_description text, p_timeline text,
  p_budget text, p_property_type text, p_needs text,
  p_name text, p_phone text, p_email text, p_address text, p_attested boolean, p_suggested_provider uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  v_id := public.submit_referral(p_org, p_category, p_city, p_zip, p_description, p_timeline,
                                 p_name, p_phone, p_email, p_address, p_attested, p_suggested_provider);
  update public.referrals set budget_range = nullif(p_budget, ''), property_type = nullif(p_property_type, ''),
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
  v_num := public.submit_public_referral(p_code, p_category, p_city, p_zip, p_description, p_timeline,
                                         p_name, p_phone, p_email, p_consent, p_consent_version, p_ip_hash, p_user_agent);
  update public.referrals set budget_range = nullif(p_budget, ''), property_type = nullif(p_property_type, ''),
         specific_needs = nullif(trim(p_needs), '') where number = v_num;
  return v_num;
end $$;

-- ---------------------------------------------------------------- 3. reliability: appointments + verified feedback
alter table public.referral_assignments add column appointment_at timestamptz;

create type public.feedback_source as enum ('homeowner', 'partner', 'admin');
create table public.assignment_feedback (
  id               uuid primary key default gen_random_uuid(),
  assignment_id    uuid not null references public.referral_assignments (id) on delete cascade,
  source           public.feedback_source not null,
  contacted_quickly boolean,
  showed_up        boolean,
  kept_commitments boolean,
  rating           int check (rating between 1 and 5),
  comment          text check (char_length(comment) <= 1000),
  verified         boolean not null default false,
  verified_by      uuid references auth.users (id) on delete set null,
  verified_at      timestamptz,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index assignment_feedback_assignment_idx on public.assignment_feedback (assignment_id);
alter table public.assignment_feedback enable row level security;
create policy feedback_admin_read on public.assignment_feedback for select to authenticated using (app_private.is_platform_admin());
revoke all on public.assignment_feedback from anon;
revoke insert, update, delete on public.assignment_feedback from authenticated;
create trigger audit_assignment_feedback after insert or update on public.assignment_feedback
  for each row execute function public.audit_row_change();

-- The referring business can leave feedback on the provider; it counts only after BookedUp verifies it.
create or replace function public.partner_feedback(p_referral uuid, p_contacted boolean, p_showed boolean, p_kept boolean,
                                                   p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_asg uuid; v_org uuid;
begin
  select r.source_org_id into v_org from public.referrals r where r.id = p_referral;
  if v_org is null or not app_private.is_org_member(v_org) then raise exception 'Not allowed' using errcode = '42501'; end if;
  select a.id into v_asg from public.referral_assignments a where a.referral_id = p_referral
    and a.status not in ('offered','declined','withdrawn') order by a.assigned_at desc limit 1;
  if v_asg is null then raise exception 'No provider accepted this referral yet' using errcode = '22023'; end if;
  insert into public.assignment_feedback (assignment_id, source, contacted_quickly, showed_up, kept_commitments, rating, comment, created_by)
  values (v_asg, 'partner', p_contacted, p_showed, p_kept, p_rating, left(p_comment, 1000), auth.uid());
  insert into public.notifications (for_admins, type, title, link)
  values (true, 'feedback_received', 'Feedback to verify on a provider', '/admin/referrals/' || p_referral);
end $$;

-- BookedUp records feedback it confirmed directly (e.g. call with the homeowner) or verifies partner feedback.
create or replace function public.admin_record_feedback(p_assignment uuid, p_source public.feedback_source, p_contacted boolean,
                                                        p_showed boolean, p_kept boolean, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.assignment_feedback (assignment_id, source, contacted_quickly, showed_up, kept_commitments, rating, comment,
                                          verified, verified_by, verified_at, created_by)
  values (p_assignment, p_source, p_contacted, p_showed, p_kept, p_rating, left(p_comment, 1000), true, auth.uid(), now(), auth.uid());
end $$;

create or replace function public.admin_verify_feedback(p_feedback uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.assignment_feedback set verified = p_verified, verified_by = auth.uid(), verified_at = now() where id = p_feedback;
end $$;

-- Pipeline update with appointment date.
create or replace function public.provider_update_v2(p_assignment uuid, p_status public.assignment_status,
                                                     p_estimated_value numeric default null, p_notes text default null,
                                                     p_appointment_at timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.provider_update(p_assignment, p_status, p_estimated_value, p_notes);
  if p_appointment_at is not null then
    update public.referral_assignments set appointment_at = p_appointment_at where id = p_assignment;
  end if;
end $$;

-- Reliability history (90 days). Every number comes from recorded events; feedback counts only when verified.
create or replace function app_private.provider_reliability_raw(p_org uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with a as (
    select * from public.referral_assignments x where x.provider_org_id = p_org and x.assigned_at >= now() - interval '180 days'),
  f as (
    select fb.* from public.assignment_feedback fb join a on a.id = fb.assignment_id where fb.verified)
  select jsonb_build_object(
    'received', (select count(*) from a),
    'answered', (select count(*) from a where responded_at is not null),
    'median_response_hours', (select round((percentile_cont(0.5) within group (order by extract(epoch from responded_at - assigned_at)) / 3600)::numeric, 1)
                               from a where responded_at is not null),
    'answered_within_24h', (select count(*) from a where responded_at is not null and responded_at - assigned_at <= interval '24 hours'),
    'accepted', (select count(*) from a where status not in ('offered','declined','withdrawn')),
    'first_contact_within_48h', (select count(*) from a where first_contact_at is not null and responded_at is not null
                                   and first_contact_at - responded_at <= interval '48 hours'),
    'stale_offers', (select count(*) from a where status = 'offered' and assigned_at < now() - interval '48 hours'),
    'stalled', (select count(*) from a where status in ('accepted','contacted','estimate_scheduled','estimate_sent')
                  and last_update_at < now() - interval '7 days'),
    'outcomes', (select count(*) from a where status in ('won','lost')),
    'appointments', (select count(*) from a where appointment_at is not null),
    'verified_feedback', (select count(*) from f),
    'showed_up_yes', (select count(*) from f where showed_up),
    'showed_up_answered', (select count(*) from f where showed_up is not null),
    'kept_yes', (select count(*) from f where kept_commitments),
    'kept_answered', (select count(*) from f where kept_commitments is not null),
    'avg_rating', (select round(avg(rating)::numeric, 1) from f where rating is not null),
    'docs_verified', app_private.org_docs_verified(p_org),
    'capacity_confirmed_at', (select confirmed_at from public.provider_capacity c where c.org_id = p_org),
    'accepting_new_work', (select accepting_new_work from public.provider_capacity c where c.org_id = p_org));
$$;

-- Earned badge: verified documents + 5 accepted opportunities + 3 verified feedbacks (avg >= 4, showed up >= 90%) + no stalled work.
create or replace function app_private.provider_trusted(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  with r as (select app_private.provider_reliability_raw(p_org) j)
  select coalesce((j ->> 'docs_verified')::boolean
     and (j ->> 'accepted')::int >= 5
     and (j ->> 'verified_feedback')::int >= 3
     and coalesce((j ->> 'avg_rating')::numeric, 0) >= 4
     and (j ->> 'showed_up_answered')::int > 0
     and (j ->> 'showed_up_yes')::numeric / nullif((j ->> 'showed_up_answered')::numeric, 0) >= 0.9
     and (j ->> 'stalled')::int = 0, false)
  from r;
$$;

create or replace function public.provider_reliability(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app_private.is_org_member(p_org) or app_private.is_platform_admin()) then
    raise exception 'Not allowed' using errcode = '42501'; end if;
  return app_private.provider_reliability_raw(p_org) || jsonb_build_object('trusted', app_private.provider_trusted(p_org));
end $$;

-- Directory: "verified" now means verified documents; "trusted" is the earned badge.
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
         case when v.is_member then o.phone end,
         case when v.is_member then o.email end,
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

-- Matching with capacity, budget fit, documents and reliability.
create or replace function public.admin_match_suggestions_v2(p_referral uuid)
returns table (org_id uuid, name text, city text, docs_verified boolean, trusted boolean, suggested_by_referrer boolean,
               covers_city boolean, open_assignments bigint, accepting_new_work boolean, capacity_confirmed_at timestamptz,
               weekly_capacity int, min_project_value numeric, max_project_value numeric, lead_time_days int,
               provider_score numeric, growth_remaining int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select o.id, o.name, o.city, app_private.org_docs_verified(o.id), app_private.provider_trusted(o.id),
         o.id = r.suggested_provider_org_id,
         exists (select 1 from public.organization_service_areas a join public.regions g on g.id = a.region_id
                 where a.org_id = o.id and lower(g.city) = lower(r.city)),
         (select count(*) from public.referral_assignments x where x.provider_org_id = o.id and x.status in ('offered','accepted','contacted','estimate_scheduled','estimate_sent')),
         pc.accepting_new_work, pc.confirmed_at, pc.weekly_capacity, pc.min_project_value, pc.max_project_value, pc.lead_time_days,
         (select s2.score from public.provider_score_snapshots s2 where s2.org_id = o.id order by s2.period_end desc limit 1),
         (select gp.remaining from public.growth_contract_progress gp where gp.provider_org_id = o.id and gp.status = 'active' limit 1)
  from public.referrals r
  join public.organization_services s on s.category_id = r.category_id and s.kind = 'offered'
  join public.organizations o on o.id = s.org_id
  left join public.provider_capacity pc on pc.org_id = o.id
  where r.id = p_referral
    and o.id is distinct from r.source_org_id
    and o.available_for_referrals
    and app_private.org_has_capability_any(o.id, 'receive')
    and not exists (select 1 from public.referral_assignments x where x.referral_id = r.id and x.provider_org_id = o.id)
  order by (o.id = r.suggested_provider_org_id) desc,
           coalesce(pc.accepting_new_work, false) and pc.confirmed_at > now() - interval '30 days' desc,
           exists (select 1 from public.organization_service_areas a join public.regions g on g.id = a.region_id
                   where a.org_id = o.id and lower(g.city) = lower(r.city)) desc,
           app_private.provider_trusted(o.id) desc, app_private.org_docs_verified(o.id) desc, o.name;
end $$;

-- Provider views now include the full scope (still no contact until accepted).
create or replace function public.list_my_opportunities_v2(p_org uuid)
returns table (assignment_id uuid, referral_number bigint, service text, city text, zip text, timeline text,
               budget_range text, status public.assignment_status, assigned_at timestamptz, estimated_value numeric,
               appointment_at timestamptz, photos bigint)
language sql stable security definer set search_path = '' as $$
  select a.id, r.number, c.name, r.city, r.zip, r.timeline, r.budget_range, a.status, a.assigned_at, a.estimated_value,
         a.appointment_at, (select count(*) from public.referral_photos p where p.referral_id = r.id)
  from public.referral_assignments a
  join public.referrals r on r.id = a.referral_id
  join public.service_categories c on c.id = r.category_id
  where a.provider_org_id = p_org and app_private.is_org_member(p_org) and a.status <> 'withdrawn'
  order by a.assigned_at desc;
$$;

create or replace function public.get_opportunity(p_assignment uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; v_org uuid;
begin
  select provider_org_id into v_org from public.referral_assignments where id = p_assignment;
  if v_org is null or not app_private.is_org_member(v_org) then return null; end if;
  select jsonb_build_object(
    'assignment_id', a.id, 'org_id', a.provider_org_id, 'referral_id', r.id, 'number', r.number, 'service', c.name,
    'city', r.city, 'zip', r.zip, 'description', r.description, 'timeline', r.timeline,
    'budget_range', r.budget_range, 'property_type', r.property_type, 'specific_needs', r.specific_needs,
    'status', a.status, 'assigned_at', a.assigned_at, 'responded_at', a.responded_at, 'first_contact_at', a.first_contact_at,
    'appointment_at', a.appointment_at, 'estimated_value', a.estimated_value, 'notes', a.notes,
    'photos', coalesce((select jsonb_agg(p.path order by p.created_at) from public.referral_photos p where p.referral_id = r.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('to', e.to_status, 'at', e.created_at) order by e.created_at)
                        from public.referral_events e where e.assignment_id = a.id), '[]'::jsonb))
  into v
  from public.referral_assignments a join public.referrals r on r.id = a.referral_id
  join public.service_categories c on c.id = r.category_id where a.id = p_assignment;
  return v;
end $$;

-- Provider score now uses reliability: response, acceptance, first contact, attendance and commitments from verified feedback.
update public.network_settings
   set provider_weights = '{"response":25,"acceptance":15,"first_contact":15,"attendance":20,"commitments":15,"rating":10}'
 where network_id is not null;
alter table public.network_settings alter column provider_weights
  set default '{"response":25,"acceptance":15,"first_contact":15,"attendance":20,"commitments":15,"rating":10}';

create or replace function public.compute_scores()
returns void language plpgsql security definer set search_path = '' as $$
declare st record; d date := current_date;
begin
  if auth.uid() is not null and not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into st from public.network_settings limit 1;

  insert into public.partner_score_snapshots
  select o.id, d, m.submitted, m.qualified,
         case when m.decided > 0 then m.qualified::numeric / m.decided end,
         m.l30, m.l90, m.active_months,
         case when m.submitted > 0 then m.dups::numeric / m.submitted end,
         sc.score, app_private.level_for(sc.score, 'Partner')
  from public.organizations o
  cross join lateral (
    select count(*) filter (where r.created_at >= now() - interval '90 days') as submitted,
           count(*) filter (where r.qualified_at >= now() - interval '90 days') as qualified,
           count(*) filter (where r.created_at >= now() - interval '90 days' and (r.qualified_at is not null or r.status = 'rejected')) as decided,
           count(*) filter (where r.qualified_at >= now() - interval '30 days') as l30,
           count(*) filter (where r.qualified_at >= now() - interval '90 days') as l90,
           count(distinct date_trunc('month', r.qualified_at)) filter (where r.qualified_at >= now() - interval '90 days') as active_months,
           count(*) filter (where r.duplicate_of is not null and r.created_at >= now() - interval '90 days') as dups
    from public.referrals r where r.source_org_id = o.id) m
  cross join lateral (
    select case when m.submitted < st.partner_min_volume then null else round((
        least(1, m.qualified::numeric / greatest(st.volume_target, 1)) * (st.partner_weights ->> 'volume')::numeric
      + coalesce(m.qualified::numeric / nullif(m.decided, 0), 0) * (st.partner_weights ->> 'rate')::numeric
      + (m.active_months::numeric / 3) * (st.partner_weights ->> 'consistency')::numeric
      + (1 - coalesce(m.dups::numeric / nullif(m.submitted, 0), 0)) * (st.partner_weights ->> 'reliability')::numeric
    ), 1) end as score) sc
  where app_private.org_has_capability_any(o.id, 'refer')
  on conflict (org_id, period_end) do update set submitted = excluded.submitted, qualified = excluded.qualified,
    qualification_rate = excluded.qualification_rate, last_30 = excluded.last_30, last_90 = excluded.last_90,
    active_months = excluded.active_months, duplicate_rate = excluded.duplicate_rate, score = excluded.score, level = excluded.level;

  insert into public.provider_score_snapshots
  select o.id, d, (j ->> 'received')::int,
         (j ->> 'accepted')::numeric / nullif((j ->> 'answered')::numeric, 0),
         (j ->> 'median_response_hours')::numeric * 60,
         (j ->> 'first_contact_within_48h')::numeric / nullif((j ->> 'accepted')::numeric, 0),
         (j ->> 'showed_up_yes')::numeric / nullif((j ->> 'showed_up_answered')::numeric, 0),
         1 - (j ->> 'stale_offers')::numeric / nullif((j ->> 'received')::numeric, 0),
         sc.score, app_private.level_for(sc.score, 'Provider')
  from public.organizations o
  cross join lateral (select app_private.provider_reliability_raw(o.id) as j) rr
  cross join lateral (
    select case when (j ->> 'received')::int < st.provider_min_volume then null else round((
        greatest(0, least(1, 1 - (coalesce((j ->> 'median_response_hours')::numeric, 48) - 1) / 47)) * coalesce((st.provider_weights ->> 'response')::numeric, 25)
      + coalesce((j ->> 'accepted')::numeric / nullif((j ->> 'answered')::numeric, 0), 0) * coalesce((st.provider_weights ->> 'acceptance')::numeric, 15)
      + coalesce((j ->> 'first_contact_within_48h')::numeric / nullif((j ->> 'accepted')::numeric, 0), 0) * coalesce((st.provider_weights ->> 'first_contact')::numeric, 15)
      + coalesce((j ->> 'showed_up_yes')::numeric / nullif((j ->> 'showed_up_answered')::numeric, 0), 0) * coalesce((st.provider_weights ->> 'attendance')::numeric, 20)
      + coalesce((j ->> 'kept_yes')::numeric / nullif((j ->> 'kept_answered')::numeric, 0), 0) * coalesce((st.provider_weights ->> 'commitments')::numeric, 15)
      + coalesce(((j ->> 'avg_rating')::numeric - 1) / 4, 0) * coalesce((st.provider_weights ->> 'rating')::numeric, 10)
    ), 1) end as score) sc
  where app_private.org_has_capability_any(o.id, 'receive')
  on conflict (org_id, period_end) do update set received = excluded.received, acceptance_rate = excluded.acceptance_rate,
    avg_response_minutes = excluded.avg_response_minutes, update_rate = excluded.update_rate, outcome_rate = excluded.outcome_rate,
    reliability = excluded.reliability, score = excluded.score, level = excluded.level;
end $$;

-- ---------------------------------------------------------------- admin: new sign-ups land in the admin notifications
create or replace function app_private.notify_new_organization()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (for_admins, type, title, link)
  values (true, 'organization_pending', new.name || ' signed up and is waiting for approval', '/admin/organizations/' || new.id);
  return new;
end $$;
create trigger organizations_notify_new after insert on public.organizations
  for each row execute function app_private.notify_new_organization();

-- ---------------------------------------------------------------- privileges
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('admin_review_document','submit_referral_v2','partner_feedback',
             'admin_record_feedback','admin_verify_feedback','provider_update_v2','provider_reliability',
             'admin_match_suggestions_v2','list_my_opportunities_v2')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
revoke execute on function public.submit_public_referral_v2(text, uuid, text, text, text, text, text, text, text, text, text, text, boolean, text, text, text) from public;
grant  execute on function public.submit_public_referral_v2(text, uuid, text, text, text, text, text, text, text, text, text, text, boolean, text, text, text) to anon, authenticated;
revoke execute on function app_private.org_docs_verified(uuid), app_private.can_view_referral(uuid), app_private.can_add_referral_photo(uuid),
  app_private.uuid_or_null(text), app_private.provider_reliability_raw(uuid), app_private.provider_trusted(uuid),
  app_private.notify_new_organization() from public, anon;
grant execute on function app_private.org_docs_verified(uuid), app_private.can_view_referral(uuid), app_private.can_add_referral_photo(uuid),
  app_private.uuid_or_null(text), app_private.provider_reliability_raw(uuid), app_private.provider_trusted(uuid) to authenticated;
-- directory_search runs for anonymous visitors and calls org_docs_verified (security definer, returns only true/false).
grant execute on function app_private.org_docs_verified(uuid) to anon;
