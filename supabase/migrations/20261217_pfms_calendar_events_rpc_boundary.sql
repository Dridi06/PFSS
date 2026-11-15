-- Enforce the calendar/events boundary inside SECURITY DEFINER RPCs.
-- RLS alone is not sufficient because these functions execute with elevated
-- privileges and therefore must apply the same module boundary explicitly.

create or replace function public.pfms_list_legacy_team_calendar(p_team_id uuid)
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
     or not public.pfms_has_legacy_team_permission(p_team_id, 'calendar', 'view') then
    raise exception 'Not authorized to view this team calendar' using errcode = '42501';
  end if;

  return query
  select e.id, e.title, e.event_type, e.event_date, e.starts_at, e.ends_at,
         e.location, e.notes, e.status, e.created_at
  from public.pfms_legacy_team_calendar_events e
  where e.team_id = p_team_id
    and e.event_type not in ('tournament', 'event')
  order by e.event_date, e.starts_at, e.created_at;
end;
$$;

create or replace function public.pfms_create_legacy_team_calendar_event(
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
     or not public.pfms_has_legacy_team_permission(p_team_id, 'calendar', 'edit') then
    raise exception 'Not authorized to create calendar events' using errcode = '42501';
  end if;

  if p_event_date is null
     or p_starts_at is null
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_title,''))) not between 1 and 140
     or p_event_type is null
     or p_event_type not in ('match','meeting','other')
     or (p_ends_at is not null and p_ends_at <= p_starts_at)
     or (p_location is not null and pg_catalog.length(p_location) > 160)
     or (p_notes is not null and pg_catalog.length(p_notes) > 4000) then
    raise exception 'Invalid team calendar event data' using errcode = '22023';
  end if;

  insert into public.pfms_legacy_team_calendar_events (
    team_id, title, event_type, event_date, starts_at, ends_at,
    location, notes, created_by
  ) values (
    p_team_id, pg_catalog.btrim(p_title), p_event_type, p_event_date,
    p_starts_at, p_ends_at,
    nullif(pg_catalog.btrim(coalesce(p_location,'')), ''),
    nullif(pg_catalog.btrim(coalesce(p_notes,'')), ''),
    auth.uid()
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.pfms_update_legacy_team_calendar_event(
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
  v_existing_event_type text;
begin
  if p_event_id is null then
    raise exception 'Calendar event is required' using errcode = '22023';
  end if;

  select team_id, event_type
    into v_team_id, v_existing_event_type
  from public.pfms_legacy_team_calendar_events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Calendar event not found' using errcode = 'P0002';
  end if;

  if v_existing_event_type in ('tournament', 'event') then
    raise exception 'Use the events module to manage tournaments and events' using errcode = '42501';
  end if;

  if not public.pfms_has_legacy_team_permission(v_team_id, 'calendar', 'edit') then
    raise exception 'Not authorized to update calendar events' using errcode = '42501';
  end if;

  if p_event_date is null
     or p_starts_at is null
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_title,''))) not between 1 and 140
     or p_event_type is null
     or p_event_type not in ('match','meeting','other')
     or (p_ends_at is not null and p_ends_at <= p_starts_at)
     or p_status is null or p_status not in ('planned','completed','cancelled')
     or (p_location is not null and pg_catalog.length(p_location) > 160)
     or (p_notes is not null and pg_catalog.length(p_notes) > 4000) then
    raise exception 'Invalid team calendar event data' using errcode = '22023';
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

revoke all on function public.pfms_list_legacy_team_calendar(uuid) from public, anon;
revoke all on function public.pfms_create_legacy_team_calendar_event(uuid,text,text,date,time,time,text,text) from public, anon;
revoke all on function public.pfms_update_legacy_team_calendar_event(uuid,text,text,date,time,time,text,text,text) from public, anon;

grant execute on function public.pfms_list_legacy_team_calendar(uuid) to authenticated;
grant execute on function public.pfms_create_legacy_team_calendar_event(uuid,text,text,date,time,time,text,text) to authenticated;
grant execute on function public.pfms_update_legacy_team_calendar_event(uuid,text,text,date,time,time,text,text,text) to authenticated;

comment on function public.pfms_list_legacy_team_calendar(uuid) is
  'Calendar-only read RPC. Event and tournament rows are exclusively returned by the events module after events.view.';
comment on function public.pfms_create_legacy_team_calendar_event(uuid,text,text,date,time,time,text,text) is
  'Creates only match, meeting or other calendar entries under calendar.edit; event/tournament rows use the events module.';
comment on function public.pfms_update_legacy_team_calendar_event(uuid,text,text,date,time,time,text,text,text) is
  'Updates only calendar-owned rows under calendar.edit; event/tournament rows cannot be accessed or converted through this RPC.';
