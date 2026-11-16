-- PFMS legacy organization invitation hardening.
-- Supports the two existing approved states used by the legacy organization
-- installation ("approved" and "active") without weakening manager checks.

create or replace function public.pfms_list_my_manageable_legacy_organizations()
returns table (
  organization_id uuid,
  organization_name text,
  organization_type text,
  organization_status text,
  member_role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.name,
    o.organization_type,
    o.status,
    coalesce(m.role, 'platform_admin')
  from public.organizations o
  left join public.organization_memberships m
    on m.organization_id = o.id
   and m.user_id = auth.uid()
   and m.status = 'active'
  where public.is_admin()
     or (m.id is not null and public.can_manage_org(o.id))
  order by pg_catalog.lower(o.name);
$$;

revoke all on function public.pfms_list_my_manageable_legacy_organizations() from public, anon;
grant execute on function public.pfms_list_my_manageable_legacy_organizations() to authenticated;

create or replace function public.pfms_create_legacy_invitation(
  p_organization_id uuid,
  p_role text default 'scout',
  p_expires_in_days integer default 7
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_org_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'Organization is required' using errcode = '22023';
  end if;

  if p_role not in ('scout','trainer','co_trainer','betreuer','member') then
    raise exception 'Role cannot be assigned by invitation' using errcode = '22023';
  end if;

  if p_expires_in_days is null or p_expires_in_days < 1 or p_expires_in_days > 30 then
    raise exception 'Invitation validity must be between 1 and 30 days' using errcode = '22023';
  end if;

  if not (public.is_admin() or public.can_manage_org(p_organization_id)) then
    raise exception 'Not authorized to invite members' using errcode = '42501';
  end if;

  select o.status
    into v_org_status
  from public.organizations o
  where o.id = p_organization_id
  for share;

  if not found or v_org_status not in ('approved','active') then
    raise exception 'Organization is not active or approved' using errcode = '42501';
  end if;

  v_code := pg_catalog.upper(
    pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '')
  );

  insert into public.organization_invitations (
    code_hash, organization_id, role, created_by, expires_at
  )
  values (
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(v_code, 'UTF8')),
      'hex'
    ),
    p_organization_id,
    p_role,
    auth.uid(),
    pg_catalog.now() + pg_catalog.make_interval(days => p_expires_in_days)
  );

  return v_code;
end;
$$;

revoke all on function public.pfms_create_legacy_invitation(uuid, text, integer) from public, anon;
grant execute on function public.pfms_create_legacy_invitation(uuid, text, integer) to authenticated;
