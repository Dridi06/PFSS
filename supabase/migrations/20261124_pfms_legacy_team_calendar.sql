-- PFMS team calendar events.
-- Calendar access is controlled independently from training/attendance.
-- Browser clients can read through the RPC and cannot write the table directly.

create table if not exists public.pfms_legacy_team_calendar_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null
    references public.pfms_legacy_teams(id) on delete cascade,
  title text not null,
  event_type text not null
    check (event_type in ('match','meeting','tournament','event','other')),
  event_date date not null,
  starts_at time not null,
  ends_at time,
  location text,
  notes text,
  status text not null default 'planned'
    check (status in ('planned','completed','cancelled')),
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_team_calendar_title_check
    check (length(pg_catalog.btrim(title)) between 1 and 140),
  constraint pfms_legacy_team_calendar_time_check
    check (ends_at is null or ends_at > starts_at),
  constraint pfms_legacy_team_calendar_location_check
    check (location is null or length(location) <= 160),
  constraint pfms_legacy_team_calendar_notes_check
    check (notes is null or length(notes) <= 4000)
);

create index if not exists pfms_legacy_team_calendar_team_date_idx
  on public.pfms_legacy_team_calendar_events (team_id, event_date, starts_at);

create or replace function public.pfms_touch_legacy_team_calendar_event()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfms_touch_legacy_team_calendar_event() from public, anon, authenticated;

drop trigger if exists pfms_legacy_team_calendar_event_touch_updated_at
  on public.pfms_legacy_team_calendar_events;
create trigger pfms_legacy_team_calendar_event_touch_updated_at
before update on public.pfms_legacy_team_calendar_events
for each row execute function public.pfms_touch_legacy_team_calendar_event();

alter table public.pfms_legacy_team_calendar_events enable row level security;
alter table public.pfms_legacy_team_calendar_events force row level security;

drop policy if exists pfms_legacy_team_calendar_select on public.pfms_legacy_team_calendar_events;
create policy pfms_legacy_team_calendar_select
on public.pfms_legacy_team_calendar_events
for select to authenticated
using (public.pfms_has_legacy_team_permission(team_id, 'calendar', 'view'));

revoke all on table public.pfms_legacy_team_calendar_events from public, anon, authenticated;
grant select on table public.pfms_legacy_team_calendar_events to authenticated;

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
     or p_event_type not in ('match','meeting','tournament','event','other')
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
begin
  if p_event_id is null then
    raise exception 'Calendar event is required' using errcode = '22023';
  end if;

  select team_id into v_team_id
  from public.pfms_legacy_team_calendar_events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Calendar event not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'calendar', 'edit') then
    raise exception 'Not authorized to update calendar events' using errcode = '42501';
  end if;

  if p_event_date is null
     or p_starts_at is null
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_title,''))) not between 1 and 140
     or p_event_type is null
     or p_event_type not in ('match','meeting','tournament','event','other')
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

comment on table public.pfms_legacy_team_calendar_events is
  'Team calendar events. Every read/write is guarded by the calendar module permission.';
