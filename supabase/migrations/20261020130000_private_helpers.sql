-- Move authorization helpers out of the exposed API schema (Supabase advisor 0028/0029).
-- Policies keep working (they reference functions by OID); RPCs that call helpers are recreated.

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

alter function public.is_platform_admin()                                 set schema app_private;
alter function public.is_super_admin()                                    set schema app_private;
alter function public.is_org_member(uuid)                                 set schema app_private;
alter function public.has_org_role(uuid, public.member_role[])            set schema app_private;
alter function public.shares_org_with(uuid)                               set schema app_private;
alter function public.org_has_capability(uuid, public.org_capability)    set schema app_private;

revoke execute on all functions in schema app_private from public, anon;
grant  execute on all functions in schema app_private to authenticated;

create or replace function public.admin_set_org_status(p_org uuid, p_status public.org_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
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
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.organization_capabilities (org_id, capability, status, decided_by, decided_at)
  values (p_org, p_cap, p_status, auth.uid(), now())
  on conflict (org_id, capability)
  do update set status = excluded.status, decided_by = excluded.decided_by, decided_at = excluded.decided_at;
end $$;

create or replace function public.super_admin_set_platform_role(p_user uuid, p_role public.platform_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.profiles set platform_role = p_role where id = p_user;
end $$;

-- Read-only helper for the app: the caller's own access summary (no other user's data).
create or replace function public.my_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'platform_role', (select p.platform_role from public.profiles p where p.id = auth.uid()),
    'organizations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'name', o.name, 'status', o.status, 'role', m.role,
        'can_refer',   app_private.org_has_capability(o.id, 'refer'),
        'can_receive', app_private.org_has_capability(o.id, 'receive'),
        'requested',   (select coalesce(jsonb_agg(c.capability), '[]'::jsonb)
                          from public.organization_capabilities c where c.org_id = o.id and c.status = 'requested')
      ) order by o.created_at)
      from public.organization_members m join public.organizations o on o.id = m.org_id
      where m.user_id = auth.uid() and o.deleted_at is null), '[]'::jsonb)
  );
$$;
revoke execute on function public.my_access() from public, anon;
grant  execute on function public.my_access() to authenticated;
