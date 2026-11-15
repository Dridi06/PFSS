-- PFMS authorization consistency and owner-integrity hardening.
-- Additive replacements only; no table data is rewritten.
-- Apply only after the staging migration ledger and schema have been reconciled.

-- Legacy PFSS authorization must respect the owning organization's lifecycle.
create or replace function public.pfss_has_org_role(
  p_organization_id uuid,
  p_allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and p_organization_id is not null
    and exists (
      select 1
      from public.pfss_memberships m
      join public.pfss_organizations o
        on o.id = m.organization_id
      where m.organization_id = p_organization_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and o.status = 'active'
        and (
          p_allowed_roles is null
          or m.role = any(p_allowed_roles)
        )
    );
$$;

revoke all on function public.pfss_has_org_role(uuid, text[])
  from public, anon;
grant execute on function public.pfss_has_org_role(uuid, text[])
  to authenticated;

comment on function public.pfss_has_org_role(uuid, text[]) is
  'Legacy PFSS membership predicate. Grants a role only when the caller has an active membership in an active organization; SECURITY DEFINER with empty search_path.';

-- Serialize membership changes per organization and protect the final active owner.
create or replace function public.pfms_admin_update_membership(
  p_membership_id uuid,
  p_member_role text,
  p_status text,
  p_permissions jsonb
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
  v_permissions jsonb;
begin
  if not public.pfms_is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_membership_id is null
     or p_member_role is null
     or p_member_role not in ('owner','admin','manager','scout','coach','member') then
    raise exception 'Invalid membership or member role' using errcode = '22023';
  end if;

  if p_status is null
     or p_status not in ('invited','active','suspended') then
    raise exception 'Invalid membership status' using errcode = '22023';
  end if;

  if p_permissions is null
     or pg_catalog.jsonb_typeof(p_permissions) is distinct from 'object' then
    raise exception 'Invalid permissions object' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_each(p_permissions) e
    where e.key not in (
      'view_players','create_players','edit_players','delete_players',
      'view_reports','create_reports','manage_members'
    )
    or pg_catalog.jsonb_typeof(e.value) is distinct from 'boolean'
  ) then
    raise exception 'Invalid permission key or value' using errcode = '22023';
  end if;

  -- Read the tenant key first, then lock the parent row. This serializes
  -- concurrent owner demotions/promotions made through this RPC.
  select m.organization_id
    into v_org_id
  from public.pfms_memberships m
  where m.id = p_membership_id;

  if not found then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  perform 1
  from public.pfms_organizations o
  where o.id = v_org_id
  for update;

  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  select m.organization_id, m.member_role, m.status
    into v_locked_org_id, v_current_role, v_current_status
  from public.pfms_memberships m
  where m.id = p_membership_id
  for update;

  if not found then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  if v_locked_org_id is distinct from v_org_id then
    raise exception 'Membership organization changed during update'
      using errcode = '40001';
  end if;

  if v_current_role = 'owner'
     and v_current_status = 'active'
     and (p_member_role <> 'owner' or p_status <> 'active')
     and not exists (
       select 1
       from public.pfms_memberships other_owner
       where other_owner.organization_id = v_org_id
         and other_owner.id <> p_membership_id
         and other_owner.member_role = 'owner'
         and other_owner.status = 'active'
     ) then
    raise exception 'The organization must retain at least one active owner'
      using errcode = '23514';
  end if;

  v_permissions := p_permissions;

  update public.pfms_memberships
  set member_role = p_member_role,
      status = p_status,
      permissions = v_permissions,
      updated_at = pg_catalog.now()
  where id = p_membership_id;
end;
$$;

revoke all on function public.pfms_admin_update_membership(uuid, text, text, jsonb)
  from public, anon;
grant execute on function public.pfms_admin_update_membership(uuid, text, text, jsonb)
  to authenticated;

comment on function public.pfms_admin_update_membership(uuid, text, text, jsonb) is
  'Platform-admin membership editor. Validates permission JSON, locks the parent organization before the membership row, and prevents demotion or suspension of the final active owner.';
