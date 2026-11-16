-- Bounded administrator member management inside one organization.
-- Additive RPC; existing membership rows and policies remain unchanged.

create or replace function public.pfms_admin_list_legacy_org_members_page(
  p_org_id uuid,
  p_query text default '',
  p_status text default null,
  p_role text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  membership_id uuid,
  user_id uuid,
  username text,
  full_name text,
  email text,
  member_role text,
  status text,
  total_count bigint,
  active_count bigint,
  pending_count bigint,
  suspended_count bigint,
  filtered_count bigint
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
  if p_org_id is null or not exists (
    select 1 from public.organizations as o where o.id = p_org_id
  ) then
    raise exception 'Organization not found' using errcode = '22023';
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
  if p_limit is null or p_limit not between 1 and 100
     or p_offset is null or p_offset not between 0 and 1000000 then
    raise exception 'Invalid pagination window' using errcode = '22023';
  end if;
  if pg_catalog.length(v_query) > 200 then
    raise exception 'Search query is too long' using errcode = '22023';
  end if;

  return query
  with organization_members as (
    select
      m.id as membership_id,
      m.user_id,
      p.username,
      p.full_name,
      u.email,
      m.role as member_role,
      m.status
    from public.organization_memberships as m
    left join public.profiles as p on p.id = m.user_id
    left join auth.users as u on u.id = m.user_id
    where m.organization_id = p_org_id
  ),
  filtered as (
    select om.*
    from organization_members as om
    where (p_status is null or om.status = p_status)
      and (p_role is null or om.member_role = p_role)
      and (
        v_query = ''
        or coalesce(om.username, '') ilike '%' || v_query || '%'
        or coalesce(om.full_name, '') ilike '%' || v_query || '%'
        or coalesce(om.email, '') ilike '%' || v_query || '%'
        or om.user_id::text ilike '%' || v_query || '%'
      )
  ),
  stats as (
    select
      count(*) as total_count,
      count(*) filter (where om.status = 'active') as active_count,
      count(*) filter (where om.status = 'pending') as pending_count,
      count(*) filter (where om.status = 'suspended') as suspended_count
    from organization_members as om
  ),
  page as (
    select f.*
    from filtered as f
    order by
      case f.member_role
        when 'owner' then 0
        when 'club_admin' then 1
        when 'agency_admin' then 1
        else 2
      end,
      pg_catalog.lower(coalesce(f.username, f.full_name, f.email, '')),
      f.membership_id
    limit p_limit offset p_offset
  )
  select
    page.membership_id,
    page.user_id,
    page.username,
    page.full_name,
    page.email,
    page.member_role,
    page.status,
    stats.total_count,
    stats.active_count,
    stats.pending_count,
    stats.suspended_count,
    (select count(*) from filtered) as filtered_count
  from stats
  left join page on true;
end;
$$;

revoke all on function public.pfms_admin_list_legacy_org_members_page(uuid, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.pfms_admin_list_legacy_org_members_page(uuid, text, text, text, integer, integer)
  to authenticated;

comment on function public.pfms_admin_list_legacy_org_members_page(uuid, text, text, text, integer, integer) is
  'Administrator-only organization member search with status summaries and bounded pagination.';
