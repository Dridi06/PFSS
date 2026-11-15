-- Bounded administrator error/event log search.
-- Additive RPC: no event rows are changed by this migration.

create or replace function public.pfms_admin_list_system_events_page(
  p_query text default '',
  p_severity text default null,
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  actor_id uuid,
  severity text,
  message text,
  route text,
  details jsonb,
  status text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
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
  if p_severity is not null and p_severity not in ('warning', 'error', 'critical') then
    raise exception 'Invalid event severity' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('open', 'in_review', 'resolved') then
    raise exception 'Invalid event status' using errcode = '22023';
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
      e.id, e.actor_id, e.severity, e.message, e.route, e.details,
      e.status, e.created_at, e.resolved_at, e.resolved_by
    from public.pfms_system_events as e
    where (p_severity is null or e.severity = p_severity)
      and (p_status is null or e.status = p_status)
      and (
        v_query = ''
        or coalesce(e.message, '') ilike '%' || v_query || '%'
        or coalesce(e.route, '') ilike '%' || v_query || '%'
      )
  )
  select
    f.id, f.actor_id, f.severity, f.message, f.route, f.details,
    f.status, f.created_at, f.resolved_at, f.resolved_by,
    pg_catalog.count(*) over () as total_count
  from filtered as f
  order by f.created_at desc, f.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.pfms_admin_list_system_events_page(text, text, text, integer, integer)
  from public, anon;
grant execute on function public.pfms_admin_list_system_events_page(text, text, text, integer, integer)
  to authenticated;

comment on function public.pfms_admin_list_system_events_page(text, text, text, integer, integer) is
  'Administrator-only filtered system event page with a bounded result window and total row count.';
