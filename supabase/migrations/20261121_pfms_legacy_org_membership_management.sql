-- PFMS legacy organization membership administration.
-- Only platform admins or active legacy organization managers may list members.
-- Organization managers may manage operational roles, not owner/leadership roles.

create or replace function public.pfms_list_legacy_org_members_for_manager(
  p_organization_id uuid,
  p_query text default '',
  p_status text default null,
  p_role text default null
)
returns table (
  membership_id uuid,
  user_id uuid,
  username text,
  full_name text,
  email text,
  member_role text,
  membership_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := pg_catalog.btrim(coalesce(p_query, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (public.is_admin() or public.can_manage_org(p_organization_id)) then
    raise exception 'Not authorized to view organization members' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in ('pending', 'active', 'suspended') then
    raise exception 'Invalid membership status' using errcode = '22023';
  end if;

  if p_role is not null and p_role not in (
    'owner', 'club_admin', 'agency_admin',
    'scout', 'trainer', 'co_trainer', 'betreuer', 'member'
  ) then
    raise exception 'Invalid membership role' using errcode = '22023';
  end if;

  return query
  select
    m.id,
    m.user_id,
    p.username,
    p.full_name,
    u.email,
    m.role,
    m.status
  from public.organization_memberships m
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.organization_id = p_organization_id
    and (p_status is null or m.status = p_status)
    and (p_role is null or m.role = p_role)
    and (
      v_query = ''
      or coalesce(p.username, '') ilike '%' || v_query || '%'
      or coalesce(p.full_name, '') ilike '%' || v_query || '%'
      or coalesce(u.email, '') ilike '%' || v_query || '%'
      or m.user_id::text ilike '%' || v_query || '%'
    )
  order by
    case m.role
      when 'owner' then 0
      when 'club_admin' then 1
      when 'agency_admin' then 1
      else 2
    end,
    pg_catalog.lower(coalesce(p.username, p.full_name, u.email, ''));
end;
$$;

revoke all on function public.pfms_list_legacy_org_members_for_manager(uuid, text, text, text)
  from public, anon;
grant execute on function public.pfms_list_legacy_org_members_for_manager(uuid, text, text, text)
  to authenticated;

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

  if p_role not in ('scout','trainer','co_trainer','betreuer','member') then
    raise exception 'Invalid operational role' using errcode = '22023';
  end if;

  if p_status not in ('pending','active','suspended') then
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

  if not (public.is_admin() or public.can_manage_org(v_organization_id)) then
    raise exception 'Not authorized to manage this membership' using errcode = '42501';
  end if;

  if not public.is_admin()
     and v_current_role in ('owner','club_admin','agency_admin') then
    raise exception 'Leadership roles may only be changed by a platform administrator'
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
