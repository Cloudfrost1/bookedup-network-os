-- Onboarding v3: required operational data + consents, recorded per org. Rolls back.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'onb@test.local', '{"full_name":"Onb Test"}', now(), now());
create temp table t (k text primary key, v text);
grant all on t to authenticated;
insert into t select 'floor', id::text from public.service_categories where slug = 'flooring';
insert into t select 'bath', id::text from public.service_categories where slug = 'bathroom-remodeling';
insert into t select 'orl', id::text from public.regions where slug = 'orlando';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-00000000000a"}', true);

do $$
declare
  f uuid := (select v::uuid from t where k='floor');
  b uuid := (select v::uuid from t where k='bath');
  o uuid := (select v::uuid from t where k='orl');
  ok jsonb := '{"terms_privacy":true,"data_use":true,"referral_authorization":true,"contact_email":true,"contact_sms":false,"contact_whatsapp":true}';
  org uuid; n int; failed boolean;
begin
  -- old paths are closed to clients
  begin perform public.create_organization_v2('X', f, 'x@t.local', '4075550100', null, 'FL', 'Orlando', '32801', true, true, '1-2', array[f], array[b], array[o]);
    raise exception 'FAIL: v2 still callable'; exception when insufficient_privilege then null; end;

  -- each missing requirement is rejected
  failed := false; begin perform public.create_organization_v3('X', f, 'x@t.local', '', null, 'FL', 'Orlando', '32801', true, true, '1-2', array[f], array[b], array[o], ok);
    exception when invalid_parameter_value then failed := true; end;
  if not failed then raise exception 'FAIL: phone not required'; end if;
  failed := false; begin perform public.create_organization_v3('X', f, 'x@t.local', '4075550100', null, 'FL', 'Orlando', '32801', true, true, '1-2', array[f], array[]::uuid[], array[o], ok);
    exception when invalid_parameter_value then failed := true; end;
  if not failed then raise exception 'FAIL: turned-down services not required for referrers'; end if;
  failed := false; begin perform public.create_organization_v3('X', f, 'x@t.local', '4075550100', null, 'FL', 'Orlando', '32801', true, true, '1-2', array[f], array[b], array[]::uuid[], ok);
    exception when invalid_parameter_value then failed := true; end;
  if not failed then raise exception 'FAIL: cities not required'; end if;
  failed := false; begin perform public.create_organization_v3('X', f, 'x@t.local', '4075550100', null, 'FL', 'Orlando', '32801', true, true, null, array[f], array[b], array[o], ok);
    exception when invalid_parameter_value then failed := true; end;
  if not failed then raise exception 'FAIL: out-of-scope volume not required'; end if;
  failed := false; begin perform public.create_organization_v3('X', f, 'x@t.local', '4075550100', null, 'FL', 'Orlando', '32801', true, true, '1-2', array[f], array[b], array[o], ok - 'referral_authorization');
    exception when invalid_parameter_value then failed := true; end;
  if not failed then raise exception 'FAIL: referral authorization not required'; end if;
  failed := false; begin perform public.create_organization_v3('X', f, 'x@t.local', '4075550100', null, 'FL', 'Orlando', '32801', false, false, '1-2', array[f], array[b], array[o], ok);
    exception when invalid_parameter_value then failed := true; end;
  if not failed then raise exception 'FAIL: mode not required'; end if;

  -- valid: refer + receive
  org := public.create_organization_v3('Onb Floors', f, 'x@t.local', '4075550100', null, 'FL', 'Orlando', '32801', true, true, '1-2', array[f], array[b], array[o], ok);
  select count(*) into n from public.organization_consents where org_id = org;
  if n <> 6 then raise exception 'FAIL: expected 6 consent rows, got %', n; end if;
  if (select granted from public.organization_consents where org_id = org and kind = 'contact_sms') then raise exception 'FAIL: sms recorded as granted'; end if;

  -- members cannot tamper with consent records
  begin update public.organization_consents set granted = true where org_id = org;
    raise exception 'FAIL: consent rows writable'; exception when insufficient_privilege then null; end;
end $$;

do $$ begin raise exception 'ALL PASSED (rolled back)'; end $$;
