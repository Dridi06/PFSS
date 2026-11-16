-- PFSS administrator profile directory pagination and aggregate counters.
-- Additive RPC-only migration; existing profile rows and update protections remain unchanged.
-- Apply only in the dedicated STAGING project after the read-only schema audit.

create or replace function public.pfss_admin_list_profiles_page(
  p_query text default '',
  p_user_id text default '',
  p_role text default null,
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  role text,
  status text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := pg_catalog.trim(coalesce(p_query, ''));
  v_user_id text := pg_catalog.trim(coalesce(p_user_id, ''));
begin
  if not public.pfms_is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_role is not null and p_role not in ('user', 'scout', 'admin') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('pending', 'approved', 'suspended') then
    raise exception 'Invalid profile status' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 100
     or p_offset is null or p_offset not between 0 and 1000000 then
    raise exception 'Invalid pagination window' using errcode = '22023';
  end if;
  if pg_catalog.length(v_query) > 200 or pg_catalog.length(v_user_id) > 80 then
    raise exception 'Search query is too long' using errcode = '22023';
  end if;

  return query
  with filtered as (
    select p.id, p.username, p.role, p.status
    from public.profiles as p
    where (p_role is null or p.role = p_role)
      and (p_status is null or p.status = p_status)
      and (v_query = '' or coalesce(p.username, '') ilike '%' || v_query || '%')
      and (v_user_id = '' or p.id::text ilike '%' || v_user_id || '%')
  )
  select
    f.id, f.username, f.role, f.status,
    pg_catalog.count(*) over () as total_count
  from filtered as f
  order by
    case f.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    pg_catalog.lower(coalesce(f.username, '')),
    f.id
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.pfss_admin_profile_counts()
returns table (
  total_count bigint,
  pending_count bigint,
  approved_count bigint,
  suspended_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.pfms_is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select
    pg_catalog.count(*)::bigint,
    pg_catalog.count(*) filter (where p.status = 'pending')::bigint,
    pg_catalog.count(*) filter (where p.status = 'approved')::bigint,
    pg_catalog.count(*) filter (where p.status = 'suspended')::bigint
  from public.profiles as p;
end;
$$;

revoke all on function public.pfss_admin_list_profiles_page(text, text, text, text, integer, integer)
  from public, anon;
revoke all on function public.pfss_admin_profile_counts()
  from public, anon;
grant execute on function public.pfss_admin_list_profiles_page(text, text, text, text, integer, integer)
  to authenticated;
grant execute on function public.pfss_admin_profile_counts()
  to authenticated;

comment on function public.pfss_admin_list_profiles_page(text, text, text, text, integer, integer) is
  'Administrator-only filtered profile directory page with a bounded result window and total row count.';
comment on function public.pfss_admin_profile_counts() is
  'Administrator-only aggregate profile status counters for the administration dashboard.';
