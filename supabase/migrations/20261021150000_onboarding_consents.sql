-- Onboarding hardening: complete operational profile + recorded consents (append-only audit trail).

create table if not exists public.organization_consents (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in (
                'terms_privacy',          -- accepted Terms of Service + Privacy Policy
                'data_use',               -- BookedUp may use business data for matching and review
                'referral_authorization', -- will only refer customers who allowed their details to be shared
                'contact_email', 'contact_sms', 'contact_whatsapp')),
  granted     boolean not null,
  version     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists organization_consents_org_idx on public.organization_consents (org_id, kind, created_at desc);

alter table public.organization_consents enable row level security;
create policy consents_read on public.organization_consents for select to authenticated
  using (app_private.is_org_member(org_id) or app_private.is_platform_admin());
-- no insert/update/delete policies: rows are written only by create_organization_v3 (security definer)
revoke insert, update, delete on public.organization_consents from anon, authenticated;
grant select on public.organization_consents to authenticated;

create or replace function public.create_organization_v3(
  p_name text, p_category uuid, p_email text, p_phone text, p_website text,
  p_state text, p_city text, p_zip text, p_wants_refer boolean, p_wants_receive boolean,
  p_out_of_scope public.out_of_scope_bucket, p_offered uuid[], p_not_offered uuid[], p_regions uuid[],
  p_consents jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_version constant text := '2026-10-21';
  k text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  -- operational completeness (also validated in the app)
  if not (coalesce(p_wants_refer, false) or coalesce(p_wants_receive, false)) then
    raise exception 'choose refer and/or receive' using errcode = '22023'; end if;
  if nullif(trim(coalesce(p_phone, '')), '') is null then
    raise exception 'phone required' using errcode = '22023'; end if;
  if coalesce(cardinality(p_offered), 0) = 0 then
    raise exception 'offered services required' using errcode = '22023'; end if;
  if coalesce(cardinality(p_regions), 0) = 0 then
    raise exception 'service area required' using errcode = '22023'; end if;
  if p_out_of_scope is null then
    raise exception 'out of scope volume required' using errcode = '22023'; end if;
  if p_wants_refer and coalesce(cardinality(p_not_offered), 0) = 0 then
    raise exception 'services turned down required to refer' using errcode = '22023'; end if;

  -- required consents
  if coalesce((p_consents->>'terms_privacy')::boolean, false) is not true
     or coalesce((p_consents->>'data_use')::boolean, false) is not true
     or coalesce((p_consents->>'contact_email')::boolean, false) is not true then
    raise exception 'required consents missing' using errcode = '22023'; end if;
  if p_wants_refer and coalesce((p_consents->>'referral_authorization')::boolean, false) is not true then
    raise exception 'referral authorization required' using errcode = '22023'; end if;

  v_org := public.create_organization_v2(p_name, p_category, p_email, p_phone, p_website, p_state, p_city, p_zip,
    p_wants_refer, p_wants_receive, p_out_of_scope, p_offered, p_not_offered, p_regions);

  foreach k in array array['terms_privacy','data_use','referral_authorization','contact_email','contact_sms','contact_whatsapp'] loop
    if k = 'referral_authorization' and not p_wants_refer then continue; end if;
    insert into public.organization_consents (org_id, user_id, kind, granted, version)
    values (v_org, auth.uid(), k, coalesce((p_consents->>k)::boolean, false), v_version);
  end loop;

  return v_org;
end $$;

revoke all on function public.create_organization_v3(text, uuid, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket, uuid[], uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.create_organization_v3(text, uuid, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket, uuid[], uuid[], uuid[], jsonb) to authenticated;

-- older creation paths skipped these checks: only v3 may be called by clients
revoke execute on function public.create_organization(text, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket) from public, anon, authenticated;
revoke execute on function public.create_organization_v2(text, uuid, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket, uuid[], uuid[], uuid[]) from public, anon, authenticated;
