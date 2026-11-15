-- PFMS administrator directory pagination.
-- Additive, read-only page RPCs. Existing directory RPCs remain available for compatibility.
-- Apply only in the dedicated STAGING project after the read-only schema audit.

create or replace function public.pfms_admin_search_legacy_organizations_page(
  p_type text default null,
  p_query text default '',
  p_id text default '',
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  organization_type text,
  name text,
  status text,
  created_at timestamptz,
  member_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := pg_catalog.trim(coalesce(p_query, ''));
  v_id text := pg_catalog.trim(coalesce(p_id, ''));
begin
  if not public.pfms_is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_type is not null and p_type not in ('club', 'agency', 'scout_workspace') then
    raise exception 'Invalid organization type' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('active', 'approved', 'pending', 'suspended') then
    raise exception 'Invalid organization status' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 100
     or p_offset is null or p_offset not between 0 and 1000000 then
    raise exception 'Invalid pagination window' using errcode = '22023';
  end if;
  if pg_catalog.length(v_query) > 200 or pg_catalog.length(v_id) > 80 then
    raise exception 'Search query is too long' using errcode = '22023';
  end if;

  return query
  with filtered as (
    select
      o.id,
      o.organization_type,
      o.name,
      o.status,
      o.created_at,
      count(m.id) filter (where m.status = 'active') as member_count
    from public.organizations as o
    left join public.organization_memberships as m on m.organization_id = o.id
    where (p_type is null or o.organization_type = p_type)
      and (p_status is null or o.status = p_status)
      and (
        v_query = ''
        or o.name ilike '%' || v_query || '%'
      )
      and (
        v_id = ''
        or o.id::text ilike '%' || v_id || '%'
      )
    group by o.id
  )
  select
    f.id, f.organization_type, f.name, f.status, f.created_at,
    f.member_count, pg_catalog.count(*) over () as total_count
  from filtered as f
  order by pg_catalog.lower(f.name), f.id
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.pfms_admin_list_legacy_scouts_page(
  p_query text default '',
  p_email text default '',
  p_user_id text default '',
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  username text,
  full_name text,
  email text,
  profile_status text,
  organization_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := pg_catalog.trim(coalesce(p_query, ''));
  v_email text := pg_catalog.trim(coalesce(p_email, ''));
  v_user_id text := pg_catalog.trim(coalesce(p_user_id, ''));
begin
  if not public.pfms_is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('pending', 'approved', 'suspended') then
    raise exception 'Invalid profile status' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 100
     or p_offset is null or p_offset not between 0 and 1000000 then
    raise exception 'Invalid pagination window' using errcode = '22023';
  end if;
  if pg_catalog.length(v_query) > 200
     or pg_catalog.length(v_email) > 254
     or pg_catalog.length(v_user_id) > 80 then
    raise exception 'Search query is too long' using errcode = '22023';
  end if;

  return query
  with filtered as (
    select
      p.id as user_id,
      p.username,
      p.full_name,
      u.email,
      p.status as profile_status,
      pg_catalog.count(distinct m.organization_id)
        filter (where m.status = 'active') as organization_count
    from public.profiles as p
    left join auth.users as u on u.id = p.id
    left join public.organization_memberships as m
      on m.user_id = p.id and m.role = 'scout'
    where (
        pg_catalog.lower(coalesce(p.role, '')) = 'scout'
        or m.id is not null
      )
      and (p_status is null or p.status = p_status)
      and (
        v_query = ''
        or coalesce(p.username, '') ilike '%' || v_query || '%'
        or coalesce(p.full_name, '') ilike '%' || v_query || '%'
      )
      and (v_email = '' or coalesce(u.email, '') ilike '%' || v_email || '%')
      and (v_user_id = '' or p.id::text ilike '%' || v_user_id || '%')
    group by p.id, p.username, p.full_name, u.email, p.status
  )
  select
    f.user_id, f.username, f.full_name, f.email, f.profile_status,
    f.organization_count, pg_catalog.count(*) over () as total_count
  from filtered as f
  order by pg_catalog.lower(coalesce(f.username, f.full_name, f.email, '')), f.user_id
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.pfms_admin_list_legacy_members_page(
  p_query text default '',
  p_status text default null,
  p_role text default null,
  p_organization_type text default null,
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
  membership_status text,
  organization_id uuid,
  organization_name text,
  organization_type text,
  total_count bigint
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
  if p_limit is null or p_limit not between 1 and 100
     or p_offset is null or p_offset not between 0 and 1000000 then
    raise exception 'Invalid pagination window' using errcode = '22023';
  end if;
  if pg_catalog.length(v_query) > 200 then
    raise exception 'Search query is too long' using errcode = '22023';
  end if;

  return query
  with filtered as (
    select
      m.id as membership_id,
      m.user_id,
      p.username,
      p.full_name,
      u.email,
      m.role as member_role,
      m.status as membership_status,
      o.id as organization_id,
      o.name as organization_name,
      o.organization_type
    from public.organization_memberships as m
    join public.organizations as o on o.id = m.organization_id
    left join public.profiles as p on p.id = m.user_id
    left join auth.users as u on u.id = m.user_id
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
  )
  select
    f.membership_id, f.user_id, f.username, f.full_name, f.email,
    f.member_role, f.membership_status, f.organization_id,
    f.organization_name, f.organization_type,
    pg_catalog.count(*) over () as total_count
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
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.pfms_admin_search_legacy_organizations_page(text, text, text, text, integer, integer)
  from public, anon;
revoke all on function public.pfms_admin_list_legacy_scouts_page(text, text, text, text, integer, integer)
  from public, anon;
revoke all on function public.pfms_admin_list_legacy_members_page(text, text, text, text, integer, integer)
  from public, anon;

grant execute on function public.pfms_admin_search_legacy_organizations_page(text, text, text, text, integer, integer)
  to authenticated;
grant execute on function public.pfms_admin_list_legacy_scouts_page(text, text, text, text, integer, integer)
  to authenticated;
grant execute on function public.pfms_admin_list_legacy_members_page(text, text, text, text, integer, integer)
  to authenticated;

comment on function public.pfms_admin_search_legacy_organizations_page(text, text, text, text, integer, integer) is
  'Administrator-only filtered organization directory page with a total row count.';
comment on function public.pfms_admin_list_legacy_scouts_page(text, text, text, text, integer, integer) is
  'Administrator-only filtered scout directory page with a total row count.';
comment on function public.pfms_admin_list_legacy_members_page(text, text, text, text, integer, integer) is
  'Administrator-only filtered organization membership page with a total row count.';
