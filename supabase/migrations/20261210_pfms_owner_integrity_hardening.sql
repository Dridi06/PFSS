-- PFMS administrator and organization-owner integrity hardening.
-- Additive replacement of existing management RPCs; no data is rewritten.
-- Apply only after reviewing the staging migration plan and backup.

create or replace function public.pfss_admin_update_profile(
  p_user_id uuid,
  p_role text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_user_id is null
     or p_role is null
     or p_role not in ('user', 'scout', 'admin') then
    raise exception 'Invalid user or role' using errcode = '22023';
  end if;

  if p_status is null
     or p_status not in ('pending', 'approved', 'suspended') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own administrator profile'
      using errcode = '42501';
  end if;

  -- A platform administrator must not be able to disable or demote the
  -- separately designated platform owner through the ordinary user editor.
  if exists (
    select 1
    from public.pfms_platform_owner po
    where po.singleton is true
      and po.owner_user_id = p_user_id
  ) then
    raise exception 'The platform owner account is protected'
      using errcode = '42501';
  end if;

  update public.profiles
  set role = p_role,
      status = p_status
  where id = p_user_id;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.pfss_admin_update_profile(uuid, text, text)
  from public, anon;
grant execute on function public.pfss_admin_update_profile(uuid, text, text)
  to authenticated;


create or replace function public.pfms_admin_update_legacy_membership(
  p_membership_id uuid,
  p_role text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_locked_org_id uuid;
  v_current_role text;
  v_current_status text;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_role is null or p_role not in (
    'owner', 'club_admin', 'agency_admin', 'scout',
    'trainer', 'co_trainer', 'betreuer', 'member'
  ) then
    raise exception 'Invalid membership role' using errcode = '22023';
  end if;

  if p_status is null or p_status not in ('pending', 'active', 'suspended') then
    raise exception 'Invalid membership status' using errcode = '22023';
  end if;

  -- Lock the parent organization before locking the membership row. All
  -- owner-role changes through this RPC therefore serialize per organization.
  select m.organization_id
    into v_org_id
  from public.organization_memberships m
  where m.id = p_membership_id;

  if not found then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  perform 1
  from public.organizations o
  where o.id = v_org_id
  for update;

  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  select m.organization_id, m.role, m.status
    into v_locked_org_id, v_current_role, v_current_status
  from public.organization_memberships m
  where m.id = p_membership_id
  for update;

  if not found then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  if v_locked_org_id <> v_org_id then
    raise exception 'Membership organization changed during update'
      using errcode = '40001';
  end if;

  if v_current_role = 'owner'
     and v_current_status = 'active'
     and (p_role <> 'owner' or p_status <> 'active')
     and not exists (
       select 1
       from public.organization_memberships other_owner
       where other_owner.organization_id = v_org_id
         and other_owner.id <> p_membership_id
         and other_owner.role = 'owner'
         and other_owner.status = 'active'
     ) then
    raise exception 'The organization must retain at least one active owner'
      using errcode = '23514';
  end if;

  update public.organization_memberships
  set role = p_role,
      status = p_status,
      updated_at = pg_catalog.now()
  where id = p_membership_id;
end;
$$;

revoke all on function public.pfms_admin_update_legacy_membership(uuid, text, text)
  from public, anon;
grant execute on function public.pfms_admin_update_legacy_membership(uuid, text, text)
  to authenticated;

comment on function public.pfss_admin_update_profile(uuid, text, text) is
  'Administrator profile editor; cannot modify the separately designated platform owner.';
comment on function public.pfms_admin_update_legacy_membership(uuid, text, text) is
  'Serialized administrator membership update; parent organization is locked before enforcing the active-owner invariant.';
