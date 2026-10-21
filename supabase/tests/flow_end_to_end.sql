-- End-to-end flow test (signup → approval → referral → consent → qualification → matching → assignment →
-- accept → contact → pipeline → Growth count → scores). Runs in a transaction and rolls back.
begin;
-- v1 referral entry points are server-only since 20261021160000; re-grant inside this rolled-back test
grant execute on function public.submit_referral(uuid, uuid, text, text, text, text, text, text, text, text, boolean, uuid) to authenticated;
grant execute on function public.submit_public_referral(text, uuid, text, text, text, text, text, text, text, boolean, text, text, text) to anon, authenticated;
-- org creation helpers are server-only since 20261021150000; re-grant inside this rolled-back test
grant execute on function public.create_organization(text, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket) to authenticated;
grant execute on function public.create_organization_v2(text, uuid, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket, uuid[], uuid[], uuid[]) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'partner@test.local', '{"full_name":"Pat Partner"}', now(), now()),
 ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'provider@test.local', '{"full_name":"Paulo Provider"}', now(), now()),
 ('10000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@test.local', '{"full_name":"Olivia Other"}', now(), now()),
 ('10000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ops@test.local', '{"full_name":"Ops Admin"}', now(), now());
update public.profiles set platform_role = 'admin' where id = '10000000-0000-0000-0000-0000000000ad';

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;
insert into t select 'bath', id::text from public.service_categories where slug = 'bathroom-remodeling';
insert into t select 'floor', id::text from public.service_categories where slug = 'flooring';
insert into t select 'orl', id::text from public.regions where slug = 'orlando';
insert into t select 'kis', id::text from public.regions where slug = 'kissimmee';

set local role authenticated;
-- Partner (flooring) signs up: refers bathroom remodels it doesn't do
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-00000000000a"}', true);
insert into t select 'orgA', public.create_organization_v2('ABC Flooring LLC', (select v::uuid from t where k='floor'), 'abc@test.local', '4075550100', null,
  'FL', 'Orlando', '32801', true, false, '3-5',
  array[(select v::uuid from t where k='floor')], array[(select v::uuid from t where k='bath')], array[(select v::uuid from t where k='orl')])::text;
-- Provider (bathroom remodeler)
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-00000000000b"}', true);
insert into t select 'orgB', public.create_organization_v2('Kissimmee Bath Pros', (select v::uuid from t where k='bath'), 'kbp@test.local', null, null,
  'FL', 'Kissimmee', '34741', false, true, null,
  array[(select v::uuid from t where k='bath')], null, array[(select v::uuid from t where k='orl'), (select v::uuid from t where k='kis')])::text;
-- Unrelated company
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-00000000000c"}', true);
insert into t select 'orgC', public.create_organization_v2('Other Co', null, 'o@test.local', null, null, 'FL', 'Sanford', '32771', true, true, null, null, null, null)::text;

-- Before approval: partner cannot refer
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-00000000000a"}', true);
do $$ begin
  perform public.submit_referral((select v::uuid from t where k='orgA'), (select v::uuid from t where k='bath'), 'Orlando', '32803',
    'Full bathroom remodel, tub to shower', 'asap', 'Hannah Homeowner', '(407) 555-0199', 'hannah@test.local', null, true);
  raise exception 'FAIL: referral before approval';
exception when insufficient_privilege then null; end $$;

-- Admin approves A (refer) and B (receive)
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-0000000000ad"}', true);
select public.admin_set_org_status((select v::uuid from t where k='orgA'), 'approved');
select public.admin_set_capability((select v::uuid from t where k='orgA'), 'refer', 'approved');
select public.admin_set_org_status((select v::uuid from t where k='orgB'), 'approved');
select public.admin_set_capability((select v::uuid from t where k='orgB'), 'receive', 'approved');
select public.admin_set_verification((select v::uuid from t where k='orgB'), 'verified');
insert into public.growth_contracts (provider_org_id, start_date, offer_text) values
  ((select v::uuid from t where k='orgB'), current_date - 1, '24 Qualified Remodeling Quote Requests in 90 Days.');
-- since 20261021160000 a provider must be eligible (capacity + verified license and insurance) to be sent a project
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-00000000000b"}', true);
insert into public.provider_capacity (org_id, weekly_capacity, min_project_value, max_project_value, lead_time_days)
values ((select v::uuid from t where k='orgB'), 3, 1000, 80000, 7);
insert into public.professional_documents (org_id, kind, number, issuer, expires_on, file_path) values
  ((select v::uuid from t where k='orgB'), 'contractor_license', 'CBC1', 'Florida DBPR', current_date + 365, (select v from t where k='orgB') || '/lic.pdf'),
  ((select v::uuid from t where k='orgB'), 'general_liability', 'GL1', 'Acme Insurance', current_date + 365, (select v from t where k='orgB') || '/gl.pdf');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-0000000000ad"}', true);
select public.admin_review_document(d.id, 'verified', 'checked') from public.professional_documents d where d.org_id = (select v::uuid from t where k='orgB');

insert into t select 'code', referral_code from public.organizations where id = (select v::uuid from t where k='orgA');

-- Anonymous directory shows only approved businesses, without private contact fields
set local role anon;
select set_config('request.jwt.claims', '{}', true);
do $$ declare n int; p text; begin
  select count(*) into n from public.directory_search() d where d.id in (select v::uuid from t where k in ('orgA','orgB','orgC'));
  if n <> 2 then raise exception 'FAIL: public directory shows % businesses, expected 2', n; end if;
  select phone into p from public.directory_search() where name = 'ABC Flooring LLC';
  if p is not null then raise exception 'FAIL: public directory leaks phone'; end if;
  select count(*) into n from public.services_coverage((select v::uuid from t where k='bath'), (select v::uuid from t where k='kis')) where providers >= 1;
  if n <> 1 then raise exception 'FAIL: coverage'; end if;
end $$;

-- Homeowner uses A's link
do $$ begin
  if public.referral_link_info((select v from t where k='code')) is null then raise exception 'FAIL: link info'; end if;
  begin
    perform public.submit_public_referral((select v from t where k='code'), (select v::uuid from t where k='bath'), 'Orlando', '32804',
      'Kitchen? no, master bathroom remodel', 'asap', 'Linda Link', '4075550111', null, false, 'homeowner-2026-10', 'iphash', 'ua');
    raise exception 'FAIL: link without consent';
  exception when invalid_parameter_value then null; end;
end $$;
select public.submit_public_referral((select v from t where k='code'), (select v::uuid from t where k='bath'), 'Orlando', '32804',
  'Master bathroom remodel with new vanity', 'asap', 'Linda Link', '4075550111', null, true, 'homeowner-2026-10', 'iphash', 'ua');

-- Partner submits a direct referral
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-00000000000a"}', true);
insert into t select 'ref1', public.submit_referral((select v::uuid from t where k='orgA'), (select v::uuid from t where k='bath'), 'Orlando', '32803',
  'Full bathroom remodel, tub to shower', 'asap', 'Hannah Homeowner', '(407) 555-0199', 'hannah@test.local', null, true)::text;
do $$ declare n int; begin
  select count(*) into n from public.my_referrals((select v::uuid from t where k='orgA')); if n <> 2 then raise exception 'FAIL: my_referrals %', n; end if;
  select count(*) into n from public.homeowner_contacts; if n <> 0 then raise exception 'FAIL: partner reads contacts table'; end if;
end $$;

-- Other company cannot see A's referrals
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-00000000000c"}', true);
do $$ declare n int; begin
  select count(*) into n from public.referrals; if n <> 0 then raise exception 'FAIL: other company sees referrals'; end if;
  select count(*) into n from public.my_referrals((select v::uuid from t where k='orgA')); if n <> 0 then raise exception 'FAIL: my_referrals leak'; end if;
end $$;

-- Admin: cannot qualify before consent, then confirms, qualifies, matches, assigns
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-0000000000ad"}', true);
do $$ declare r uuid := (select v::uuid from t where k='ref1'); ok jsonb :=
  '{"owner_or_authorized":true,"real_request":true,"service_match":true,"location_served":true,"valid_contact":true,"authorized":true,"not_duplicate":true}';
  n int; prov uuid; a uuid;
begin
  begin perform public.admin_qualify_referral(r, ok, 'qualified'); raise exception 'FAIL: qualified without consent';
  exception when invalid_parameter_value then null; end;
  perform public.admin_confirm_consent(r, true, 'Called homeowner');
  begin perform public.admin_qualify_referral(r, ok - 'not_duplicate', 'qualified'); raise exception 'FAIL: qualified with 6 criteria';
  exception when invalid_parameter_value then null; end;
  perform public.admin_qualify_referral(r, ok, 'qualified', 'Good lead');
  select count(*), min(org_id::text)::uuid into n, prov from public.admin_match_suggestions(r);
  if n <> 1 or prov <> (select v::uuid from t where k='orgB') then raise exception 'FAIL: suggestions % %', n, prov; end if;
  a := public.admin_assign_referral(r, prov, 'rules');
  insert into t values ('asg', a::text);
  begin perform public.admin_assign_referral(r, (select v::uuid from t where k='orgC')); raise exception 'FAIL: second active provider';
  exception when invalid_parameter_value then null; end;
end $$;

-- Provider: sees the opportunity without contact; accepts; then sees contact; updates pipeline
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-00000000000b"}', true);
do $$ declare a uuid := (select v::uuid from t where k='asg'); n int; c jsonb; begin
  select count(*) into n from public.list_my_opportunities((select v::uuid from t where k='orgB')); if n <> 1 then raise exception 'FAIL: opportunities %', n; end if;
  select count(*) into n from public.referrals; if n <> 0 then raise exception 'FAIL: provider reads referrals table'; end if;
  begin perform public.get_opportunity_contact(a); raise exception 'FAIL: contact before accept';
  exception when insufficient_privilege then null; end;
  perform public.provider_respond(a, true);
  c := public.get_opportunity_contact(a);
  if c ->> 'name' <> 'Hannah Homeowner' then raise exception 'FAIL: contact after accept'; end if;
  perform public.provider_update(a, 'contacted');
  perform public.provider_update(a, 'estimate_sent', 18500, 'Sent estimate');
end $$;

-- Other company cannot read the opportunity or contact
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-00000000000c"}', true);
do $$ begin
  if public.get_opportunity((select v::uuid from t where k='asg')) is not null then raise exception 'FAIL: other reads opportunity'; end if;
  begin perform public.get_opportunity_contact((select v::uuid from t where k='asg')); raise exception 'FAIL: other reads contact';
  exception when insufficient_privilege then null; end;
end $$;

-- Growth counts the qualified delivery exactly once; scores and analytics compute
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-0000000000ad"}', true);
-- since 20261021170000 a Growth delivery counts only after BookedUp validates it
update public.growth_deliveries set validation = 'qualified' where assignment_id = (select v::uuid from t where k='asg');
do $$ declare n int; j jsonb; begin
  select delivered into n from public.growth_contract_progress where provider_org_id = (select v::uuid from t where k='orgB');
  if n <> 1 then raise exception 'FAIL: growth delivered %', n; end if;
  perform public.compute_scores();
  select count(*) into n from public.partner_score_snapshots; if n < 1 then raise exception 'FAIL: partner scores'; end if;
  j := public.admin_overview(); if (j ->> 'consent_pending')::int <> 0 or (j ->> 'under_review')::int <> 1 then raise exception 'FAIL: overview %', j; end if;
  j := public.admin_analytics(30); if (j ->> 'qualified')::int <> 1 then raise exception 'FAIL: analytics %', j; end if;
  if public.organization_activation((select v::uuid from t where k='orgA')) <> 'productive' then raise exception 'FAIL: activation'; end if;
  select count(*) into n from public.admin_regional_coverage(); if n < 1 then raise exception 'FAIL: coverage'; end if;
end $$;

-- Non-admin cannot use admin analytics
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-00000000000a"}', true);
do $$ begin
  begin perform public.admin_overview(); raise exception 'FAIL: partner used admin overview';
  exception when insufficient_privilege then null; end;
  if public.my_ranking((select v::uuid from t where k='orgA')) is null then raise exception 'FAIL: my_ranking'; end if;
end $$;

select 'ALL PASSED' as result;
rollback;
