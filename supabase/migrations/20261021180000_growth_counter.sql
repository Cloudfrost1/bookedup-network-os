-- Growth counter: deliveries count automatically; BookedUp can also adjust manually (with a reason) and edit the target.

-- 1. automatic: a delivery counts as soon as it's sent (referral already qualified + authorized); admin can still
--    move it to under_dispute / invalidated / replacement_required.
alter table public.growth_deliveries alter column validation set default 'qualified';

-- 2. manual adjustments (audit trail)
create table public.growth_adjustments (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.growth_contracts (id) on delete cascade,
  delta       int not null check (delta between -100 and 100 and delta <> 0),
  reason      text not null check (char_length(reason) between 3 and 500),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index growth_adjustments_contract_idx on public.growth_adjustments (contract_id, created_at desc);
alter table public.growth_adjustments enable row level security;
create policy growth_adjustments_admin on public.growth_adjustments for all to authenticated
  using (app_private.is_platform_admin()) with check (app_private.is_platform_admin());
revoke all on public.growth_adjustments from anon;
grant select, insert on public.growth_adjustments to authenticated;
create trigger audit_growth_adjustments after insert on public.growth_adjustments
  for each row execute function public.audit_row_change();

-- one running program per provider
create unique index growth_contracts_one_running_idx on public.growth_contracts (provider_org_id)
  where status in ('active', 'continuation_required');

-- 3. progress = automatic deliveries + manual adjustments (never below 0)
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
),
agg as (
  select c.id as contract_id,
         coalesce(sum(case when d.counts then 1 else 0 end), 0)::int as auto_count,
         coalesce(sum(case when d.validation = 'pending_validation' then 1 else 0 end), 0)::int as pending_validation,
         coalesce(sum(case when d.validation = 'under_dispute' then 1 else 0 end), 0)::int as under_dispute,
         coalesce(sum(case when d.validation = 'replacement_required' then 1 else 0 end), 0)::int as replacement_required,
         coalesce((select sum(x.delta) from public.growth_adjustments x where x.contract_id = c.id), 0)::int as manual_adjustment
  from public.growth_contracts c left join d on d.contract_id = c.id
  group by c.id
),
t as (
  select c.*, o.name as provider_name, agg.pending_validation, agg.under_dispute, agg.replacement_required, agg.manual_adjustment,
         greatest(agg.auto_count + agg.manual_adjustment, 0) as total,
         least(greatest(current_date - c.start_date, 0), 90) as elapsed
  from public.growth_contracts c
  join public.organizations o on o.id = c.provider_org_id
  join agg on agg.contract_id = c.id
)
select t.id as contract_id, t.provider_org_id, t.provider_name, t.start_date, t.deadline, t.target, t.status,
       t.total::bigint as delivered,
       greatest(t.target - t.total, 0)::int as remaining,
       greatest(t.deadline - current_date, 0) as days_left,
       t.pending_validation, t.under_dispute, t.replacement_required,
       t.elapsed as elapsed_days,
       round(t.target * 30.0 / 90, 1) as expected_per_month,
       round(t.total * 30.0 / greatest(t.elapsed, 1), 1) as current_per_month,
       case
         when t.status <> 'active' then t.status::text
         when t.total >= t.target then 'on_track'
         when t.elapsed < 7 then 'on_track'
         when t.total >= t.target * t.elapsed / 90.0 then 'on_track'
         when t.total >= 0.75 * t.target * t.elapsed / 90.0 then 'attention'
         else 'at_risk' end as health,
       t.manual_adjustment
from t;
grant select on public.growth_contract_progress to authenticated;
revoke all on public.growth_contract_progress from anon;
