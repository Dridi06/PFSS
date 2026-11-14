-- PFMS team events workspace.
-- Reuses the team calendar as the single source of truth, while events.*
-- permissions expose only tournaments and general events to the events module.

drop policy if exists pfms_legacy_team_calendar_select
  on public.pfms_legacy_team_calendar_events;

create policy pfms_legacy_team_calendar_select
on public.pfms_legacy_team_calendar_events
for select to authenticated
using (
  public.pfms_has_legacy_team_permission(team_id, 'calendar', 'view')
  or (
    event_type in ('tournament','event')
    and public.pfms_has_legacy_team_permission(team_id, 'events', 'view')
  )
);

create or replace function public.pfms_list_legacy_team_events(p_team_id uuid)
returns table (
  event_id uuid,
  event_title text,
  event_type text,
  event_date date,
  starts_at time,
  ends_at time,
  location text,
  event_notes text,
  event_status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'events', 'view') then
    raise exception 'Not authorized to view team events' using errcode = '42501';
  end if;

  return query
  select e.id, e.title, e.event_type, e.event_date, e.starts_at,
         e.ends_at, e.location, e.notes, e.status, e.created_at
  from public.pfms_legacy_team_calendar_events e
  where e.team_id = p_team_id
    and e.event_type in ('tournament','event')
  order by e.event_date, e.starts_at, e.created_at;
end;
$$;

create or replace function public.pfms_create_legacy_team_event(
  p_team_id uuid,
  p_title text,
  p_event_type text,
  p_event_date date,
  p_starts_at time,
  p_ends_at time default null,
  p_location text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'events', 'edit') then
    raise exception 'Not authorized to create team events' using errcode = '42501';
  end if;

  if p_event_type is null or p_event_type not in ('tournament','event')
     or p_event_date is null
     or p_starts_at is null
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_title,''))) not between 1 and 140
     or (p_ends_at is not null and p_ends_at <= p_starts_at)
     or (p_location is not null and pg_catalog.length(p_location) > 160)
     or (p_notes is not null and pg_catalog.length(p_notes) > 4000) then
    raise exception 'Invalid team event data' using errcode = '22023';
  end if;

  insert into public.pfms_legacy_team_calendar_events (
    team_id, title, event_type, event_date, starts_at, ends_at,
    location, notes, status, created_by
  ) values (
    p_team_id, pg_catalog.btrim(p_title), p_event_type, p_event_date,
    p_starts_at, p_ends_at,
    nullif(pg_catalog.btrim(coalesce(p_location,'')), ''),
    nullif(pg_catalog.btrim(coalesce(p_notes,'')), ''),
    'planned', auth.uid()
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.pfms_update_legacy_team_event(
  p_event_id uuid,
  p_title text,
  p_event_type text,
  p_event_date date,
  p_starts_at time,
  p_ends_at time,
  p_location text,
  p_notes text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_current_type text;
begin
  select e.team_id, e.event_type
    into v_team_id, v_current_type
  from public.pfms_legacy_team_calendar_events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Team event not found' using errcode = 'P0002';
  end if;
  if v_current_type not in ('tournament','event')
     or p_event_type not in ('tournament','event') then
    raise exception 'Only event and tournament entries may be changed in this module'
      using errcode = '42501';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'events', 'edit') then
    raise exception 'Not authorized to update team events' using errcode = '42501';
  end if;

  if p_event_date is null
     or p_starts_at is null
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_title,''))) not between 1 and 140
     or (p_ends_at is not null and p_ends_at <= p_starts_at)
     or p_status is null or p_status not in ('planned','completed','cancelled')
     or (p_location is not null and pg_catalog.length(p_location) > 160)
     or (p_notes is not null and pg_catalog.length(p_notes) > 4000) then
    raise exception 'Invalid team event data' using errcode = '22023';
  end if;

  update public.pfms_legacy_team_calendar_events
  set title = pg_catalog.btrim(p_title),
      event_type = p_event_type,
      event_date = p_event_date,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      location = nullif(pg_catalog.btrim(coalesce(p_location,'')), ''),
      notes = nullif(pg_catalog.btrim(coalesce(p_notes,'')), ''),
      status = p_status
  where id = p_event_id;
end;
$$;

create or replace function public.pfms_delete_legacy_team_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_event_type text;
begin
  select e.team_id, e.event_type
    into v_team_id, v_event_type
  from public.pfms_legacy_team_calendar_events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Team event not found' using errcode = 'P0002';
  end if;
  if v_event_type not in ('tournament','event') then
    raise exception 'Only event and tournament entries may be deleted in this module'
      using errcode = '42501';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'events', 'edit') then
    raise exception 'Not authorized to delete team events' using errcode = '42501';
  end if;

  delete from public.pfms_legacy_team_calendar_events
  where id = p_event_id;
end;
$$;

revoke all on function public.pfms_list_legacy_team_events(uuid) from public, anon;
grant execute on function public.pfms_list_legacy_team_events(uuid) to authenticated;

revoke all on function public.pfms_create_legacy_team_event(uuid, text, text, date, time, time, text, text) from public, anon;
grant execute on function public.pfms_create_legacy_team_event(uuid, text, text, date, time, time, text, text) to authenticated;

revoke all on function public.pfms_update_legacy_team_event(uuid, text, text, date, time, time, text, text, text) from public, anon;
grant execute on function public.pfms_update_legacy_team_event(uuid, text, text, date, time, time, text, text, text) to authenticated;

revoke all on function public.pfms_delete_legacy_team_event(uuid) from public, anon;
grant execute on function public.pfms_delete_legacy_team_event(uuid) to authenticated;

comment on function public.pfms_list_legacy_team_events(uuid) is
  'Lists only tournament/event entries. Does not expose calendar matches or meetings to events-only users.';
