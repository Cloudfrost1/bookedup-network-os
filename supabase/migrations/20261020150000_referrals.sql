-- Phases 3–4 · Referrals, consent, qualification, matching, assignment, provider pipeline, notifications.

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  org_id     uuid references public.organizations (id) on delete cascade,
  for_admins boolean not null default false,
  type       text not null,
  title      text not null,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  check (user_id is not null or org_id is not null or for_admins)
);
create index notifications_org_idx on public.notifications (org_id, created_at desc);
create index notifications_admin_idx on public.notifications (for_admins, created_at desc) where for_admins;

create table public.consent_text_versions (
  id          uuid primary key default gen_random_uuid(),
  version     text not null unique,
  purpose     text not null,
  body        text not null,
  active_from timestamptz not null default now(),
  active      boolean not null default true
);
insert into public.consent_text_versions (version, purpose, body) values
('homeowner-2026-10', 'homeowner_form',
 'I authorize BookedUp to share my name, phone, email and project details with up to one qualified local service provider so they can contact me about this project. I can withdraw this authorization at any time.'),
('partner-2026-10', 'partner_attested',
 'I confirm the homeowner asked for help with this project and authorized my business to share their contact details with BookedUp. BookedUp will confirm with the homeowner before sharing them with any provider.');

create type public.referral_status as enum
  ('submitted','consent_pending','under_review','qualified','matching','assigned','closed','rejected');
create type public.referral_channel as enum ('direct','link','partner_direct','admin');
create type public.consent_status as enum ('pending','granted','revoked');
create type public.consent_source as enum ('homeowner_form','partner_attested','admin_verified');
create type public.assignment_status as enum
  ('offered','accepted','declined','contacted','estimate_scheduled','estimate_sent','won','lost','withdrawn');

create sequence public.referral_number_seq start 1001;

create table public.referrals (
  id                        uuid primary key default gen_random_uuid(),
  number                    bigint not null unique default nextval('public.referral_number_seq'),
  network_id                uuid not null references public.networks (id),
  source_org_id             uuid references public.organizations (id) on delete set null,
  source_user_id            uuid references auth.users (id) on delete set null,
  channel                   public.referral_channel not null,
  suggested_provider_org_id uuid references public.organizations (id) on delete set null,
  category_id               uuid not null references public.service_categories (id),
  city                      text not null check (char_length(city) <= 80),
  zip                       text not null check (zip ~ '^[0-9]{5}$'),
  description               text not null check (char_length(description) between 10 and 3000),
  timeline                  text check (timeline in ('asap','1-3_months','3-6_months','flexible')),
  status                    public.referral_status not null default 'submitted',
  checklist                 jsonb not null default '{}'::jsonb,
  qualified_by              uuid references auth.users (id) on delete set null,
  qualified_at              timestamptz,
  qualification_notes       text check (char_length(qualification_notes) <= 2000),
  duplicate_of              uuid references public.referrals (id) on delete set null,
  closed_at                 timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index referrals_source_idx on public.referrals (source_org_id, created_at desc);
create index referrals_status_idx on public.referrals (status, created_at);
create trigger referrals_updated_at before update on public.referrals for each row execute function public.set_updated_at();

create table public.homeowner_contacts (
  referral_id uuid primary key references public.referrals (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 120),
  phone       text check (char_length(phone) <= 32),
  email       text check (char_length(email) <= 254),
  address     text check (char_length(address) <= 300),
  phone_norm  text generated always as (nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')) stored,
  email_norm  text generated always as (nullif(lower(trim(coalesce(email, ''))), '')) stored,
  created_at  timestamptz not null default now(),
  check (phone is not null or email is not null)
);
create index homeowner_contacts_phone_idx on public.homeowner_contacts (phone_norm);
create index homeowner_contacts_email_idx on public.homeowner_contacts (email_norm);

create table public.consent_records (
  id              uuid primary key default gen_random_uuid(),
  seq             bigint generated always as identity unique,
  referral_id     uuid not null references public.referrals (id) on delete cascade,
  status          public.consent_status not null,
  source          public.consent_source not null,
  text_version_id uuid references public.consent_text_versions (id),
  granted_at      timestamptz,
  revoked_at      timestamptz,
  recorded_by     uuid references auth.users (id) on delete set null,
  ip_hash         text,
  user_agent      text check (char_length(user_agent) <= 300),
  created_at      timestamptz not null default now()
);
create index consent_records_referral_idx on public.consent_records (referral_id, created_at desc);

create table public.referral_assignments (
  id               uuid primary key default gen_random_uuid(),
  referral_id      uuid not null references public.referrals (id) on delete cascade,
  provider_org_id  uuid not null references public.organizations (id) on delete cascade,
  suggested_by     text check (suggested_by in ('rules','referrer','admin')),
  assigned_by      uuid references auth.users (id) on delete set null,
  assigned_at      timestamptz not null default now(),
  status           public.assignment_status not null default 'offered',
  responded_at     timestamptz,
  decline_reason   text check (decline_reason in ('not_a_fit','no_capacity','outside_area','other')),
  first_contact_at timestamptz,
  estimated_value  numeric(12,2) check (estimated_value >= 0),
  notes            text check (char_length(notes) <= 4000),
  outcome_at       timestamptz,
  last_update_at   timestamptz not null default now(),
  unique (referral_id, provider_org_id)
);
create index referral_assignments_provider_idx on public.referral_assignments (provider_org_id, status);

create table public.referral_events (
  id            bigint generated always as identity primary key,
  referral_id   uuid not null references public.referrals (id) on delete cascade,
  assignment_id uuid references public.referral_assignments (id) on delete cascade,
  from_status   text,
  to_status     text not null,
  actor_id      uuid,
  note          text check (char_length(note) <= 1000),
  created_at    timestamptz not null default now()
);
create index referral_events_referral_idx on public.referral_events (referral_id, created_at);

create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------- RLS
alter table public.notifications         enable row level security;
alter table public.consent_text_versions enable row level security;
alter table public.referrals             enable row level security;
alter table public.homeowner_contacts    enable row level security;
alter table public.consent_records       enable row level security;
alter table public.referral_assignments  enable row level security;
alter table public.referral_events       enable row level security;
alter table public.rate_limits           enable row level security;

create policy notifications_read on public.notifications for select to authenticated
  using (user_id = auth.uid() or (org_id is not null and app_private.is_org_member(org_id))
         or (for_admins and app_private.is_platform_admin()));
create policy consent_texts_read on public.consent_text_versions for select to anon, authenticated using (active);
create policy consent_texts_admin on public.consent_text_versions for all to authenticated
  using (app_private.is_platform_admin()) with check (app_private.is_platform_admin());
-- Referrer sees its own referrals; admins see all. Providers use list_my_opportunities() instead.
create policy referrals_read on public.referrals for select to authenticated
  using ((source_org_id is not null and app_private.is_org_member(source_org_id)) or app_private.is_platform_admin());
-- Homeowner contacts: admins only through RLS; providers through get_opportunity_contact().
create policy contacts_admin on public.homeowner_contacts for select to authenticated using (app_private.is_platform_admin());
create policy consent_admin on public.consent_records for select to authenticated using (app_private.is_platform_admin());
create policy assignments_admin on public.referral_assignments for select to authenticated using (app_private.is_platform_admin());
create policy events_read on public.referral_events for select to authenticated
  using (app_private.is_platform_admin() or exists (
    select 1 from public.referrals r where r.id = referral_id and r.source_org_id is not null and app_private.is_org_member(r.source_org_id)));

revoke all on public.notifications, public.referrals, public.homeowner_contacts, public.consent_records,
              public.referral_assignments, public.referral_events, public.rate_limits from anon;
revoke insert, update, delete on public.notifications, public.referrals, public.homeowner_contacts,
              public.consent_records, public.referral_assignments, public.referral_events, public.rate_limits from authenticated;
revoke all on public.rate_limits from authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid() or (org_id is not null and app_private.is_org_member(org_id))
         or (for_admins and app_private.is_platform_admin()))
  with check (true);

-- ---------------------------------------------------------------- internal helpers
create or replace function app_private.hit_rate_limit(p_key text, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));
        v_hits int;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits > p_max;
end $$;

create or replace function app_private.log_referral_event(p_referral uuid, p_assignment uuid, p_from text, p_to text, p_note text)
returns void language sql security definer set search_path = '' as $$
  insert into public.referral_events (referral_id, assignment_id, from_status, to_status, actor_id, note)
  values (p_referral, p_assignment, p_from, p_to, auth.uid(), left(p_note, 1000));
$$;

create or replace function app_private.set_referral_status(p_referral uuid, p_to public.referral_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_from public.referral_status;
begin
  select status into v_from from public.referrals where id = p_referral for update;
  if v_from is distinct from p_to then
    update public.referrals set status = p_to,
      closed_at = case when p_to in ('closed','rejected') then now() else closed_at end
    where id = p_referral;
    perform app_private.log_referral_event(p_referral, null, v_from::text, p_to::text, p_note);
  end if;
end $$;

create or replace function app_private.current_consent(p_referral uuid)
returns public.consent_status language sql stable security definer set search_path = '' as $$
  select coalesce((select c.status from public.consent_records c where c.referral_id = p_referral
                   order by c.seq desc limit 1), 'pending');
$$;

revoke execute on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated;
grant execute on function app_private.org_has_capability_any(uuid, public.org_capability) to anon;

-- ---------------------------------------------------------------- submit: business sends a referral (Method A / partner direct)
create or replace function public.submit_referral(
  p_org uuid, p_category uuid, p_city text, p_zip text, p_description text, p_timeline text,
  p_name text, p_phone text, p_email text, p_address text, p_attested boolean, p_suggested_provider uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_text uuid;
begin
  if not app_private.is_org_member(p_org) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not app_private.org_has_capability(p_org, 'refer') then
    raise exception 'Your business is not approved to refer projects yet' using errcode = '42501'; end if;
  if not coalesce(p_attested, false) then
    raise exception 'Confirm the homeowner authorized sharing their details' using errcode = '22023'; end if;
  if app_private.hit_rate_limit('referral:org:' || p_org, 60, interval '1 day') then
    raise exception 'Too many referrals today. Try again tomorrow.' using errcode = '54000'; end if;
  if p_suggested_provider is not null and (p_suggested_provider = p_org or not app_private.org_has_capability_any(p_suggested_provider, 'receive')) then
    p_suggested_provider := null;
  end if;

  insert into public.referrals (network_id, source_org_id, source_user_id, channel, suggested_provider_org_id,
                                category_id, city, zip, description, timeline, status)
  select o.network_id, p_org, auth.uid(),
         case when p_suggested_provider is null then 'direct' else 'partner_direct' end::public.referral_channel,
         p_suggested_provider, p_category, trim(p_city), trim(p_zip), trim(p_description), p_timeline, 'consent_pending'
  from public.organizations o where o.id = p_org
  returning id into v_id;

  insert into public.homeowner_contacts (referral_id, name, phone, email, address)
  values (v_id, trim(p_name), nullif(trim(p_phone), ''), nullif(trim(p_email), ''), nullif(trim(p_address), ''));

  select id into v_text from public.consent_text_versions where purpose = 'partner_attested' and active order by active_from desc limit 1;
  insert into public.consent_records (referral_id, status, source, text_version_id, recorded_by)
  values (v_id, 'pending', 'partner_attested', v_text, auth.uid());

  perform app_private.log_referral_event(v_id, null, null, 'consent_pending', 'Submitted by partner');
  insert into public.notifications (for_admins, type, title, link)
  values (true, 'referral_received', 'New referral needs consent confirmation', '/admin/referrals/' || v_id);
  return v_id;
end $$;

-- ---------------------------------------------------------------- public link (Method B): homeowner fills the form
create or replace function public.referral_link_info(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', o.name, 'consent_version', (
           select v.version from public.consent_text_versions v where v.purpose = 'homeowner_form' and v.active
           order by v.active_from desc limit 1),
         'consent_text', (
           select v.body from public.consent_text_versions v where v.purpose = 'homeowner_form' and v.active
           order by v.active_from desc limit 1))
  from public.organizations o
  where o.referral_code = p_code and app_private.org_has_capability_any(o.id, 'refer');
$$;

create or replace function public.submit_public_referral(
  p_code text, p_category uuid, p_city text, p_zip text, p_description text, p_timeline text,
  p_name text, p_phone text, p_email text, p_consent boolean, p_consent_version text,
  p_ip_hash text, p_user_agent text
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_id uuid; v_num bigint; v_text uuid;
begin
  select o.id into v_org from public.organizations o
  where o.referral_code = p_code and app_private.org_has_capability_any(o.id, 'refer');
  if v_org is null then raise exception 'This referral link is not active' using errcode = 'P0002'; end if;
  if not coalesce(p_consent, false) then raise exception 'Authorization is required' using errcode = '22023'; end if;
  if app_private.hit_rate_limit('public:ip:' || coalesce(p_ip_hash, 'none'), 5, interval '1 hour')
     or app_private.hit_rate_limit('public:code:' || p_code, 30, interval '1 hour') then
    raise exception 'Too many requests. Please try again later.' using errcode = '54000'; end if;

  select id into v_text from public.consent_text_versions
  where purpose = 'homeowner_form' and version = p_consent_version;
  if v_text is null then raise exception 'Consent text changed. Reload the page.' using errcode = '22023'; end if;

  insert into public.referrals (network_id, source_org_id, channel, category_id, city, zip, description, timeline, status)
  select o.network_id, v_org, 'link', p_category, trim(p_city), trim(p_zip), trim(p_description), p_timeline, 'under_review'
  from public.organizations o where o.id = v_org
  returning id, number into v_id, v_num;

  insert into public.homeowner_contacts (referral_id, name, phone, email)
  values (v_id, trim(p_name), nullif(trim(p_phone), ''), nullif(trim(p_email), ''));
  insert into public.consent_records (referral_id, status, source, text_version_id, granted_at, ip_hash, user_agent)
  values (v_id, 'granted', 'homeowner_form', v_text, now(), p_ip_hash, left(p_user_agent, 300));

  perform app_private.log_referral_event(v_id, null, null, 'under_review', 'Submitted by homeowner via referral link');
  insert into public.notifications (for_admins, type, title, link)
  values (true, 'referral_received', 'New referral from a homeowner link', '/admin/referrals/' || v_id);
  insert into public.notifications (org_id, type, title, link)
  values (v_org, 'referral_received', 'A homeowner used your referral link', '/app/referrals');
  return v_num;
end $$;

-- ---------------------------------------------------------------- admin: consent, qualification, matching, assignment
create or replace function public.admin_confirm_consent(p_referral uuid, p_granted boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.consent_records (referral_id, status, source, granted_at, revoked_at, recorded_by)
  values (p_referral, case when p_granted then 'granted' else 'revoked' end::public.consent_status, 'admin_verified',
          case when p_granted then now() end, case when not p_granted then now() end, auth.uid());
  perform app_private.set_referral_status(p_referral, case when p_granted then 'under_review' else 'rejected' end::public.referral_status,
                                          coalesce(p_note, case when p_granted then 'Homeowner confirmed authorization' else 'Homeowner did not authorize' end));
end $$;

create or replace function public.referral_duplicates(p_referral uuid)
returns table (id uuid, number bigint, status public.referral_status, created_at timestamptz, reason text)
language sql stable security definer set search_path = '' as $$
  select r2.id, r2.number, r2.status, r2.created_at,
         case when c2.phone_norm = c1.phone_norm then 'same phone'
              when c2.email_norm = c1.email_norm then 'same email' else 'same address' end
  from public.referrals r1
  join public.homeowner_contacts c1 on c1.referral_id = r1.id
  join public.homeowner_contacts c2 on c2.referral_id <> r1.id
       and (c2.phone_norm = c1.phone_norm or c2.email_norm = c1.email_norm
            or (c1.address is not null and lower(c2.address) = lower(c1.address)))
  join public.referrals r2 on r2.id = c2.referral_id
  where r1.id = p_referral and app_private.is_platform_admin()
    and r2.category_id = r1.category_id
    and r2.created_at between r1.created_at - interval '60 days' and r1.created_at + interval '60 days'
  order by r2.created_at;
$$;

create or replace function public.admin_qualify_referral(p_referral uuid, p_checklist jsonb, p_decision text, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare k text; v_all boolean := true;
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  foreach k in array array['owner_or_authorized','real_request','service_match','location_served','valid_contact','authorized','not_duplicate'] loop
    if coalesce((p_checklist ->> k)::boolean, false) is not true then v_all := false; end if;
  end loop;
  if p_decision = 'qualified' then
    if not v_all then raise exception 'All 7 criteria must be checked to qualify' using errcode = '22023'; end if;
    if app_private.current_consent(p_referral) <> 'granted' then
      raise exception 'Homeowner authorization is not confirmed yet' using errcode = '22023'; end if;
    update public.referrals set checklist = p_checklist, qualified_by = auth.uid(), qualified_at = now(),
      qualification_notes = p_notes where id = p_referral;
    perform app_private.set_referral_status(p_referral, 'qualified', p_notes);
    insert into public.notifications (org_id, type, title, link)
    select source_org_id, 'referral_qualified', 'Your referral #' || number || ' was qualified', '/app/referrals'
    from public.referrals where id = p_referral and source_org_id is not null;
  elsif p_decision = 'rejected' then
    update public.referrals set checklist = p_checklist, qualification_notes = p_notes,
      duplicate_of = nullif(p_checklist ->> 'duplicate_of', '')::uuid where id = p_referral;
    perform app_private.set_referral_status(p_referral, 'rejected', p_notes);
  else
    raise exception 'Unknown decision' using errcode = '22023';
  end if;
end $$;

create or replace function public.admin_match_suggestions(p_referral uuid)
returns table (org_id uuid, name text, city text, verified boolean, suggested_by_referrer boolean,
               covers_city boolean, open_assignments bigint, provider_score numeric, growth_remaining int)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query
  select o.id, o.name, o.city, o.verification = 'verified', o.id = r.suggested_provider_org_id,
         exists (select 1 from public.organization_service_areas a join public.regions g on g.id = a.region_id
                 where a.org_id = o.id and lower(g.city) = lower(r.city)),
         (select count(*) from public.referral_assignments x where x.provider_org_id = o.id and x.status in ('offered','accepted','contacted')),
         (select s.score from public.provider_score_snapshots s where s.org_id = o.id order by s.period_end desc limit 1),
         (select gp.remaining from public.growth_contract_progress gp where gp.provider_org_id = o.id and gp.status = 'active' limit 1)
  from public.referrals r
  join public.organization_services s on s.category_id = r.category_id and s.kind = 'offered'
  join public.organizations o on o.id = s.org_id
  where r.id = p_referral and app_private.is_platform_admin()
    and o.id is distinct from r.source_org_id
    and o.available_for_referrals
    and app_private.org_has_capability_any(o.id, 'receive')
    and not exists (select 1 from public.referral_assignments x where x.referral_id = r.id and x.provider_org_id = o.id)
  order by (o.id = r.suggested_provider_org_id) desc,
           exists (select 1 from public.organization_service_areas a join public.regions g on g.id = a.region_id
                   where a.org_id = o.id and lower(g.city) = lower(r.city)) desc,
           (o.verification = 'verified') desc, o.name;
end $$;

create or replace function public.admin_assign_referral(p_referral uuid, p_provider uuid, p_suggested_by text default 'admin')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_status public.referral_status; v_contract uuid;
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select status into v_status from public.referrals where id = p_referral;
  if v_status not in ('qualified','matching') then raise exception 'Only qualified referrals can be assigned' using errcode = '22023'; end if;
  if app_private.current_consent(p_referral) <> 'granted' then raise exception 'Authorization is not confirmed' using errcode = '22023'; end if;
  if not app_private.org_has_capability_any(p_provider, 'receive') then raise exception 'Provider is not approved to receive' using errcode = '22023'; end if;
  -- One active provider at a time: no distribution of personal data to competing businesses.
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
  values (p_provider, 'opportunity_assigned', 'New opportunity available', '/app/opportunities/' || v_id);
  return v_id;
end $$;

create or replace function public.admin_close_referral(p_referral uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  perform app_private.set_referral_status(p_referral, 'closed', p_note);
end $$;

-- ---------------------------------------------------------------- provider side
create or replace function public.list_my_opportunities(p_org uuid)
returns table (assignment_id uuid, referral_number bigint, service text, city text, zip text, description text,
               timeline text, status public.assignment_status, assigned_at timestamptz, estimated_value numeric)
language sql stable security definer set search_path = '' as $$
  select a.id, r.number, c.name, r.city, r.zip, r.description, r.timeline, a.status, a.assigned_at, a.estimated_value
  from public.referral_assignments a
  join public.referrals r on r.id = a.referral_id
  join public.service_categories c on c.id = r.category_id
  where a.provider_org_id = p_org and app_private.is_org_member(p_org)
    and a.status <> 'withdrawn'
  order by a.assigned_at desc;
$$;

create or replace function public.get_opportunity(p_assignment uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; v_org uuid; v_status public.assignment_status; v_ref uuid;
begin
  select provider_org_id, status, referral_id into v_org, v_status, v_ref from public.referral_assignments where id = p_assignment;
  if v_org is null or not app_private.is_org_member(v_org) then return null; end if;
  select jsonb_build_object(
    'assignment_id', a.id, 'org_id', a.provider_org_id, 'number', r.number, 'service', c.name, 'city', r.city, 'zip', r.zip,
    'description', r.description, 'timeline', r.timeline, 'status', a.status, 'assigned_at', a.assigned_at,
    'responded_at', a.responded_at, 'first_contact_at', a.first_contact_at, 'estimated_value', a.estimated_value,
    'notes', a.notes,
    'events', coalesce((select jsonb_agg(jsonb_build_object('to', e.to_status, 'at', e.created_at) order by e.created_at)
                        from public.referral_events e where e.assignment_id = a.id), '[]'::jsonb))
  into v
  from public.referral_assignments a join public.referrals r on r.id = a.referral_id
  join public.service_categories c on c.id = r.category_id where a.id = p_assignment;
  return v;
end $$;

create or replace function public.get_opportunity_contact(p_assignment uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_status public.assignment_status; v_ref uuid; v jsonb;
begin
  select provider_org_id, status, referral_id into v_org, v_status, v_ref from public.referral_assignments where id = p_assignment;
  if v_org is null or not app_private.is_org_member(v_org) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if v_status in ('offered','declined','withdrawn') then raise exception 'Accept the opportunity to see contact details' using errcode = '42501'; end if;
  if app_private.current_consent(v_ref) <> 'granted' then raise exception 'Authorization was withdrawn' using errcode = '42501'; end if;
  select jsonb_build_object('name', h.name, 'phone', h.phone, 'email', h.email, 'address', h.address)
  into v from public.homeowner_contacts h where h.referral_id = v_ref;
  insert into public.audit_logs (actor_id, action, entity, entity_id, org_id, metadata)
  values (auth.uid(), 'contact_viewed', 'referral_assignments', p_assignment, v_org, '{}'::jsonb);
  return v;
end $$;

create or replace function public.provider_respond(p_assignment uuid, p_accept boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  select * into a from public.referral_assignments where id = p_assignment for update;
  if a.id is null or not app_private.is_org_member(a.provider_org_id)
     or not app_private.org_has_capability(a.provider_org_id, 'receive') then
    raise exception 'Not allowed' using errcode = '42501'; end if;
  if a.status <> 'offered' then raise exception 'This opportunity was already answered' using errcode = '22023'; end if;
  if p_accept then
    update public.referral_assignments set status = 'accepted', responded_at = now(), last_update_at = now() where id = p_assignment;
    perform app_private.log_referral_event(a.referral_id, a.id, 'offered', 'accepted', null);
  else
    update public.referral_assignments set status = 'declined', responded_at = now(), last_update_at = now(),
      decline_reason = coalesce(p_reason, 'other') where id = p_assignment;
    perform app_private.log_referral_event(a.referral_id, a.id, 'offered', 'declined', p_reason);
    perform app_private.set_referral_status(a.referral_id, 'matching', 'Provider declined');
    insert into public.notifications (for_admins, type, title, link)
    values (true, 'opportunity_declined', 'A provider declined an opportunity', '/admin/referrals/' || a.referral_id);
  end if;
end $$;

create or replace function public.provider_update(p_assignment uuid, p_status public.assignment_status,
                                                  p_estimated_value numeric default null, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  select * into a from public.referral_assignments where id = p_assignment for update;
  if a.id is null or not app_private.is_org_member(a.provider_org_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if a.status in ('offered','declined','withdrawn') then raise exception 'Accept the opportunity first' using errcode = '22023'; end if;
  if p_status not in ('contacted','estimate_scheduled','estimate_sent','won','lost') and p_status <> a.status then
    raise exception 'Invalid status' using errcode = '22023'; end if;
  update public.referral_assignments set
    status = p_status,
    first_contact_at = coalesce(first_contact_at, case when p_status <> 'accepted' then now() end),
    estimated_value = coalesce(p_estimated_value, estimated_value),
    notes = coalesce(p_notes, notes),
    outcome_at = case when p_status in ('won','lost') then now() else outcome_at end,
    last_update_at = now()
  where id = p_assignment;
  if p_status <> a.status then
    perform app_private.log_referral_event(a.referral_id, a.id, a.status::text, p_status::text, null);
  end if;
  if p_status in ('won','lost') then perform app_private.set_referral_status(a.referral_id, 'closed', 'Outcome: ' || p_status); end if;
end $$;

create or replace function public.my_referrals(p_org uuid)
returns table (id uuid, number bigint, service text, city text, status public.referral_status, channel public.referral_channel,
               created_at timestamptz, provider_name text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.number, c.name, r.city, r.status, r.channel, r.created_at,
         (select o.name from public.referral_assignments a join public.organizations o on o.id = a.provider_org_id
          where a.referral_id = r.id and a.status not in ('declined','withdrawn','offered') order by a.assigned_at desc limit 1)
  from public.referrals r join public.service_categories c on c.id = r.category_id
  where r.source_org_id = p_org and app_private.is_org_member(p_org)
  order by r.created_at desc;
$$;

-- ---------------------------------------------------------------- execute privileges
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('submit_referral','admin_confirm_consent','referral_duplicates',
             'admin_qualify_referral','admin_match_suggestions','admin_assign_referral','admin_close_referral',
             'list_my_opportunities','get_opportunity','get_opportunity_contact','provider_respond','provider_update','my_referrals')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
revoke execute on function public.referral_link_info(text) from public;
grant  execute on function public.referral_link_info(text) to anon, authenticated;
revoke execute on function public.submit_public_referral(text, uuid, text, text, text, text, text, text, text, boolean, text, text, text) from public;
grant  execute on function public.submit_public_referral(text, uuid, text, text, text, text, text, text, text, boolean, text, text, text) to anon, authenticated;
