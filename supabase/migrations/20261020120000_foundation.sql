-- BookedUp Network OS · Phase 1 · Foundation
-- Networks, profiles, organizations, members, capabilities, authorization helpers, RLS, audit.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- enums
create type public.platform_role      as enum ('super_admin', 'admin');
create type public.org_status         as enum ('pending_review', 'approved', 'suspended', 'rejected');
create type public.verification_status as enum ('not_verified', 'pending', 'verified', 'expired');
create type public.member_role        as enum ('owner', 'manager', 'member');
create type public.org_capability     as enum ('refer', 'receive');
create type public.capability_status  as enum ('requested', 'approved', 'revoked');
create type public.out_of_scope_bucket as enum ('0', '1-2', '3-5', '6+');

-- ---------------------------------------------------------------- shared trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- networks
create table public.networks (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  status     text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger networks_updated_at before update on public.networks
  for each row execute function public.set_updated_at();

insert into public.networks (name, slug) values ('BookedUp Orlando', 'orlando');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text check (char_length(full_name) <= 120),
  phone         text check (char_length(phone) <= 32),
  platform_role public.platform_role,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- organizations
create table public.organizations (
  id                    uuid primary key default gen_random_uuid(),
  network_id            uuid not null references public.networks (id),
  name                  text not null check (char_length(name) between 2 and 120),
  slug                  text not null unique,
  category_id           uuid,               -- FK added in Phase 2 (service_categories)
  email                 text check (char_length(email) <= 254),
  phone                 text check (char_length(phone) <= 32),
  website               text check (char_length(website) <= 300),
  logo_path             text,
  description           text check (char_length(description) <= 2000),
  state                 text check (char_length(state) <= 2),
  city                  text check (char_length(city) <= 80),
  zip                   text check (zip ~ '^[0-9]{5}$'),
  status                public.org_status not null default 'pending_review',
  verification          public.verification_status not null default 'not_verified',
  referral_code         text not null unique,
  out_of_scope_last_30d public.out_of_scope_bucket,
  created_by            uuid references auth.users (id) on delete set null,
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index organizations_network_status_idx on public.organizations (network_id, status) where deleted_at is null;
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- members
create table public.organization_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);
create trigger organization_members_updated_at before update on public.organization_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- capabilities
create table public.organization_capabilities (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  capability   public.org_capability not null,
  status       public.capability_status not null default 'requested',
  requested_at timestamptz not null default now(),
  decided_by   uuid references auth.users (id) on delete set null,
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (org_id, capability)
);
create trigger organization_capabilities_updated_at before update on public.organization_capabilities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- audit log
create table public.audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  org_id     uuid,
  metadata   jsonb not null default '{}'::jsonb,   -- never personal data, only field names and status changes
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_org_idx on public.audit_logs (org_id, created_at desc);

-- ---------------------------------------------------------------- authorization helpers
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role is not null);
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'super_admin');
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members m where m.org_id = p_org and m.user_id = auth.uid());
$$;

create or replace function public.has_org_role(p_org uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid() and m.role = any (p_roles)
  );
$$;

create or replace function public.shares_org_with(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members a
    join public.organization_members b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- Capability counts only when the organization itself is approved and not deleted.
create or replace function public.org_has_capability(p_org uuid, p_cap public.org_capability)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_capabilities c
    join public.organizations o on o.id = c.org_id
    where c.org_id = p_org and c.capability = p_cap and c.status = 'approved'
      and o.status = 'approved' and o.deleted_at is null
  );
$$;

-- ---------------------------------------------------------------- audit trigger
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_changed text[];
  v_meta jsonb := '{}'::jsonb;
  v_org uuid;
begin
  if tg_op = 'UPDATE' then
    select array_agg(k) into v_changed
    from jsonb_object_keys(v_new) k
    where k <> 'updated_at' and v_new -> k is distinct from v_old -> k;
    if v_changed is null then return new; end if;
    v_meta := jsonb_build_object('changed', to_jsonb(v_changed));
    -- status-like fields are safe to record with values (no personal data)
    if v_new ? 'status' and v_new -> 'status' is distinct from v_old -> 'status' then
      v_meta := v_meta || jsonb_build_object('status_from', v_old -> 'status', 'status_to', v_new -> 'status');
    end if;
    if v_new ? 'role' and v_new -> 'role' is distinct from v_old -> 'role' then
      v_meta := v_meta || jsonb_build_object('role_from', v_old -> 'role', 'role_to', v_new -> 'role');
    end if;
  end if;

  v_org := coalesce((coalesce(v_new, v_old) ->> 'org_id')::uuid,
                    case when tg_table_name = 'organizations' then (coalesce(v_new, v_old) ->> 'id')::uuid end);

  insert into public.audit_logs (actor_id, action, entity, entity_id, org_id, metadata)
  values (auth.uid(), lower(tg_op), tg_table_name, (coalesce(v_new, v_old) ->> 'id')::uuid, v_org, v_meta);

  return coalesce(new, old);
end $$;

create trigger audit_organizations after insert or update or delete on public.organizations
  for each row execute function public.audit_row_change();
create trigger audit_organization_members after insert or update or delete on public.organization_members
  for each row execute function public.audit_row_change();
create trigger audit_organization_capabilities after insert or update or delete on public.organization_capabilities
  for each row execute function public.audit_row_change();
create trigger audit_profiles_role after update of platform_role on public.profiles
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------- guard: every org keeps an owner
create or replace function public.ensure_org_has_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid := old.org_id;
begin
  if exists (select 1 from public.organizations o where o.id = v_org) and not exists (
    select 1 from public.organization_members m where m.org_id = v_org and m.role = 'owner'
  ) then
    raise exception 'An organization must keep at least one owner';
  end if;
  return null;
end $$;

create constraint trigger organization_members_keep_owner
  after update or delete on public.organization_members
  deferrable initially deferred
  for each row execute function public.ensure_org_has_owner();

-- ---------------------------------------------------------------- RPC: create organization (signup)
create or replace function public.create_organization(
  p_name text,
  p_email text,
  p_phone text,
  p_website text,
  p_state text,
  p_city text,
  p_zip text,
  p_wants_refer boolean,
  p_wants_receive boolean,
  p_out_of_scope public.out_of_scope_bucket default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_slug text;
  v_network uuid;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if not (coalesce(p_wants_refer, false) or coalesce(p_wants_receive, false)) then
    raise exception 'Choose at least one: refer or receive projects' using errcode = '22023';
  end if;
  if (select count(*) from public.organization_members m where m.user_id = v_uid and m.role = 'owner') >= 5 then
    raise exception 'Organization limit reached for this account' using errcode = '54000';
  end if;

  select id into v_network from public.networks where slug = 'orlando';
  v_slug := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'))
            || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.organizations (network_id, name, slug, email, phone, website, state, city, zip,
                                    referral_code, out_of_scope_last_30d, created_by)
  values (v_network, trim(p_name), v_slug, nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
          nullif(trim(p_website), ''), upper(nullif(trim(p_state), '')), nullif(trim(p_city), ''),
          nullif(trim(p_zip), ''), substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
          p_out_of_scope, v_uid)
  returning id into v_org;

  insert into public.organization_members (org_id, user_id, role) values (v_org, v_uid, 'owner');

  if p_wants_refer then
    insert into public.organization_capabilities (org_id, capability) values (v_org, 'refer');
  end if;
  if p_wants_receive then
    insert into public.organization_capabilities (org_id, capability) values (v_org, 'receive');
  end if;

  return v_org;
end $$;

-- ---------------------------------------------------------------- RPC: admin decisions
create or replace function public.admin_set_org_status(p_org uuid, p_status public.org_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.organizations set status = p_status where id = p_org and deleted_at is null;
  if not found then raise exception 'Organization not found' using errcode = 'P0002'; end if;
  if p_note is not null then
    insert into public.audit_logs (actor_id, action, entity, entity_id, org_id, metadata)
    values (auth.uid(), 'note', 'organizations', p_org, p_org, jsonb_build_object('note', left(p_note, 500)));
  end if;
end $$;

create or replace function public.admin_set_capability(p_org uuid, p_cap public.org_capability, p_status public.capability_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.organization_capabilities (org_id, capability, status, decided_by, decided_at)
  values (p_org, p_cap, p_status, auth.uid(), now())
  on conflict (org_id, capability)
  do update set status = excluded.status, decided_by = excluded.decided_by, decided_at = excluded.decided_at;
end $$;

create or replace function public.super_admin_set_platform_role(p_user uuid, p_role public.platform_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.profiles set platform_role = p_role where id = p_user;
end $$;

-- ---------------------------------------------------------------- RLS
alter table public.networks                  enable row level security;
alter table public.profiles                  enable row level security;
alter table public.organizations             enable row level security;
alter table public.organization_members      enable row level security;
alter table public.organization_capabilities enable row level security;
alter table public.audit_logs                enable row level security;

-- networks: readable by everyone (name only, no private data)
create policy networks_read on public.networks for select to anon, authenticated using (true);

-- profiles
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_platform_admin() or public.shares_org_with(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- organizations (public directory comes in Phase 2 through a restricted view)
create policy organizations_read on public.organizations for select to authenticated
  using (public.is_org_member(id) or public.is_platform_admin());
create policy organizations_update on public.organizations for update to authenticated
  using (deleted_at is null and (public.has_org_role(id, array['owner','manager']::public.member_role[]) or public.is_platform_admin()))
  with check (public.has_org_role(id, array['owner','manager']::public.member_role[]) or public.is_platform_admin());

-- members: visible to the same organization and admins; writes only through RPCs (Phase 2 invites)
create policy members_read on public.organization_members for select to authenticated
  using (public.is_org_member(org_id) or public.is_platform_admin());

-- capabilities: visible to the same organization and admins; writes only through RPCs
create policy capabilities_read on public.organization_capabilities for select to authenticated
  using (public.is_org_member(org_id) or public.is_platform_admin());

-- audit logs: admins only
create policy audit_read on public.audit_logs for select to authenticated using (public.is_platform_admin());

-- ---------------------------------------------------------------- privileges (defense in depth on top of RLS)
revoke all on public.profiles, public.organizations, public.organization_members,
              public.organization_capabilities, public.audit_logs from anon;
revoke insert, update, delete on public.networks from anon, authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant  update (full_name, phone) on public.profiles to authenticated;
revoke insert, delete on public.organizations from authenticated;
revoke update on public.organizations from authenticated;
grant  update (name, email, phone, website, logo_path, description, state, city, zip, out_of_scope_last_30d)
  on public.organizations to authenticated;
revoke insert, update, delete on public.organization_members from authenticated;
revoke insert, update, delete on public.organization_capabilities from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;

revoke execute on function public.create_organization(text, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket) from public, anon;
grant  execute on function public.create_organization(text, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket) to authenticated;
revoke execute on function public.admin_set_org_status(uuid, public.org_status, text) from public, anon;
grant  execute on function public.admin_set_org_status(uuid, public.org_status, text) to authenticated;
revoke execute on function public.admin_set_capability(uuid, public.org_capability, public.capability_status) from public, anon;
grant  execute on function public.admin_set_capability(uuid, public.org_capability, public.capability_status) to authenticated;
revoke execute on function public.super_admin_set_platform_role(uuid, public.platform_role) from public, anon;
grant  execute on function public.super_admin_set_platform_role(uuid, public.platform_role) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.audit_row_change() from public, anon, authenticated;
revoke execute on function public.ensure_org_has_owner() from public, anon, authenticated;
