-- Super admins can remove an organization from the network (soft delete, reversible, fully audited).
-- Referral history, scores and audit logs are kept; the business disappears from the app, directory and matching.
create or replace function public.admin_delete_organization(p_org uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_super_admin() then raise exception 'Only super admins can delete organizations' using errcode = '42501'; end if;
  if not exists (select 1 from public.organizations where id = p_org and deleted_at is null) then
    raise exception 'Organization not found' using errcode = 'P0002'; end if;
  update public.organization_capabilities set status = 'revoked' where org_id = p_org and status <> 'revoked';
  update public.referral_assignments set status = 'withdrawn', last_update_at = now()
   where provider_org_id = p_org and status = 'offered';
  update public.organizations
     set deleted_at = now(), status = 'suspended', available_for_referrals = false, public_profile = false
   where id = p_org;
  insert into public.audit_logs (actor_id, action, entity, entity_id, org_id, metadata)
  values (auth.uid(), 'organization_deleted', 'organizations', p_org, p_org,
          jsonb_build_object('reason', left(coalesce(p_reason, ''), 500)));
end $$;

create or replace function public.admin_restore_organization(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_super_admin() then raise exception 'Only super admins can restore organizations' using errcode = '42501'; end if;
  update public.organizations set deleted_at = null, status = 'pending_review' where id = p_org and deleted_at is not null;
  insert into public.audit_logs (actor_id, action, entity, entity_id, org_id, metadata)
  values (auth.uid(), 'organization_restored', 'organizations', p_org, p_org, '{}'::jsonb);
end $$;

revoke execute on function public.admin_delete_organization(uuid, text) from public, anon;
grant  execute on function public.admin_delete_organization(uuid, text) to authenticated;
revoke execute on function public.admin_restore_organization(uuid) from public, anon;
grant  execute on function public.admin_restore_organization(uuid) to authenticated;
