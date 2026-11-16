-- PFMS legacy manager RPC boundary.
-- Keep organization-manager operations separate from platform-admin ownership changes.
-- The platform-admin frontend already uses pfms_admin_update_legacy_membership,
-- which serializes ownership changes and protects the last active owner.

create or replace function public.pfms_update_legacy_org_membership_for_manager(
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
  v_organization_id uuid;
  v_user_id uuid;
  v_current_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Platform administrators must use the dedicated RPC that enforces the
  -- serialized last-active-owner invariant. This legacy manager RPC must
  -- never be an alternate route around that invariant.
  if public.is_admin() then
    raise exception 'Platform administrators must use pfms_admin_update_legacy_membership'
      using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('scout','trainer','co_trainer','betreuer','member') then
    raise exception 'Invalid operational role' using errcode = '22023';
  end if;

  if p_status is null or p_status not in ('pending','active','suspended') then
    raise exception 'Invalid membership status' using errcode = '22023';
  end if;

  select m.organization_id, m.user_id, m.role
    into v_organization_id, v_user_id, v_current_role
  from public.organization_memberships m
  where m.id = p_membership_id
  for update;

  if not found then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_org(v_organization_id) then
    raise exception 'Not authorized to manage this membership' using errcode = '42501';
  end if;

  -- Leadership roles are protected for every caller of this manager RPC.
  if v_current_role in ('owner','club_admin','agency_admin') then
    raise exception 'Leadership roles may only be changed through the platform administrator workflow'
      using errcode = '42501';
  end if;

  if v_user_id = auth.uid() and p_status = 'suspended' then
    raise exception 'You cannot suspend your own organization membership'
      using errcode = '42501';
  end if;

  update public.organization_memberships
  set role = p_role,
      status = p_status,
      updated_at = pg_catalog.now()
  where id = p_membership_id;
end;
$$;

revoke all on function public.pfms_update_legacy_org_membership_for_manager(uuid, text, text)
  from public, anon;
grant execute on function public.pfms_update_legacy_org_membership_for_manager(uuid, text, text)
  to authenticated;

comment on function public.pfms_update_legacy_org_membership_for_manager(uuid, text, text) is
  'Organization-manager-only operational membership editor. Platform administrators must use the serialized admin RPC that protects the final active owner.';
