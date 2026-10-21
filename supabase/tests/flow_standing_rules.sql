-- Standing, eligibility, capacity/document validation, referral scope and masked directory contacts. Rolls back.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sa@test.local', '{}', now(), now()),
 ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sb@test.local', '{}', now(), now()),
 ('40000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sadmin@test.local', '{}', now(), now());
update public.profiles set platform_role = 'admin' where id = '40000000-0000-0000-0000-0000000000ad';
create temp table t (k text primary key, v text);
grant all on t to authenticated;
insert into t select 'bath', id::text from public.service_categories where slug = 'bathroom-remodeling';
insert into t select 'floor', id::text from public.service_categories where slug = 'flooring';
insert into t select 'orl', id::text from public.regions where slug = 'orlando';
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-00000000000a"}', true);
insert into t select 'A', public.create_organization_v3('Std Anchor', (select v::uuid from t where k='floor'), 'a@t.local', '4075550100', null, 'FL', 'Orlando', '32801',
  true, false, '1-2', array[(select v::uuid from t where k='floor')], array[(select v::uuid from t where k='bath')], array[(select v::uuid from t where k='orl')],
  '{"terms_privacy":true,"data_use":true,"referral_authorization":true,"contact_email":true}')::text;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-00000000000b"}', true);
insert into t select 'B', public.create_organization_v3('Std Provider', (select v::uuid from t where k='bath'), 'b@t.local', '4075550101', null, 'FL', 'Orlando', '32801',
  false, true, '0', array[(select v::uuid from t where k='bath')], array[]::uuid[], array[(select v::uuid from t where k='orl')],
  '{"terms_privacy":true,"data_use":true,"contact_email":true}')::text;

-- capacity rules
do $$ declare b uuid := (select v::uuid from t where k='B'); begin
  begin insert into public.provider_capacity (org_id, weekly_capacity) values (b, 3); raise exception 'FAIL: incomplete capacity';
  exception when invalid_parameter_value then null; end;
  begin insert into public.provider_capacity (org_id, weekly_capacity, min_project_value, max_project_value, lead_time_days) values (b, 3, 9000, 5000, 7);
    raise exception 'FAIL: min > max'; exception when invalid_parameter_value then null; end;
  begin insert into public.provider_capacity (org_id, accepting_new_work, weekly_capacity, min_project_value, max_project_value, lead_time_days) values (b, true, 0, 1000, 5000, 7);
    raise exception 'FAIL: zero capacity while accepting'; exception when invalid_parameter_value then null; end;
  begin insert into public.provider_capacity (org_id, weekly_capacity, min_project_value, max_project_value, lead_time_days) values (b, 3, -1, 5000, 7);
    raise exception 'FAIL: negative value'; exception when invalid_parameter_value or check_violation then null; end;
  insert into public.provider_capacity (org_id, weekly_capacity, min_project_value, max_project_value, lead_time_days) values (b, 3, 1000, 50000, 7);
end $$;

-- document rules
do $$ declare b uuid := (select v::uuid from t where k='B'); begin
  begin insert into public.professional_documents (org_id, kind, number, issuer, expires_on, file_path) values (b, 'contractor_license', 'X', 'DBPR', current_date + 10, null);
    raise exception 'FAIL: doc without file'; exception when invalid_parameter_value then null; end;
  begin insert into public.professional_documents (org_id, kind, number, issuer, expires_on, file_path) values (b, 'contractor_license', 'X', 'DBPR', current_date, b || '/x.pdf');
    raise exception 'FAIL: doc expiring today'; exception when invalid_parameter_value then null; end;
  begin insert into public.professional_documents (org_id, kind, number, issuer, expires_on, file_path) values (b, 'contractor_license', 'X', '', current_date + 10, b || '/x.pdf');
    raise exception 'FAIL: doc without issuer'; exception when invalid_parameter_value then null; end;
  insert into public.professional_documents (org_id, kind, number, issuer, expires_on, file_path) values
    (b, 'contractor_license', 'CBC1', 'DBPR', current_date + 300, b || '/lic.pdf'),
    (b, 'general_liability', 'GL1', 'Acme', current_date + 300, b || '/gl.pdf');
end $$;

-- admin approves both: B is approved as member but NOT eligible until documents are verified
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-0000000000ad"}', true);
select public.admin_set_org_status((select v::uuid from t where k='A'), 'approved');
select public.admin_set_capability((select v::uuid from t where k='A'), 'refer', 'approved');
select public.admin_set_org_status((select v::uuid from t where k='B'), 'approved');
select public.admin_set_capability((select v::uuid from t where k='B'), 'receive', 'approved');
do $$ declare s jsonb; begin
  s := public.org_standing((select v::uuid from t where k='B'));
  if s->>'membership' <> 'approved' or s->>'provider_verification' <> 'incomplete' or (s->>'eligible_to_receive')::boolean
     or not (s->'blockers' ? 'license_in_review') then raise exception 'FAIL: standing before docs %', s; end if;
  s := public.org_standing((select v::uuid from t where k='A'));
  if s->>'referral_partner' <> 'active' or s->>'provider_verification' <> 'not_requested' then raise exception 'FAIL: anchor standing %', s; end if;
end $$;
select public.admin_review_document(d.id, 'verified', 'ok') from public.professional_documents d where d.org_id = (select v::uuid from t where k='B');
do $$ declare s jsonb; begin
  s := public.org_standing((select v::uuid from t where k='B'));
  if s->>'provider_verification' <> 'complete' or not (s->>'eligible_to_receive')::boolean then raise exception 'FAIL: standing after docs %', s; end if;
end $$;

-- referral scope rules
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-00000000000a"}', true);
do $$ declare a uuid := (select v::uuid from t where k='A'); bath uuid := (select v::uuid from t where k='bath'); begin
  begin perform public.submit_referral_v2(a, bath, 'Orlando', '32801', 'Bathroom remodel needed', 'flexible', null, 'single_family', null, 'Hal', '4075550000', null, null, true);
    raise exception 'FAIL: no budget'; exception when invalid_parameter_value then null; end;
  begin perform public.submit_referral_v2(a, bath, 'Orlando', '32801', 'Bathroom remodel needed', 'flexible', 'unknown', null, null, 'Hal', '4075550000', null, null, true);
    raise exception 'FAIL: no property type'; exception when invalid_parameter_value then null; end;
  begin perform public.submit_referral_v2(a, bath, 'Orlando', '32801', 'Bathroom remodel needed', 'asap', 'unknown', 'other', null, 'Hal', null, 'hal@t.local', null, true);
    raise exception 'FAIL: urgent without phone'; exception when invalid_parameter_value then null; end;
  begin perform public.submit_referral_v2(a, bath, 'Orlando', '32801', 'Bathroom remodel needed', 'flexible', 'unknown', 'other', null, 'Hal', null, null, null, true);
    raise exception 'FAIL: no contact'; exception when invalid_parameter_value then null; end;
  insert into t select 'R', public.submit_referral_v2(a, bath, 'Orlando', '32801', 'Bathroom remodel needed', 'flexible', 'unknown', 'other', null, 'Hal', null, 'hal@t.local', null, true)::text;
end $$;

-- directory: contacts hidden until a connection is accepted
do $$ declare p text; begin
  select phone into p from public.directory_search(p_private => true) where id = (select v::uuid from t where k='B');
  if p is not null then raise exception 'FAIL: phone visible before connection'; end if;
end $$;
insert into t select 'C', public.request_connection((select v::uuid from t where k='A'), (select v::uuid from t where k='B'))::text;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-00000000000b"}', true);
select public.respond_connection((select v::uuid from t where k='C'), 'accepted');
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-00000000000a"}', true);
do $$ declare p text; begin
  select phone into p from public.directory_search(p_private => true) where id = (select v::uuid from t where k='B');
  if p is distinct from '4075550101' then raise exception 'FAIL: phone hidden after connection (%)', p; end if;
end $$;

-- an ineligible provider cannot be sent a project
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-00000000000b"}', true);
update public.provider_capacity set accepting_new_work = false where org_id = (select v::uuid from t where k='B');
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-0000000000ad"}', true);
do $$ declare r uuid := (select v::uuid from t where k='R'); begin
  perform public.admin_confirm_consent(r, true, 'ok');
  perform public.admin_qualify_referral(r, '{"owner_or_authorized":true,"real_request":true,"service_match":true,"location_served":true,"valid_contact":true,"authorized":true,"not_duplicate":true}', 'qualified');
  begin perform public.admin_assign_referral(r, (select v::uuid from t where k='B')); raise exception 'FAIL: paused provider assigned';
  exception when invalid_parameter_value then null; end;
end $$;

do $$ begin raise exception 'ALL PASSED (rolled back)'; end $$;
