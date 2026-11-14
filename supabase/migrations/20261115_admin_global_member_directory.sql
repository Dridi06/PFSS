-- PFMS global administrator member directory for the existing organization model
-- Additive migration: reads organizations / organization_memberships; does not rewrite data.
-- Apply only in STAGING after running the read-only schema audit.

create or replace function public.pfms_admin_list_legacy_members(
  p_query text default '',
  p_status text default null,
  p_role text default null,
  p_organization_type text default null
)
returns table (
  membership_id uuid,
  user_id uuid,
  username text,
  full_name text,
  email text,
  member_role text,
  membership_status text,
  organization_id uuid,
  organization_name text,
  organization_type text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := pg_catalog.trim(coalesce(p_query, ''));
begin
  if not public.pfms_is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in ('pending', 'active', 'suspended') then
    raise exception 'Invalid membership status' using errcode = '22023';
  end if;

  if p_role is not null and p_role not in (
    'owner', 'club_admin', 'agency_admin', 'scout',
    'trainer', 'co_trainer', 'betreuer', 'member'
  ) then
    raise exception 'Invalid membership role' using errcode = '22023';
  end if;

  if p_organization_type is not null
     and p_organization_type not in ('club', 'agency', 'scout_workspace') then
    raise exception 'Invalid organization type' using errcode = '22023';
  end if;

  return query
  select
    m.id,
    m.user_id,
    p.username,
    p.full_name,
    u.email,
    m.role,
    m.status,
    o.id,
    o.name,
    o.organization_type
  from public.organization_memberships as m
  join public.organizations as o
    on o.id = m.organization_id
  left join public.profiles as p
    on p.id = m.user_id
  left join auth.users as u
    on u.id = m.user_id
  where (p_status is null or m.status = p_status)
    and (p_role is null or m.role = p_role)
    and (p_organization_type is null or o.organization_type = p_organization_type)
    and (
      v_query = ''
      or coalesce(p.username, '') ilike '%' || v_query || '%'
      or coalesce(p.full_name, '') ilike '%' || v_query || '%'
      or coalesce(u.email, '') ilike '%' || v_query || '%'
      or m.user_id::text ilike '%' || v_query || '%'
      or o.name ilike '%' || v_query || '%'
      or o.id::text ilike '%' || v_query || '%'
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

revoke all on function public.pfms_admin_list_legacy_members(text, text, text, text)
  from public, anon;
grant execute on function public.pfms_admin_list_legacy_members(text, text, text, text)
  to authenticated;

comment on function public.pfms_admin_list_legacy_members(text, text, text, text) is
  'Administrator-only directory of legacy organization memberships. No direct table access is granted.';
