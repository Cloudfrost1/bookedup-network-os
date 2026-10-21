-- Cross-access tests for Phase 1. Runs inside a transaction and rolls back: leaves no data behind.
-- Run with: psql "$DATABASE_URL" -f supabase/tests/rls_foundation.sql   (expects final row: ALL PASSED)
begin;
-- org creation helpers are server-only since 20261021150000; re-grant inside this rolled-back test
grant execute on function public.create_organization(text, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket) to authenticated;
grant execute on function public.create_organization_v2(text, uuid, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket, uuid[], uuid[], uuid[]) to authenticated;

-- ---- fixtures (as postgres)
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
 ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"full_name":"Owner A"}', now(), now()),
 ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '{"full_name":"Owner B"}', now(), now()),
 ('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local', '{"full_name":"Admin"}', now(), now());
update public.profiles set platform_role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';

create temp table t_ids (k text primary key, v uuid);
grant all on t_ids to authenticated;

-- ---- user A creates org A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into t_ids select 'orgA', public.create_organization('ABC Flooring LLC','info@abc.test','4075550100',null,'FL','Orlando','32801',true,true,'3-5');

-- ---- user B creates org B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
insert into t_ids select 'orgB', public.create_organization('Kissimmee Remodel Co','hi@krc.test',null,null,'FL','Kissimmee','34741',false,true,null);

-- ---- assertions as A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
declare a uuid := (select v from t_ids where k='orgA'); b uuid := (select v from t_ids where k='orgB'); n int; j jsonb;
begin
  select count(*) into n from public.organizations;                 if n <> 1 then raise exception 'A sees % orgs, expected 1', n; end if;
  select count(*) into n from public.organizations where id = b;     if n <> 0 then raise exception 'A can read org B'; end if;
  select count(*) into n from public.organization_members where org_id = b; if n <> 0 then raise exception 'A can read members of B'; end if;
  select count(*) into n from public.organization_capabilities where org_id = b; if n <> 0 then raise exception 'A can read capabilities of B'; end if;
  select count(*) into n from public.profiles where id = '00000000-0000-0000-0000-00000000000b'; if n <> 0 then raise exception 'A can read profile of B'; end if;
  select count(*) into n from public.audit_logs;                     if n <> 0 then raise exception 'A can read audit logs'; end if;

  update public.organizations set name = 'Hacked' where id = b; get diagnostics n = row_count;
  if n <> 0 then raise exception 'A updated org B'; end if;
  update public.organizations set name = 'ABC Flooring & Tile' where id = a; get diagnostics n = row_count;
  if n <> 1 then raise exception 'A could not update own org'; end if;

  begin update public.organizations set status = 'approved' where id = a; raise exception 'A changed own status';
  exception when insufficient_privilege then null; end;
  begin insert into public.organizations (network_id, name, slug, referral_code) select id, 'X', 'x', 'x' from public.networks limit 1; raise exception 'A inserted org directly';
  exception when insufficient_privilege then null; end;
  begin insert into public.organization_members (org_id, user_id, role) values (b, '00000000-0000-0000-0000-00000000000a', 'owner'); raise exception 'A joined org B';
  exception when insufficient_privilege then null; end;
  begin update public.profiles set platform_role = 'super_admin' where id = '00000000-0000-0000-0000-00000000000a'; raise exception 'A escalated platform role';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_set_org_status(a, 'approved'); raise exception 'A used admin RPC';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_set_capability(a, 'refer', 'approved'); raise exception 'A approved own capability';
  exception when insufficient_privilege then null; end;
  if app_private.org_has_capability(a, 'refer') then raise exception 'Capability active before approval'; end if;
  j := public.my_access(); if jsonb_array_length(j->'organizations') <> 1 then raise exception 'my_access leaks: %', j; end if;
end $$;

-- ---- assertions as admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
do $$
declare a uuid := (select v from t_ids where k='orgA'); n int;
begin
  select count(*) into n from public.organizations where id in (select v from t_ids); if n <> 2 then raise exception 'Admin sees % orgs, expected 2', n; end if;
  perform public.admin_set_org_status(a, 'approved', 'Phone check done');
  perform public.admin_set_capability(a, 'refer', 'approved');
  select count(*) into n from public.audit_logs where org_id = a; if n < 4 then raise exception 'Audit trail too short: %', n; end if;
  begin perform public.super_admin_set_platform_role('00000000-0000-0000-0000-00000000000a', 'admin'); raise exception 'Admin acted as super admin';
  exception when insufficient_privilege then null; end;
end $$;

-- ---- capability now active for A, still not for receive
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
declare a uuid := (select v from t_ids where k='orgA');
begin
  if not app_private.org_has_capability(a, 'refer') then raise exception 'Approved capability not active'; end if;
  if app_private.org_has_capability(a, 'receive') then raise exception 'Unapproved capability active'; end if;
end $$;

-- ---- anon sees nothing private
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin perform 1 from public.organizations limit 1; raise exception 'anon can select organizations';
  exception when insufficient_privilege then null; end;
  begin perform app_private.is_platform_admin(); raise exception 'anon can call helpers';
  exception when insufficient_privilege then null; end;
end $$;

-- ---- every organization keeps an owner
reset role;
do $$
declare a uuid := (select v from t_ids where k='orgA');
begin
  begin
    delete from public.organization_members where org_id = a;
    set constraints all immediate;
    raise exception 'Last owner was removed';
  exception when raise_exception then
    if sqlerrm not like '%keep at least one owner%' then raise; end if;
  end;
end $$;

select 'ALL PASSED' as result;
rollback;
