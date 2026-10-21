-- Capacity, full-scope request and reliability. Runs in a transaction and is rolled back.
begin;
-- org creation helpers are server-only since 20261021150000; re-grant inside this rolled-back test
grant execute on function public.create_organization(text, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket) to authenticated;
grant execute on function public.create_organization_v2(text, uuid, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket, uuid[], uuid[], uuid[]) to authenticated;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anchor@test.local', '{}', now(), now()),
 ('30000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pro@test.local', '{}', now(), now()),
 ('30000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@test.local', '{}', now(), now()),
 ('30000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ops2@test.local', '{}', now(), now());
update public.profiles set platform_role = 'admin' where id = '30000000-0000-0000-0000-0000000000ad';
create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;
insert into t select 'bath', id::text from public.service_categories where slug = 'bathroom-remodeling';
insert into t select 'orl', id::text from public.regions where slug = 'orlando';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-00000000000a"}', true);
insert into t select 'A', public.create_organization_v2('Anchor Floors', null, 'a@test.local', null, null, 'FL', 'Orlando', '32801', true, false, null,
  null, array[(select v::uuid from t where k='bath')], array[(select v::uuid from t where k='orl')])::text;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-00000000000b"}', true);
insert into t select 'B', public.create_organization_v2('Bath Pro', (select v::uuid from t where k='bath'), 'b@test.local', null, null, 'FL', 'Orlando', '32801', false, true, null,
  array[(select v::uuid from t where k='bath')], null, array[(select v::uuid from t where k='orl')])::text;
-- provider fills capacity and uploads documents
insert into public.provider_capacity (org_id, weekly_capacity, min_project_value, max_project_value, lead_time_days)
values ((select v::uuid from t where k='B'), 3, 5000, 40000, 10);
insert into public.professional_documents (org_id, kind, number, expires_on) values
  ((select v::uuid from t where k='B'), 'contractor_license', 'CBC123', current_date + 300),
  ((select v::uuid from t where k='B'), 'general_liability', 'POL-9', current_date + 200);
do $$ begin
  begin
    insert into public.professional_documents (org_id, kind, number, status) values ((select v::uuid from t where k='B'), 'other', 'x', 'verified');
    raise exception 'FAIL: provider self-verified a document';
  exception when insufficient_privilege then null; end;
  if (public.provider_reliability((select v::uuid from t where k='B')) ->> 'docs_verified')::boolean then raise exception 'FAIL: docs verified before review'; end if;
end $$;

-- other company cannot touch the provider's capacity
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-00000000000c"}', true);
do $$ declare n int; begin
  select count(*) into n from public.provider_capacity; if n <> 0 then raise exception 'FAIL: capacity leak'; end if;
  begin perform public.provider_reliability((select v::uuid from t where k='B')); raise exception 'FAIL: reliability leak';
  exception when insufficient_privilege then null; end;
end $$;

-- admin approves both, verifies documents
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-0000000000ad"}', true);
select public.admin_set_org_status((select v::uuid from t where k='A'), 'approved');
select public.admin_set_capability((select v::uuid from t where k='A'), 'refer', 'approved');
select public.admin_set_org_status((select v::uuid from t where k='B'), 'approved');
select public.admin_set_capability((select v::uuid from t where k='B'), 'receive', 'approved');
do $$ declare d record; begin
  for d in select id from public.professional_documents where org_id = (select v::uuid from t where k='B') loop
    perform public.admin_review_document(d.id, 'verified', 'checked');
  end loop;
  if not (public.provider_reliability((select v::uuid from t where k='B')) ->> 'docs_verified')::boolean then raise exception 'FAIL: docs not verified'; end if;
  if (public.provider_reliability((select v::uuid from t where k='B')) ->> 'trusted')::boolean then raise exception 'FAIL: badge without track record'; end if;
  if (select count(*) from public.notifications where for_admins and type = 'organization_pending') < 2 then raise exception 'FAIL: signup notifications'; end if;
end $$;

-- anchor sends full-scope request with photo
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-00000000000a"}', true);
insert into t select 'R', public.submit_referral_v2((select v::uuid from t where k='A'), (select v::uuid from t where k='bath'), 'Orlando', '32803',
  'Primary bathroom remodel, walk-in shower', '1-3_months', '15k_30k', 'single_family', 'HOA approval needed',
  'Helen Home', '4075550123', null, '123 Main St', true)::text;
insert into public.referral_photos (referral_id, path) values ((select v::uuid from t where k='R'), (select v from t where k='R') || '/a.jpg');
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-00000000000c"}', true);
do $$ begin
  begin insert into public.referral_photos (referral_id, path) values ((select v::uuid from t where k='R'), 'x/b.jpg');
    raise exception 'FAIL: outsider added photo';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.referral_photos) then raise exception 'FAIL: outsider sees photos'; end if;
end $$;

-- admin confirms, qualifies, matches with capacity info, assigns
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-0000000000ad"}', true);
do $$ declare r uuid := (select v::uuid from t where k='R'); s record; a uuid; begin
  perform public.admin_confirm_consent(r, true, 'called');
  perform public.admin_qualify_referral(r, '{"owner_or_authorized":true,"real_request":true,"service_match":true,"location_served":true,"valid_contact":true,"authorized":true,"not_duplicate":true}', 'qualified');
  select * into s from public.admin_match_suggestions_v2(r) limit 1;
  if s.org_id is distinct from (select v::uuid from t where k='B') or s.weekly_capacity <> 3 or not s.docs_verified then raise exception 'FAIL: suggestions v2 %', s; end if;
  a := public.admin_assign_referral(r, s.org_id, 'rules');
  insert into t values ('ASG', a::text);
end $$;

-- provider sees scope and photos before accepting, but no contact
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-00000000000b"}', true);
do $$ declare a uuid := (select v::uuid from t where k='ASG'); o jsonb; n int; begin
  o := public.get_opportunity(a);
  if o ->> 'budget_range' <> '15k_30k' or o ->> 'specific_needs' <> 'HOA approval needed' or jsonb_array_length(o -> 'photos') <> 1 then raise exception 'FAIL: scope %', o; end if;
  if o ? 'address' then raise exception 'FAIL: address leaked before accept'; end if;
  select count(*) into n from public.referral_photos; if n <> 1 then raise exception 'FAIL: provider cannot see photo'; end if;
  begin perform public.get_opportunity_contact(a); raise exception 'FAIL: contact before accept';
  exception when insufficient_privilege then null; end;
  perform public.provider_respond(a, true);
  perform public.provider_update_v2(a, 'estimate_scheduled', null, null, now() + interval '2 days');
  if (public.get_opportunity(a) ->> 'appointment_at') is null then raise exception 'FAIL: appointment'; end if;
  select count(*) into n from public.assignment_feedback; if n <> 0 then raise exception 'FAIL: provider reads feedback'; end if;
end $$;

-- anchor leaves feedback (unverified); admin verifies; reliability counts it
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-00000000000a"}', true);
select public.partner_feedback((select v::uuid from t where k='R'), true, true, true, 5, 'Great visit');
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-0000000000ad"}', true);
do $$ declare j jsonb; f uuid; begin
  j := public.provider_reliability((select v::uuid from t where k='B'));
  if (j ->> 'verified_feedback')::int <> 0 then raise exception 'FAIL: unverified feedback counted'; end if;
  select id into f from public.assignment_feedback limit 1;
  perform public.admin_verify_feedback(f, true);
  perform public.admin_record_feedback((select v::uuid from t where k='ASG'), 'homeowner', true, true, true, 4, 'Confirmed by phone');
  j := public.provider_reliability((select v::uuid from t where k='B'));
  if (j ->> 'verified_feedback')::int <> 2 or (j ->> 'showed_up_yes')::int <> 2 or (j ->> 'avg_rating')::numeric <> 4.5 then raise exception 'FAIL: reliability %', j; end if;
  if (j ->> 'trusted')::boolean then raise exception 'FAIL: trusted with 1 accepted'; end if;
  perform public.compute_scores();
end $$;

do $$ begin raise exception 'ALL PASSED (rolled back)'; end $$;
