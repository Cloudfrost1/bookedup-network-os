-- Commercial stages: verified ≠ continuous flow; one complimentary opportunity; Growth counts only validated deliveries. Rolls back.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ca@test.local', '{}', now(), now()),
 ('50000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cb@test.local', '{}', now(), now()),
 ('50000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cadmin@test.local', '{}', now(), now());
update public.profiles set platform_role = 'admin' where id = '50000000-0000-0000-0000-0000000000ad';
create temp table t (k text primary key, v text);
grant all on t to authenticated;
insert into t select 'bath', id::text from public.service_categories where slug = 'bathroom-remodeling';
insert into t select 'floor', id::text from public.service_categories where slug = 'flooring';
insert into t select 'orl', id::text from public.regions where slug = 'orlando';
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-00000000000a"}', true);
insert into t select 'A', public.create_organization_v3('Com Anchor', (select v::uuid from t where k='floor'), 'a@t.local', '4075550100', null, 'FL', 'Orlando', '32801',
  true, false, '1-2', array[(select v::uuid from t where k='floor')], array[(select v::uuid from t where k='bath')], array[(select v::uuid from t where k='orl')],
  '{"terms_privacy":true,"data_use":true,"referral_authorization":true,"contact_email":true}')::text;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-00000000000b"}', true);
insert into t select 'B', public.create_organization_v3('Com Provider', (select v::uuid from t where k='bath'), 'b@t.local', '4075550101', null, 'FL', 'Orlando', '32801',
  false, true, '0', array[(select v::uuid from t where k='bath')], array[]::uuid[], array[(select v::uuid from t where k='orl')],
  '{"terms_privacy":true,"data_use":true,"contact_email":true}')::text;
do $$ declare s jsonb; begin
  s := public.org_standing((select v::uuid from t where k='B'));
  if s->>'stage' <> 'application_incomplete' then raise exception 'FAIL: new applicant stage %', s->>'stage'; end if;
end $$;
insert into public.provider_capacity (org_id, weekly_capacity, min_project_value, max_project_value, lead_time_days)
values ((select v::uuid from t where k='B'), 3, 1000, 50000, 7);
insert into public.professional_documents (org_id, kind, number, issuer, expires_on, file_path) values
  ((select v::uuid from t where k='B'), 'contractor_license', 'CBC1', 'DBPR', current_date + 300, (select v from t where k='B') || '/l.pdf'),
  ((select v::uuid from t where k='B'), 'general_liability', 'GL1', 'Acme', current_date + 300, (select v from t where k='B') || '/g.pdf');
do $$ begin
  if public.org_standing((select v::uuid from t where k='B'))->>'stage' <> 'under_review' then raise exception 'FAIL: under_review'; end if;
  begin perform public.admin_set_provider_track((select v::uuid from t where k='B'), 'overflow'); raise exception 'FAIL: provider set own track';
  exception when insufficient_privilege then null; end;
  begin perform public.submit_growth_interest('x','y','bad','','','','','h'); raise exception 'FAIL: bad email accepted';
  exception when invalid_parameter_value then null; end;
end $$;

select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000ad"}', true);
select public.admin_set_org_status((select v::uuid from t where k='A'), 'approved');
select public.admin_set_capability((select v::uuid from t where k='A'), 'refer', 'approved');
select public.admin_set_org_status((select v::uuid from t where k='B'), 'approved');
select public.admin_set_capability((select v::uuid from t where k='B'), 'receive', 'approved');
select public.admin_review_document(d.id, 'verified', 'ok') from public.professional_documents d where d.org_id = (select v::uuid from t where k='B');

select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-00000000000a"}', true);
insert into t select 'R1', public.submit_referral_v2((select v::uuid from t where k='A'), (select v::uuid from t where k='bath'), 'Orlando', '32801', 'Bathroom remodel one', 'flexible', 'unknown', 'other', null, 'Hal', '4075550000', null, null, true)::text;
insert into t select 'R2', public.submit_referral_v2((select v::uuid from t where k='A'), (select v::uuid from t where k='bath'), 'Orlando', '32801', 'Bathroom remodel two', 'flexible', '15k_30k', 'condo', null, 'Ivy', '4075550001', null, null, true)::text;
insert into t select 'R3', public.submit_referral_v2((select v::uuid from t where k='A'), (select v::uuid from t where k='bath'), 'Orlando', '32801', 'Bathroom remodel three', 'flexible', '5k_15k', 'townhouse', null, 'Joe', '4075550002', null, null, true)::text;

select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000ad"}', true);
do $$ declare b uuid := (select v::uuid from t where k='B'); r record; a uuid; s jsonb; p record; ok jsonb :=
  '{"owner_or_authorized":true,"real_request":true,"service_match":true,"location_served":true,"valid_contact":true,"authorized":true,"not_duplicate":true}';
begin
  for r in select v::uuid as id from t where k in ('R1','R2','R3') loop
    perform public.admin_confirm_consent(r.id, true, 'ok'); perform public.admin_qualify_referral(r.id, ok, 'qualified');
  end loop;
  -- verified without Growth: no continuous flow
  s := public.org_standing(b);
  if s->>'stage' <> 'verified' or (s->>'eligible_to_receive')::boolean or not (s->>'operational_ready')::boolean then raise exception 'FAIL: verified %', s; end if;
  begin perform public.admin_assign_referral((select v::uuid from t where k='R1'), b); raise exception 'FAIL: verified provider got a project';
  exception when invalid_parameter_value then null; end;
  if (select priority from public.admin_match_suggestions_v4((select v::uuid from t where k='R1')) where org_id = b) <> 9 then raise exception 'FAIL: priority for verified'; end if;
  -- one complimentary opportunity
  perform public.admin_set_provider_track(b, 'trial');
  if public.org_standing(b)->>'stage' <> 'trial_eligible' then raise exception 'FAIL: trial_eligible'; end if;
  if (select priority from public.admin_match_suggestions_v4((select v::uuid from t where k='R1')) where org_id = b) <> 3 then raise exception 'FAIL: trial priority'; end if;
  a := public.admin_assign_referral((select v::uuid from t where k='R1'), b);
  if (select kind from public.referral_assignments where id = a) <> 'trial' then raise exception 'FAIL: trial kind'; end if;
  if public.org_standing(b)->>'stage' <> 'trial_delivered' then raise exception 'FAIL: trial_delivered'; end if;
  begin perform public.admin_assign_referral((select v::uuid from t where k='R2'), b); raise exception 'FAIL: second free opportunity';
  exception when invalid_parameter_value then null; end;
  -- Growth: deliveries count only after validation
  insert into public.growth_contracts (provider_org_id, start_date, offer_text) values (b, current_date - 30, 'Growth');
  if public.org_standing(b)->>'stage' <> 'growth_active' then raise exception 'FAIL: growth_active'; end if;
  if (select priority from public.admin_match_suggestions_v4((select v::uuid from t where k='R2')) where org_id = b) <> 1 then raise exception 'FAIL: growth priority'; end if;
  a := public.admin_assign_referral((select v::uuid from t where k='R2'), b);
  select * into p from public.growth_contract_progress where provider_org_id = b;
  if p.delivered <> 0 or p.pending_validation <> 1 or p.expected_per_month <> 8 then raise exception 'FAIL: pending not counted %', row_to_json(p); end if;
  update public.growth_deliveries set validation = 'qualified' where assignment_id = a;
  select * into p from public.growth_contract_progress where provider_org_id = b;
  if p.delivered <> 1 or p.remaining <> 23 or p.health <> 'at_risk' then raise exception 'FAIL: validated delivery %', row_to_json(p); end if;
  insert into t values ('ASG', a::text);
end $$;

-- provider sees its program, cannot validate its own deliveries, can request a Growth Review once
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-00000000000b"}', true);
do $$ declare b uuid := (select v::uuid from t where k='B'); n int; begin
  if (select delivered from public.my_growth_program(b) limit 1) <> 1 or (select validation from public.my_growth_deliveries(b) limit 1) <> 'qualified' then raise exception 'FAIL: provider progress'; end if;
  update public.growth_deliveries set validation = 'qualified' where assignment_id = (select v::uuid from t where k='ASG');
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL: provider validated delivery'; end if;
  perform public.request_growth_review(b, '4075550101', 'Mornings', 'Interested');
  begin perform public.request_growth_review(b, null, null, null); raise exception 'FAIL: duplicate review request';
  exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-00000000000a"}', true);
do $$ begin
  if exists (select 1 from public.growth_review_requests) then raise exception 'FAIL: anchor sees other review requests'; end if;
  if exists (select 1 from public.my_growth_program((select v::uuid from t where k='B'))) then raise exception 'FAIL: anchor reads provider program'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select public.submit_growth_interest('Pat Pro', 'Pro Remodel LLC', 'pat@pro.test', '4075550199', 'Orlando', 'Kitchen', 'Hi', 'hash-x');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000ad"}', true);
do $$ begin
  if (select count(*) from public.growth_review_requests where name in ('Pat Pro') or org_id = (select v::uuid from t where k='B')) <> 2 then raise exception 'FAIL: admin review list'; end if;
  if (select count(*) from public.notifications where for_admins and type = 'growth_review_requested' and created_at > now() - interval '1 minute') < 2 then raise exception 'FAIL: admin notified'; end if;
end $$;

do $$ begin raise exception 'ALL PASSED (rolled back)'; end $$;
