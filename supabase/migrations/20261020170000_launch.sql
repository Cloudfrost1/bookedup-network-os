-- Launch adjustments.
grant update (category_id, public_profile, available_for_referrals) on public.organizations to authenticated;

-- One-time bootstrap: the founder's account becomes super admin when it is created, only while no super admin exists.
create or replace function app_private.bootstrap_super_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where platform_role = 'super_admin')
     and exists (select 1 from auth.users u where u.id = new.id and lower(u.email) = 'joymensonsacramento@gmail.com') then
    new.platform_role := 'super_admin';
  end if;
  return new;
end $$;
revoke execute on function app_private.bootstrap_super_admin() from public, anon, authenticated;
create trigger profiles_bootstrap_super_admin before insert on public.profiles
  for each row execute function app_private.bootstrap_super_admin();
