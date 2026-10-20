-- Phases 5–6 · Activation status, scores, regional coverage, Growth contracts, analytics; Phase 7 schema only.

-- ---------------------------------------------------------------- settings
create table public.network_settings (
  network_id          uuid primary key references public.networks (id),
  partner_weights     jsonb not null default '{"volume":40,"rate":30,"consistency":20,"reliability":10}',
  provider_weights    jsonb not null default '{"response":30,"acceptance":25,"updates":20,"feedback":15,"reliability":10}',
  partner_min_volume  int not null default 3,
  provider_min_volume int not null default 3,
  volume_target       int not null default 6,
  inactive_after_days int not null default 60,
  growth_offer_text   text not null default '24 Qualified Remodeling Quote Requests in 90 Days.',
  growth_offer_approved boolean not null default false,
  updated_at          timestamptz not null default now()
);
insert into public.network_settings (network_id) select id from public.networks where slug = 'orlando';
alter table public.network_settings enable row level security;
create policy settings_read on public.network_settings for select to authenticated using (app_private.is_platform_admin());
create policy settings_write on public.network_settings for update to authenticated
  using (app_private.is_platform_admin()) with check (app_private.is_platform_admin());
revoke all on public.network_settings from anon;

-- ---------------------------------------------------------------- activation status (calculated by rules)
create or replace function public.organization_activation(p_org uuid)
returns text language sql stable security definer set search_path = '' as $$
  with o as (select * from public.organizations where id = p_org),
  s as (select inactive_after_days from public.network_settings ns join o on o.network_id = ns.network_id),
  q as (select max(r.qualified_at) as last_q from public.referrals r where r.source_org_id = p_org and r.qualified_at is not null)
  select case
    when o.status <> 'approved' then 'registered'
    when (select last_q from q) >= now() - interval '30 days' then 'productive'
    when (select last_q from q) is not null and (select last_q from q) < now() - make_interval(days => (select inactive_after_days from s)) then 'inactive'
    when exists (select 1 from public.organization_services x where x.org_id = p_org)
     and exists (select 1 from public.organization_service_areas x where x.org_id = p_org) then 'activated'
    else 'approved' end
  from o;
$$;

-- ---------------------------------------------------------------- scores
create table public.partner_score_snapshots (
  org_id             uuid not null references public.organizations (id) on delete cascade,
  period_end         date not null,
  submitted          int not null, qualified int not null,
  qualification_rate numeric(5,4), last_30 int not null, last_90 int not null,
  active_months      int not null, duplicate_rate numeric(5,4),
  score              numeric(5,1), level text not null,
  primary key (org_id, period_end)
);
create table public.provider_score_snapshots (
  org_id               uuid not null references public.organizations (id) on delete cascade,
  period_end           date not null,
  received             int not null, acceptance_rate numeric(5,4), avg_response_minutes numeric(10,1),
  update_rate          numeric(5,4), outcome_rate numeric(5,4), reliability numeric(5,4),
  score                numeric(5,1), level text not null,
  primary key (org_id, period_end)
);
alter table public.partner_score_snapshots  enable row level security;
alter table public.provider_score_snapshots enable row level security;
create policy partner_scores_read on public.partner_score_snapshots for select to authenticated
  using (app_private.is_org_member(org_id) or app_private.is_platform_admin());
create policy provider_scores_read on public.provider_score_snapshots for select to authenticated
  using (app_private.is_org_member(org_id) or app_private.is_platform_admin());
revoke all on public.partner_score_snapshots, public.provider_score_snapshots from anon;
revoke insert, update, delete on public.partner_score_snapshots, public.provider_score_snapshots from authenticated;

create or replace function app_private.level_for(p_score numeric, p_kind text)
returns text language sql immutable set search_path = '' as $$
  select case when p_score is null then 'not_enough_data'
              when p_score >= 80 then 'Elite ' || p_kind
              when p_score >= 60 then 'Pro ' || p_kind
              when p_score >= 40 then 'Active ' || p_kind
              else 'Starter ' || p_kind end;
$$;

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
  select o.id, d, m.received,
         case when m.answered_fit > 0 then m.accepted::numeric / m.answered_fit end,
         m.avg_minutes,
         case when m.accepted > 0 then m.updated::numeric / m.accepted end,
         case when m.accepted > 0 then m.outcomes::numeric / m.accepted end,
         case when m.received > 0 then 1 - m.stale::numeric / m.received end,
         sc.score, app_private.level_for(sc.score, 'Provider')
  from public.organizations o
  cross join lateral (
    select count(*) as received,
           count(*) filter (where a.status not in ('offered','withdrawn') and coalesce(a.decline_reason, '') <> 'not_a_fit') as answered_fit,
           count(*) filter (where a.status not in ('offered','declined','withdrawn')) as accepted,
           avg(extract(epoch from (a.responded_at - a.assigned_at)) / 60) filter (where a.responded_at is not null) as avg_minutes,
           count(*) filter (where a.status in ('contacted','estimate_scheduled','estimate_sent','won','lost')) as updated,
           count(*) filter (where a.status in ('won','lost')) as outcomes,
           count(*) filter (where a.status = 'offered' and a.assigned_at < now() - interval '48 hours') as stale
    from public.referral_assignments a where a.provider_org_id = o.id and a.assigned_at >= now() - interval '90 days') m
  cross join lateral (
    select case when m.received < st.provider_min_volume then null else round((
        greatest(0, least(1, 1 - (coalesce(m.avg_minutes, 2880) - 60) / (2880 - 60))) * (st.provider_weights ->> 'response')::numeric
      + coalesce(m.accepted::numeric / nullif(m.answered_fit, 0), 0) * (st.provider_weights ->> 'acceptance')::numeric
      + coalesce(m.updated::numeric / nullif(m.accepted, 0), 0) * (st.provider_weights ->> 'updates')::numeric
      + coalesce(m.outcomes::numeric / nullif(m.accepted, 0), 0) * (st.provider_weights ->> 'feedback')::numeric
      + (1 - coalesce(m.stale::numeric / nullif(m.received, 0), 0)) * (st.provider_weights ->> 'reliability')::numeric
    ), 1) end as score) sc
  where app_private.org_has_capability_any(o.id, 'receive')
  on conflict (org_id, period_end) do update set received = excluded.received, acceptance_rate = excluded.acceptance_rate,
    avg_response_minutes = excluded.avg_response_minutes, update_rate = excluded.update_rate, outcome_rate = excluded.outcome_rate,
    reliability = excluded.reliability, score = excluded.score, level = excluded.level;
end $$;

create or replace function public.my_ranking(p_org uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'partner', (select jsonb_build_object('score', s.score, 'level', s.level, 'qualified', s.qualified, 'last_30', s.last_30,
                  'rate', s.qualification_rate, 'period_end', s.period_end,
                  'position', case when s.score is null then null else
                     (select count(*) + 1 from public.partner_score_snapshots x where x.period_end = s.period_end and x.score > s.score) end,
                  'ranked', (select count(*) from public.partner_score_snapshots x where x.period_end = s.period_end and x.score is not null))
                from public.partner_score_snapshots s where s.org_id = p_org order by s.period_end desc limit 1),
    'provider', (select jsonb_build_object('score', s.score, 'level', s.level, 'received', s.received,
                  'acceptance', s.acceptance_rate, 'response_minutes', s.avg_response_minutes, 'period_end', s.period_end,
                  'position', case when s.score is null then null else
                     (select count(*) + 1 from public.provider_score_snapshots x where x.period_end = s.period_end and x.score > s.score) end,
                  'ranked', (select count(*) from public.provider_score_snapshots x where x.period_end = s.period_end and x.score is not null))
                 from public.provider_score_snapshots s where s.org_id = p_org order by s.period_end desc limit 1))
  where app_private.is_org_member(p_org) or app_private.is_platform_admin();
$$;

-- ---------------------------------------------------------------- Growth (service contract, separate from platform plans)
create type public.growth_status as enum ('active','completed','continuation_required','cancelled');
create table public.growth_contracts (
  id              uuid primary key default gen_random_uuid(),
  provider_org_id uuid not null references public.organizations (id),
  start_date      date not null,
  deadline        date generated always as (start_date + 90) stored,
  target          int not null default 24 check (target > 0),
  status          public.growth_status not null default 'active',
  offer_text      text not null,
  notes           text check (char_length(notes) <= 2000),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger growth_contracts_updated_at before update on public.growth_contracts for each row execute function public.set_updated_at();
create table public.growth_deliveries (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid not null references public.growth_contracts (id) on delete cascade,
  assignment_id uuid not null unique references public.referral_assignments (id) on delete cascade,
  referral_id   uuid not null references public.referrals (id) on delete cascade,
  delivered_at  timestamptz not null default now(),
  excluded      boolean not null default false,
  audit_note    text check (char_length(audit_note) <= 1000),
  unique (contract_id, referral_id)
);

-- A delivery counts only if: qualified referral, authorization granted, provider did not decline,
-- delivered inside the contract window, not excluded by audit. Quote requests only — not appointments or closed jobs.
create or replace view public.growth_contract_progress with (security_invoker = true) as
select c.id as contract_id, c.provider_org_id, o.name as provider_name, c.start_date, c.deadline, c.target, c.status,
       count(d.id) filter (where not d.excluded and r.qualified_at is not null
                            and a.status not in ('declined','withdrawn')
                            and d.delivered_at::date between c.start_date and c.deadline
                            and app_private.current_consent(r.id) = 'granted') as delivered,
       greatest(c.target - count(d.id) filter (where not d.excluded and r.qualified_at is not null
                            and a.status not in ('declined','withdrawn')
                            and d.delivered_at::date between c.start_date and c.deadline
                            and app_private.current_consent(r.id) = 'granted'), 0)::int as remaining,
       greatest(c.deadline - current_date, 0) as days_left
from public.growth_contracts c
join public.organizations o on o.id = c.provider_org_id
left join public.growth_deliveries d on d.contract_id = c.id
left join public.referral_assignments a on a.id = d.assignment_id
left join public.referrals r on r.id = d.referral_id
group by c.id, o.name;

alter table public.growth_contracts  enable row level security;
alter table public.growth_deliveries enable row level security;
create policy growth_contracts_read on public.growth_contracts for select to authenticated
  using (app_private.is_platform_admin() or app_private.has_org_role(provider_org_id, array['owner','manager']::public.member_role[]));
create policy growth_contracts_admin on public.growth_contracts for all to authenticated
  using (app_private.is_platform_admin()) with check (app_private.is_platform_admin());
create policy growth_deliveries_read on public.growth_deliveries for select to authenticated
  using (app_private.is_platform_admin() or exists (select 1 from public.growth_contracts c where c.id = contract_id
         and app_private.has_org_role(c.provider_org_id, array['owner','manager']::public.member_role[])));
create policy growth_deliveries_admin on public.growth_deliveries for update to authenticated
  using (app_private.is_platform_admin()) with check (app_private.is_platform_admin());
revoke all on public.growth_contracts, public.growth_deliveries from anon;
revoke insert, delete on public.growth_deliveries from authenticated;
revoke update on public.growth_deliveries from authenticated;
grant update (excluded, audit_note) on public.growth_deliveries to authenticated;
grant select on public.growth_contract_progress to authenticated;
revoke all on public.growth_contract_progress from anon;

create trigger audit_growth_contracts after insert or update or delete on public.growth_contracts
  for each row execute function public.audit_row_change();
create trigger audit_growth_deliveries after update on public.growth_deliveries
  for each row execute function public.audit_row_change();
create trigger audit_referral_assignments after insert or update on public.referral_assignments
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------- admin: organizations
create or replace function public.admin_set_verification(p_org uuid, p_status public.verification_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.organizations set verification = p_status where id = p_org;
end $$;

create or replace function public.admin_create_organization(p_name text, p_email text, p_phone text, p_city text, p_state text, p_zip text,
                                                           p_refer boolean, p_receive boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_network uuid;
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select id into v_network from public.networks where slug = 'orlando';
  insert into public.organizations (network_id, name, slug, email, phone, city, state, zip, referral_code, created_by)
  values (v_network, trim(p_name),
          trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
          nullif(trim(p_email), ''), nullif(trim(p_phone), ''), nullif(trim(p_city), ''), upper(nullif(trim(p_state), '')),
          nullif(trim(p_zip), ''), substr(replace(gen_random_uuid()::text, '-', ''), 1, 10), auth.uid())
  returning id into v_org;
  if p_refer then insert into public.organization_capabilities (org_id, capability) values (v_org, 'refer'); end if;
  if p_receive then insert into public.organization_capabilities (org_id, capability) values (v_org, 'receive'); end if;
  return v_org;
end $$;

-- Owner-less organizations (created by admin) can be claimed later by invitation; the owner guard skips them.

-- ---------------------------------------------------------------- analytics (real data only)
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total_orgs', (select count(*) from public.organizations where deleted_at is null),
    'partners', (select count(*) from public.organizations o where app_private.org_has_capability_any(o.id, 'refer')),
    'providers', (select count(*) from public.organizations o where app_private.org_has_capability_any(o.id, 'receive')),
    'pending_orgs', (select count(*) from public.organizations where status = 'pending_review' and deleted_at is null),
    'new_referrals_7d', (select count(*) from public.referrals where created_at >= now() - interval '7 days'),
    'qualified_30d', (select count(*) from public.referrals where qualified_at >= now() - interval '30 days'),
    'consent_pending', (select count(*) from public.referrals where status = 'consent_pending'),
    'under_review', (select count(*) from public.referrals where status = 'under_review'),
    'unmatched', (select count(*) from public.referrals where status in ('qualified','matching')),
    'no_response', (select count(*) from public.referral_assignments where status = 'offered' and assigned_at < now() - interval '24 hours'),
    'growth_behind', (select count(*) from public.growth_contract_progress p where p.status = 'active'
                       and p.delivered < p.target * least(1, (current_date - p.start_date)::numeric / 90) * 0.8))
  into v;
  return v;
end $$;

create or replace function public.admin_analytics(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; since timestamptz := now() - make_interval(days => p_days);
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  with productive as (
    select distinct r.source_org_id from public.referrals r where r.qualified_at >= since and r.source_org_id is not null)
  select jsonb_build_object(
    'days', p_days,
    'registered', (select count(*) from public.organizations where created_at >= since),
    'approved', (select count(*) from public.organizations where status = 'approved'),
    'activated', (select count(*) from public.organizations o where public.organization_activation(o.id) in ('activated','productive')),
    'productive_partners', (select count(*) from productive),
    'submitted', (select count(*) from public.referrals where created_at >= since),
    'qualified', (select count(*) from public.referrals where qualified_at >= since),
    'rejected', (select count(*) from public.referrals where status = 'rejected' and closed_at >= since),
    'qualified_per_productive_partner_per_month', (
      select round(count(*)::numeric / nullif((select count(*) from productive), 0) / greatest(p_days / 30.0, 1), 2)
      from public.referrals where qualified_at >= since and source_org_id in (select source_org_id from productive)),
    'unmatched', (select count(*) from public.referrals where status in ('qualified','matching')),
    'avg_hours_to_assignment', (select round(avg(extract(epoch from a.assigned_at - r.qualified_at)) / 3600, 1)
                                from public.referral_assignments a join public.referrals r on r.id = a.referral_id
                                where a.assigned_at >= since and r.qualified_at is not null),
    'provider_acceptance_rate', (select round(count(*) filter (where status not in ('offered','declined','withdrawn'))::numeric
                                 / nullif(count(*) filter (where status <> 'offered'), 0), 3)
                                 from public.referral_assignments where assigned_at >= since),
    'growth_delivered', (select coalesce(sum(delivered), 0) from public.growth_contract_progress where status = 'active'))
  into v;
  return v;
end $$;

create or replace function public.admin_regional_coverage()
returns table (city text, service text, partners bigint, productive_partners bigint, providers bigint,
               qualified_90d bigint, unmatched bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select g.city, c.name,
    (select count(distinct a.org_id) from public.organization_service_areas a
      where a.region_id = g.id and app_private.org_has_capability_any(a.org_id, 'refer')),
    (select count(distinct r.source_org_id) from public.referrals r
      where lower(r.city) = lower(g.city) and r.category_id = c.id and r.qualified_at >= now() - interval '30 days'),
    (select count(distinct a.org_id) from public.organization_service_areas a
      join public.organization_services s on s.org_id = a.org_id and s.category_id = c.id and s.kind = 'offered'
      where a.region_id = g.id and app_private.org_has_capability_any(a.org_id, 'receive')),
    (select count(*) from public.referrals r where lower(r.city) = lower(g.city) and r.category_id = c.id
      and r.qualified_at >= now() - interval '90 days'),
    (select count(*) from public.referrals r where lower(r.city) = lower(g.city) and r.category_id = c.id
      and r.status in ('qualified','matching'))
  from public.regions g cross join public.service_categories c
  where g.active and c.active
  order by g.sort, c.sort;
end $$;

create or replace function public.admin_relationships()
returns table (org_a text, org_b text, status public.connection_status, connected_at timestamptz,
               referrals_exchanged bigint, last_activity timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select a.name, b.name, x.status, coalesce(x.responded_at, x.created_at),
    (select count(*) from public.referrals r join public.referral_assignments s on s.referral_id = r.id
      where (r.source_org_id = x.requester_org and s.provider_org_id = x.addressee_org)
         or (r.source_org_id = x.addressee_org and s.provider_org_id = x.requester_org)),
    greatest(x.updated_at, (select max(s.last_update_at) from public.referrals r join public.referral_assignments s on s.referral_id = r.id
      where (r.source_org_id = x.requester_org and s.provider_org_id = x.addressee_org)
         or (r.source_org_id = x.addressee_org and s.provider_org_id = x.requester_org)))
  from public.organization_connections x
  join public.organizations a on a.id = x.requester_org
  join public.organizations b on b.id = x.addressee_org
  order by 6 desc nulls last;
end $$;

-- ---------------------------------------------------------------- Phase 7 (schema only, no checkout)
create table public.plans (
  id uuid primary key default gen_random_uuid(), code text not null unique check (code in ('free_network','pro_network','business_network')),
  name text not null, active boolean not null default false, created_at timestamptz not null default now());
insert into public.plans (code, name, active) values ('free_network','Free Network', true), ('pro_network','Pro Network', false),
  ('business_network','Business Network', false);
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations (id) on delete cascade,
  plan_id uuid not null references public.plans (id), status text not null default 'active',
  current_period_end timestamptz, created_at timestamptz not null default now());
create table public.entitlements (
  plan_id uuid not null references public.plans (id), feature text not null, value jsonb not null default 'true',
  primary key (plan_id, feature));
create table public.usage_limits (
  org_id uuid not null references public.organizations (id) on delete cascade, feature text not null,
  period_start date not null, used int not null default 0, primary key (org_id, feature, period_start));
create table public.billing_events (
  id bigint generated always as identity primary key, org_id uuid references public.organizations (id) on delete set null,
  type text not null, payload jsonb not null default '{}', created_at timestamptz not null default now());
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;
alter table public.usage_limits enable row level security;
alter table public.billing_events enable row level security;
create policy plans_read on public.plans for select to authenticated using (true);
create policy subscriptions_read on public.subscriptions for select to authenticated
  using (app_private.is_org_member(org_id) or app_private.is_platform_admin());
create policy billing_admin on public.billing_events for select to authenticated using (app_private.is_platform_admin());
revoke all on public.plans, public.subscriptions, public.entitlements, public.usage_limits, public.billing_events from anon;
revoke insert, update, delete on public.plans, public.subscriptions, public.entitlements, public.usage_limits, public.billing_events from authenticated;


-- ---------------------------------------------------------------- team members (existing accounts only; e-mail invites come with transactional e-mail)
create or replace function public.add_member_by_email(p_org uuid, p_email text, p_role public.member_role default 'member')
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not (app_private.has_org_role(p_org, array['owner','manager']::public.member_role[]) or app_private.is_platform_admin()) then
    raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_role = 'owner' and not (app_private.has_org_role(p_org, array['owner']::public.member_role[]) or app_private.is_platform_admin()) then
    raise exception 'Only owners can add owners' using errcode = '42501'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'No account uses that email yet. Ask them to create an account first.' using errcode = 'P0002'; end if;
  insert into public.organization_members (org_id, user_id, role) values (p_org, v_user, p_role)
  on conflict (org_id, user_id) do update set role = excluded.role;
end $$;

create or replace function public.org_team(p_org uuid)
returns table (user_id uuid, full_name text, email text, role public.member_role, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.full_name, u.email::text, m.role, m.created_at
  from public.organization_members m join public.profiles p on p.id = m.user_id join auth.users u on u.id = m.user_id
  where m.org_id = p_org and (app_private.is_org_member(p_org) or app_private.is_platform_admin())
  order by m.created_at;
$$;

-- ---------------------------------------------------------------- privileges for this migration's functions
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('organization_activation','compute_scores','my_ranking',
             'admin_set_verification','admin_create_organization','admin_overview','admin_analytics',
             'admin_regional_coverage','admin_relationships','add_member_by_email','org_team')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
revoke execute on function app_private.level_for(numeric, text) from public, anon;
grant  execute on function app_private.level_for(numeric, text) to authenticated;

-- Scores are recalculated from Admin → Rankings ("Recalculate"). A nightly pg_cron job can be added later.
