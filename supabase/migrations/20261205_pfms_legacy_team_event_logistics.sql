-- PFMS team event travel and logistics.
-- Extends calendar-backed tournaments/events without creating another event registry.

create table if not exists public.pfms_legacy_team_event_logistics (
  event_id uuid primary key,
  team_id uuid not null,
  meeting_point text,
  registration_deadline date,
  transport_mode text not null default 'none'
    check (transport_mode in ('none','bus','carpool','public_transport','own_transport')),
  transport_notes text,
  fee_per_person numeric(10,2) not null default 0
    check (fee_per_person between 0 and 10000),
  capacity integer
    check (capacity is null or capacity between 1 and 200),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_team_event_logistics_meeting_point_check
    check (meeting_point is null or length(meeting_point) <= 180),
  constraint pfms_legacy_team_event_logistics_transport_notes_check
    check (transport_notes is null or length(transport_notes) <= 3000),
  constraint pfms_legacy_team_event_logistics_event_fk
    foreign key (event_id, team_id)
    references public.pfms_legacy_team_calendar_events(id, team_id)
    on delete cascade
);

create index if not exists pfms_legacy_team_event_logistics_team_idx
  on public.pfms_legacy_team_event_logistics(team_id, registration_deadline);

create or replace function public.pfms_touch_legacy_team_event_logistics()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfms_touch_legacy_team_event_logistics()
  from public, anon, authenticated;

drop trigger if exists pfms_legacy_team_event_logistics_touch_updated_at
  on public.pfms_legacy_team_event_logistics;
create trigger pfms_legacy_team_event_logistics_touch_updated_at
before update on public.pfms_legacy_team_event_logistics
for each row execute function public.pfms_touch_legacy_team_event_logistics();

alter table public.pfms_legacy_team_event_logistics enable row level security;
alter table public.pfms_legacy_team_event_logistics force row level security;

drop policy if exists pfms_legacy_team_event_logistics_select on public.pfms_legacy_team_event_logistics;
create policy pfms_legacy_team_event_logistics_select
on public.pfms_legacy_team_event_logistics
for select to authenticated
using (public.pfms_has_legacy_team_permission(team_id, 'events', 'view'));

revoke all on table public.pfms_legacy_team_event_logistics
  from public, anon, authenticated;
grant select on table public.pfms_legacy_team_event_logistics to authenticated;

create or replace function public.pfms_list_legacy_team_events_with_logistics(p_team_id uuid)
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
  meeting_point text,
  registration_deadline date,
  transport_mode text,
  transport_notes text,
  fee_per_person numeric,
  capacity integer,
  participants_count bigint,
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
    raise exception 'Not authorized to view team event logistics' using errcode = '42501';
  end if;

  return query
  select
    e.id, e.title, e.event_type, e.event_date, e.starts_at, e.ends_at,
    e.location, e.notes, e.status,
    l.meeting_point, l.registration_deadline,
    coalesce(l.transport_mode, 'none'),
    l.transport_notes, coalesce(l.fee_per_person, 0), l.capacity,
    (
      select pg_catalog.count(*)
      from public.pfms_legacy_team_event_participants p
      where p.event_id = e.id
        and p.team_id = e.team_id
        and p.status in ('invited','confirmed','attended')
    ),
    e.created_at
  from public.pfms_legacy_team_calendar_events e
  left join public.pfms_legacy_team_event_logistics l
    on l.event_id = e.id and l.team_id = e.team_id
  where e.team_id = p_team_id
    and e.event_type in ('tournament','event')
  order by e.event_date, e.starts_at, e.created_at;
end;
$$;

create or replace function public.pfms_save_legacy_team_event(
  p_event_id uuid,
  p_team_id uuid,
  p_title text,
  p_event_type text,
  p_event_date date,
  p_starts_at time,
  p_ends_at time,
  p_location text,
  p_notes text,
  p_status text,
  p_meeting_point text,
  p_registration_deadline date,
  p_transport_mode text,
  p_transport_notes text,
  p_fee_per_person numeric,
  p_capacity integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_existing_team_id uuid;
  v_existing_type text;
  v_participant_count bigint;
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'events', 'edit') then
    raise exception 'Not authorized to manage team events' using errcode = '42501';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(p_title, ''))) not between 1 and 140
     or p_event_type is null or p_event_type not in ('tournament','event')
     or p_event_date is null
     or p_starts_at is null
     or (p_ends_at is not null and p_ends_at <= p_starts_at)
     or (p_status is not null and p_status not in ('planned','completed','cancelled'))
     or (p_location is not null and pg_catalog.length(p_location) > 160)
     or (p_notes is not null and pg_catalog.length(p_notes) > 4000)
     or (p_meeting_point is not null and pg_catalog.length(p_meeting_point) > 180)
     or p_transport_mode is null or p_transport_mode not in ('none','bus','carpool','public_transport','own_transport')
     or (p_transport_notes is not null and pg_catalog.length(p_transport_notes) > 3000)
     or p_fee_per_person is null or p_fee_per_person < 0 or p_fee_per_person > 10000
     or (p_capacity is not null and p_capacity not between 1 and 200) then
    raise exception 'Invalid team event or transport data' using errcode = '22023';
  end if;

  if p_event_id is null then
    insert into public.pfms_legacy_team_calendar_events (
      team_id, title, event_type, event_date, starts_at, ends_at,
      location, notes, status, created_by
    ) values (
      p_team_id, pg_catalog.btrim(p_title), p_event_type, p_event_date,
      p_starts_at, p_ends_at,
      nullif(pg_catalog.btrim(coalesce(p_location, '')), ''),
      nullif(pg_catalog.btrim(coalesce(p_notes, '')), ''),
      coalesce(p_status, 'planned'), auth.uid()
    )
    returning id into v_event_id;
  else
    select e.team_id, e.event_type
      into v_existing_team_id, v_existing_type
    from public.pfms_legacy_team_calendar_events e
    where e.id = p_event_id
    for update;

    if not found then
      raise exception 'Team event not found' using errcode = 'P0002';
    end if;
    if v_existing_team_id <> p_team_id
       or v_existing_type not in ('tournament','event') then
      raise exception 'Event does not belong to this team or is not an event entry'
        using errcode = '42501';
    end if;

    select pg_catalog.count(*) into v_participant_count
    from public.pfms_legacy_team_event_participants p
    where p.event_id = p_event_id
      and p.team_id = p_team_id
      and p.status in ('invited','confirmed','attended');

    if p_capacity is not null and v_participant_count > p_capacity then
      raise exception 'Capacity cannot be lower than the current registered participant count'
        using errcode = '23514';
    end if;

    update public.pfms_legacy_team_calendar_events
    set title = pg_catalog.btrim(p_title),
        event_type = p_event_type,
        event_date = p_event_date,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        location = nullif(pg_catalog.btrim(coalesce(p_location, '')), ''),
        notes = nullif(pg_catalog.btrim(coalesce(p_notes, '')), ''),
        status = coalesce(p_status, 'planned'),
        updated_at = pg_catalog.now()
    where id = p_event_id and team_id = p_team_id;

    v_event_id := p_event_id;
  end if;

  insert into public.pfms_legacy_team_event_logistics (
    event_id, team_id, meeting_point, registration_deadline,
    transport_mode, transport_notes, fee_per_person, capacity
  ) values (
    v_event_id, p_team_id,
    nullif(pg_catalog.btrim(coalesce(p_meeting_point, '')), ''),
    p_registration_deadline,
    p_transport_mode,
    nullif(pg_catalog.btrim(coalesce(p_transport_notes, '')), ''),
    p_fee_per_person,
    p_capacity
  )
  on conflict (event_id) do update
  set meeting_point = excluded.meeting_point,
      registration_deadline = excluded.registration_deadline,
      transport_mode = excluded.transport_mode,
      transport_notes = excluded.transport_notes,
      fee_per_person = excluded.fee_per_person,
      capacity = excluded.capacity,
      updated_at = pg_catalog.now();

  return v_event_id;
end;
$$;

-- Enforce the event capacity at the moment a participant is added, not only in the UI.
create or replace function public.pfms_add_legacy_team_event_participant(
  p_event_id uuid,
  p_team_player_assignment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_event_type text;
  v_capacity integer;
  v_participant_count bigint;
  v_participant_id uuid;
begin
  select e.team_id, e.event_type, l.capacity
    into v_team_id, v_event_type, v_capacity
  from public.pfms_legacy_team_calendar_events e
  left join public.pfms_legacy_team_event_logistics l
    on l.event_id = e.id and l.team_id = e.team_id
  where e.id = p_event_id
  for update of e;

  if not found then
    raise exception 'Team event not found' using errcode = 'P0002';
  end if;
  if v_event_type not in ('tournament','event') then
    raise exception 'Only tournament and event entries support participant registration'
      using errcode = '42501';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'events', 'edit') then
    raise exception 'Not authorized to manage event participants' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.pfms_legacy_team_players tp
    where tp.id = p_team_player_assignment_id
      and tp.team_id = v_team_id
      and tp.squad_status <> 'inactive'
  ) then
    raise exception 'Selected player is not an active member of this team'
      using errcode = '23514';
  end if;

  select pg_catalog.count(*) into v_participant_count
  from public.pfms_legacy_team_event_participants p
  where p.event_id = p_event_id
    and p.team_id = v_team_id
    and p.status in ('invited','confirmed','attended');

  if v_capacity is not null and v_participant_count >= v_capacity then
    raise exception 'Team event is at capacity' using errcode = '23514';
  end if;

  insert into public.pfms_legacy_team_event_participants (
    event_id, team_id, team_player_assignment_id, status, created_by
  ) values (
    p_event_id, v_team_id, p_team_player_assignment_id, 'invited', auth.uid()
  )
  returning id into v_participant_id;

  return v_participant_id;
end;
$$;

create or replace function public.pfms_update_legacy_team_event_participant(
  p_participant_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_event_id uuid;
  v_event_type text;
  v_capacity integer;
  v_participant_count bigint;
begin
  -- Read the event key first, then lock the event before the participant row.
  -- This is the same lock order used by participant additions and event edits.
  select ep.team_id, ep.event_id
    into v_team_id, v_event_id
  from public.pfms_legacy_team_event_participants ep
  where ep.id = p_participant_id;

  if not found then
    raise exception 'Event participant not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'events', 'edit') then
    raise exception 'Not authorized to update event participant' using errcode = '42501';
  end if;
  if p_status is null
     or p_status not in ('invited','confirmed','declined','attended','absent')
     or (p_note is not null and pg_catalog.length(p_note) > 1000) then
    raise exception 'Invalid event participant data' using errcode = '22023';
  end if;

  select e.event_type, l.capacity
    into v_event_type, v_capacity
  from public.pfms_legacy_team_calendar_events e
  left join public.pfms_legacy_team_event_logistics l
    on l.event_id = e.id and l.team_id = e.team_id
  where e.id = v_event_id and e.team_id = v_team_id
  for update of e;

  if not found or v_event_type not in ('tournament','event') then
    raise exception 'Event participant does not belong to an event entry'
      using errcode = '42501';
  end if;

  perform 1
  from public.pfms_legacy_team_event_participants ep
  where ep.id = p_participant_id
    and ep.event_id = v_event_id
    and ep.team_id = v_team_id
  for update;

  if not found then
    raise exception 'Event participant was removed during the update'
      using errcode = 'P0002';
  end if;

  if p_status in ('invited','confirmed','attended') then
    select pg_catalog.count(*) into v_participant_count
    from public.pfms_legacy_team_event_participants ep
    where ep.event_id = v_event_id
      and ep.team_id = v_team_id
      and ep.id <> p_participant_id
      and ep.status in ('invited','confirmed','attended');

    if v_capacity is not null and v_participant_count >= v_capacity then
      raise exception 'Team event is at capacity' using errcode = '23514';
    end if;
  end if;

  update public.pfms_legacy_team_event_participants
  set status = p_status,
      note = nullif(pg_catalog.btrim(coalesce(p_note, '')), ''),
      updated_at = pg_catalog.now()
  where id = p_participant_id;
end;
$$;


revoke all on function public.pfms_list_legacy_team_events_with_logistics(uuid) from public, anon;
grant execute on function public.pfms_list_legacy_team_events_with_logistics(uuid) to authenticated;
revoke all on function public.pfms_save_legacy_team_event(uuid, uuid, text, text, date, time, time, text, text, text, text, date, text, text, numeric, integer) from public, anon;
grant execute on function public.pfms_save_legacy_team_event(uuid, uuid, text, text, date, time, time, text, text, text, text, date, text, text, numeric, integer) to authenticated;
revoke all on function public.pfms_add_legacy_team_event_participant(uuid, uuid) from public, anon;
grant execute on function public.pfms_add_legacy_team_event_participant(uuid, uuid) to authenticated;

revoke all on function public.pfms_update_legacy_team_event_participant(uuid, text, text) from public, anon;
grant execute on function public.pfms_update_legacy_team_event_participant(uuid, text, text) to authenticated;

comment on table public.pfms_legacy_team_event_logistics is
  'Team-scoped event logistics: registration deadline, meeting point, transport, per-person fee and capacity.';
