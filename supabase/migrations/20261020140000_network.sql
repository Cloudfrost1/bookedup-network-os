-- Phase 2 · Network: catalog, services, service areas, directory, connections, admin follow-up.

create table public.service_categories (
  id         uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks (id),
  name       text not null check (char_length(name) between 2 and 80),
  slug       text not null,
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network_id, slug)
);
create trigger service_categories_updated_at before update on public.service_categories
  for each row execute function public.set_updated_at();

create table public.regions (
  id         uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks (id),
  state      text not null check (state ~ '^[A-Z]{2}$'),
  city       text not null,
  slug       text not null,
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  unique (network_id, slug)
);

insert into public.service_categories (network_id, name, slug, sort)
select n.id, c.name, c.slug, c.sort
from public.networks n,
(values ('Bathroom Remodeling','bathroom-remodeling',1),('Kitchen Remodeling','kitchen-remodeling',2),
        ('General Remodeling','general-remodeling',3),('Flooring','flooring',4),('Tile Installation','tile-installation',5),
        ('Plumbing','plumbing',6),('Electrical','electrical',7),('Painting','painting',8),('Roofing','roofing',9),
        ('Siding','siding',10),('Cabinets','cabinets',11),('Countertops','countertops',12),('Shower Glass','shower-glass',13),
        ('HVAC','hvac',14),('Landscaping','landscaping',15),('Water Damage Restoration','water-damage-restoration',16),
        ('Interior Design','interior-design',17),('Handyman Services','handyman-services',18)) as c(name, slug, sort)
where n.slug = 'orlando';

insert into public.regions (network_id, state, city, slug, sort)
select n.id, 'FL', r.city, r.slug, r.sort
from public.networks n,
(values ('Orlando','orlando',1),('Kissimmee','kissimmee',2),('Sanford','sanford',3),('Winter Park','winter-park',4),
        ('Winter Garden','winter-garden',5),('Lake Mary','lake-mary',6),('Altamonte Springs','altamonte-springs',7),
        ('Clermont','clermont',8)) as r(city, slug, sort)
where n.slug = 'orlando';

alter table public.organizations
  add constraint organizations_category_fk foreign key (category_id) references public.service_categories (id),
  add column public_profile boolean not null default true,
  add column available_for_referrals boolean not null default true;

create type public.service_kind as enum ('offered', 'not_offered');

create table public.organization_services (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  category_id uuid not null references public.service_categories (id),
  kind        public.service_kind not null,
  created_at  timestamptz not null default now(),
  primary key (org_id, category_id, kind)
);
create index organization_services_cat_idx on public.organization_services (category_id, kind);

create table public.organization_service_areas (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  region_id  uuid not null references public.regions (id),
  created_at timestamptz not null default now(),
  primary key (org_id, region_id)
);
create index organization_service_areas_region_idx on public.organization_service_areas (region_id);

create type public.connection_status as enum ('requested', 'accepted', 'declined', 'blocked');
create table public.organization_connections (
  id           uuid primary key default gen_random_uuid(),
  requester_org uuid not null references public.organizations (id) on delete cascade,
  addressee_org uuid not null references public.organizations (id) on delete cascade,
  status       public.connection_status not null default 'requested',
  requested_by uuid references auth.users (id) on delete set null,
  responded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (requester_org <> addressee_org)
);
create unique index organization_connections_pair_idx on public.organization_connections
  (least(requester_org, addressee_org), greatest(requester_org, addressee_org));
create trigger organization_connections_updated_at before update on public.organization_connections
  for each row execute function public.set_updated_at();

create table public.organization_followups (
  org_id             uuid primary key references public.organizations (id) on delete cascade,
  relationship_owner uuid references auth.users (id) on delete set null,
  last_contact_at    timestamptz,
  next_followup_at   timestamptz,
  outcome            text check (char_length(outcome) <= 200),
  notes              text check (char_length(notes) <= 4000),
  updated_at         timestamptz not null default now()
);
create trigger organization_followups_updated_at before update on public.organization_followups
  for each row execute function public.set_updated_at();

-- RLS
alter table public.service_categories         enable row level security;
alter table public.regions                    enable row level security;
alter table public.organization_services      enable row level security;
alter table public.organization_service_areas enable row level security;
alter table public.organization_connections   enable row level security;
alter table public.organization_followups     enable row level security;

create policy categories_read on public.service_categories for select to anon, authenticated using (true);
create policy regions_read on public.regions for select to anon, authenticated using (true);
create policy categories_admin on public.service_categories for all to authenticated
  using (app_private.is_platform_admin()) with check (app_private.is_platform_admin());

create policy services_read on public.organization_services for select to authenticated
  using (app_private.is_org_member(org_id) or app_private.is_platform_admin());
create policy services_write on public.organization_services for all to authenticated
  using (app_private.has_org_role(org_id, array['owner','manager']::public.member_role[]) or app_private.is_platform_admin())
  with check (app_private.has_org_role(org_id, array['owner','manager']::public.member_role[]) or app_private.is_platform_admin());

create policy areas_read on public.organization_service_areas for select to authenticated
  using (app_private.is_org_member(org_id) or app_private.is_platform_admin());
create policy areas_write on public.organization_service_areas for all to authenticated
  using (app_private.has_org_role(org_id, array['owner','manager']::public.member_role[]) or app_private.is_platform_admin())
  with check (app_private.has_org_role(org_id, array['owner','manager']::public.member_role[]) or app_private.is_platform_admin());

create policy connections_read on public.organization_connections for select to authenticated
  using (app_private.is_org_member(requester_org) or app_private.is_org_member(addressee_org) or app_private.is_platform_admin());

create policy followups_admin on public.organization_followups for all to authenticated
  using (app_private.is_platform_admin()) with check (app_private.is_platform_admin());

revoke all on public.organization_services, public.organization_service_areas, public.organization_connections,
              public.organization_followups from anon;
revoke insert, update, delete on public.regions from anon, authenticated;
revoke insert, update, delete on public.service_categories from anon;
revoke insert, update, delete on public.organization_connections from authenticated;
grant  update (public_profile, available_for_referrals, category_id) on public.organizations to authenticated;

-- ---------------------------------------------------------------- signup v2: business + services + areas in one call
create or replace function public.create_organization_v2(
  p_name text, p_category uuid, p_email text, p_phone text, p_website text,
  p_state text, p_city text, p_zip text,
  p_wants_refer boolean, p_wants_receive boolean,
  p_out_of_scope public.out_of_scope_bucket,
  p_offered uuid[], p_not_offered uuid[], p_regions uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  v_org := public.create_organization(p_name, p_email, p_phone, p_website, p_state, p_city, p_zip,
                                      p_wants_refer, p_wants_receive, p_out_of_scope);
  update public.organizations set category_id = p_category where id = v_org;
  insert into public.organization_services (org_id, category_id, kind)
    select v_org, c, 'offered' from unnest(coalesce(p_offered, '{}')) c
    where exists (select 1 from public.service_categories s where s.id = c)
    on conflict do nothing;
  insert into public.organization_services (org_id, category_id, kind)
    select v_org, c, 'not_offered' from unnest(coalesce(p_not_offered, '{}')) c
    where exists (select 1 from public.service_categories s where s.id = c)
      and not (c = any (coalesce(p_offered, '{}')))
    on conflict do nothing;
  insert into public.organization_service_areas (org_id, region_id)
    select v_org, r from unnest(coalesce(p_regions, '{}')) r
    where exists (select 1 from public.regions g where g.id = r)
    on conflict do nothing;
  return v_org;
end $$;
revoke execute on function public.create_organization_v2(text, uuid, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket, uuid[], uuid[], uuid[]) from public, anon;
grant  execute on function public.create_organization_v2(text, uuid, text, text, text, text, text, text, boolean, boolean, public.out_of_scope_bucket, uuid[], uuid[], uuid[]) to authenticated;

-- Capability check usable for any org (no membership needed), only reveals approved/not.
create or replace function app_private.org_has_capability_any(p_org uuid, p_cap public.org_capability)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_capabilities c join public.organizations o on o.id = c.org_id
    where c.org_id = p_org and c.capability = p_cap and c.status = 'approved' and o.status = 'approved' and o.deleted_at is null
  );
$$;
grant execute on function app_private.org_has_capability_any(uuid, public.org_capability) to anon, authenticated;
grant usage on schema app_private to anon;

-- ---------------------------------------------------------------- directory (public and private views of approved businesses)
create or replace function public.directory_search(
  p_category uuid default null, p_region uuid default null, p_zip text default null,
  p_query text default null, p_private boolean default false, p_limit int default 50, p_offset int default 0
) returns table (
  id uuid, slug text, name text, logo_path text, primary_category text, city text, state text,
  verified boolean, can_receive boolean, services text[], areas text[],
  phone text, email text, website text, description text
) language sql stable security definer set search_path = '' as $$
  with viewer as (
    select (p_private and auth.uid() is not null and exists (
      select 1 from public.organization_members m join public.organizations o on o.id = m.org_id
      where m.user_id = auth.uid() and o.status = 'approved' and o.deleted_at is null
    )) as is_member
  )
  select o.id, o.slug, o.name, o.logo_path, c.name, o.city, o.state,
         o.verification = 'verified',
         app_private.org_has_capability_any(o.id, 'receive'),
         coalesce((select array_agg(sc.name order by sc.sort) from public.organization_services s
                   join public.service_categories sc on sc.id = s.category_id
                   where s.org_id = o.id and s.kind = 'offered'), '{}'),
         coalesce((select array_agg(r.city order by r.sort) from public.organization_service_areas a
                   join public.regions r on r.id = a.region_id where a.org_id = o.id), '{}'),
         case when v.is_member then o.phone end,
         case when v.is_member then o.email end,
         o.website,
         o.description
  from public.organizations o
  cross join viewer v
  left join public.service_categories c on c.id = o.category_id
  where o.status = 'approved' and o.deleted_at is null
    and (o.public_profile or v.is_member)
    and (p_category is null or exists (select 1 from public.organization_services s
           where s.org_id = o.id and s.category_id = p_category and s.kind = 'offered'))
    and (p_region is null or exists (select 1 from public.organization_service_areas a
           where a.org_id = o.id and a.region_id = p_region))
    and (p_zip is null or o.zip = p_zip)
    and (p_query is null or o.name ilike '%' || p_query || '%')
  order by o.verification = 'verified' desc, o.name
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;


revoke execute on function public.directory_search(uuid, uuid, text, text, boolean, int, int) from public;
grant  execute on function public.directory_search(uuid, uuid, text, text, boolean, int, int) to anon, authenticated;

create or replace function public.directory_profile(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(d) from public.directory_search(p_private => true, p_limit => 100) d
  where d.slug = p_slug
  union all
  select to_jsonb(d) from public.directory_search(p_limit => 100) d
  where d.slug = p_slug
  limit 1;
$$;
revoke execute on function public.directory_profile(text) from public;
grant  execute on function public.directory_profile(text) to anon, authenticated;

-- Coverage by city and service (public: counts only).
create or replace function public.services_coverage(p_category uuid default null, p_region uuid default null)
returns table (region_id uuid, city text, category_id uuid, service text, providers bigint)
language sql stable security definer set search_path = '' as $$
  select r.id, r.city, c.id, c.name, count(distinct o.id)
  from public.regions r cross join public.service_categories c
  left join public.organization_service_areas a on a.region_id = r.id
  left join public.organization_services s on s.org_id = a.org_id and s.category_id = c.id and s.kind = 'offered'
  left join public.organizations o on o.id = s.org_id and o.status = 'approved' and o.deleted_at is null
    and app_private.org_has_capability_any(o.id, 'receive')
  where r.active and c.active
    and (p_category is null or c.id = p_category) and (p_region is null or r.id = p_region)
  group by r.id, r.city, r.sort, c.id, c.name, c.sort
  order by r.sort, c.sort;
$$;
revoke execute on function public.services_coverage(uuid, uuid) from public;
grant  execute on function public.services_coverage(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------- connections
create or replace function public.request_connection(p_from uuid, p_to uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not app_private.has_org_role(p_from, array['owner','manager','member']::public.member_role[]) then
    raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.organizations o where o.id = p_from and o.status = 'approved')
     or not exists (select 1 from public.organizations o where o.id = p_to and o.status = 'approved') then
    raise exception 'Both businesses must be approved' using errcode = '22023'; end if;
  insert into public.organization_connections (requester_org, addressee_org, requested_by)
  values (p_from, p_to, auth.uid())
  on conflict do nothing returning id into v_id;
  if v_id is null then raise exception 'A connection already exists' using errcode = '23505'; end if;
  insert into public.notifications (org_id, type, title, link)
  values (p_to, 'connection_requested', (select name from public.organizations where id = p_from) || ' wants to connect', '/app/partners');
  return v_id;
end $$;

create or replace function public.respond_connection(p_connection uuid, p_status public.connection_status)
returns void language plpgsql security definer set search_path = '' as $$
declare v_to uuid;
begin
  select addressee_org into v_to from public.organization_connections where id = p_connection;
  if v_to is null or not app_private.has_org_role(v_to, array['owner','manager']::public.member_role[]) then
    raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_status not in ('accepted','declined','blocked') then raise exception 'Invalid status' using errcode = '22023'; end if;
  update public.organization_connections set status = p_status, responded_at = now() where id = p_connection;
end $$;

revoke execute on function public.request_connection(uuid, uuid) from public, anon;
grant  execute on function public.request_connection(uuid, uuid) to authenticated;
revoke execute on function public.respond_connection(uuid, public.connection_status) from public, anon;
grant  execute on function public.respond_connection(uuid, public.connection_status) to authenticated;
