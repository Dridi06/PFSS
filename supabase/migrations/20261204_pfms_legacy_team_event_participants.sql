-- PFMS event participation and RSVP tracking.
-- Participants are linked to the same team's roster; all writes use events.edit RPCs.

create unique index if not exists pfms_legacy_team_calendar_events_id_team_uidx
  on public.pfms_legacy_team_calendar_events(id, team_id);

create unique index if not exists pfms_legacy_team_players_id_team_uidx
  on public.pfms_legacy_team_players(id, team_id);

create table if not exists public.pfms_legacy_team_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  team_id uuid not null,
  team_player_assignment_id uuid not null,
  status text not null default 'invited'
    check (status in ('invited','confirmed','declined','attended','absent')),
  note text,
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_team_event_participant_note_check
    check (note is null or length(note) <= 1000),
  constraint pfms_legacy_team_event_participant_event_fk
    foreign key (event_id, team_id)
    references public.pfms_legacy_team_calendar_events(id, team_id)
    on delete cascade,
  constraint pfms_legacy_team_event_participant_player_fk
    foreign key (team_player_assignment_id, team_id)
    references public.pfms_legacy_team_players(id, team_id)
    on delete cascade,
  unique (event_id, team_player_assignment_id)
);

create index if not exists pfms_legacy_team_event_participants_team_event_idx
  on public.pfms_legacy_team_event_participants(team_id, event_id, status);

create or replace function public.pfms_touch_legacy_team_event_participant()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfms_touch_legacy_team_event_participant()
  from public, anon, authenticated;

drop trigger if exists pfms_legacy_team_event_participants_touch_updated_at
  on public.pfms_legacy_team_event_participants;
create trigger pfms_legacy_team_event_participants_touch_updated_at
before update on public.pfms_legacy_team_event_participants
for each row execute function public.pfms_touch_legacy_team_event_participant();

alter table public.pfms_legacy_team_event_participants enable row level security;
alter table public.pfms_legacy_team_event_participants force row level security;

drop policy if exists pfms_legacy_team_event_participants_select on public.pfms_legacy_team_event_participants;
create policy pfms_legacy_team_event_participants_select
on public.pfms_legacy_team_event_participants
for select to authenticated
using (public.pfms_has_legacy_team_permission(team_id, 'events', 'view'));

revoke all on table public.pfms_legacy_team_event_participants
  from public, anon, authenticated;
grant select on table public.pfms_legacy_team_event_participants to authenticated;

create or replace function public.pfms_list_legacy_team_event_participants(p_team_id uuid)
returns table (
  participant_id uuid,
  event_id uuid,
  assignment_id uuid,
  player_name text,
  player_surname text,
  jersey_number smallint,
  squad_status text,
  participant_status text,
  participant_note text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'events', 'view') then
    raise exception 'Not authorized to view event participants'
      using errcode = '42501';
  end if;

  return query
  select
    ep.id,
    ep.event_id,
    ep.team_player_assignment_id,
    gp.name,
    gp.surname,
    tp.jersey_number,
    tp.squad_status,
    ep.status,
    ep.note,
    ep.updated_at
  from public.pfms_legacy_team_event_participants ep
  join public.pfms_legacy_team_calendar_events e
    on e.id = ep.event_id and e.team_id = ep.team_id
  join public.pfms_legacy_team_players tp
    on tp.id = ep.team_player_assignment_id and tp.team_id = ep.team_id
  join public.pfms_global_players gp on gp.id = tp.player_id
  where ep.team_id = p_team_id
    and e.event_type in ('tournament','event')
  order by ep.event_id, tp.jersey_number nulls last,
           pg_catalog.lower(gp.surname), pg_catalog.lower(gp.name);
end;
$$;

create or replace function public.pfms_list_legacy_team_event_player_options(p_team_id uuid)
returns table (
  assignment_id uuid,
  player_name text,
  player_surname text,
  jersey_number smallint,
  squad_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'events', 'view') then
    raise exception 'Not authorized to view team roster options'
      using errcode = '42501';
  end if;

  return query
  select tp.id, gp.name, gp.surname, tp.jersey_number, tp.squad_status
  from public.pfms_legacy_team_players tp
  join public.pfms_global_players gp on gp.id = tp.player_id
  where tp.team_id = p_team_id
    and tp.squad_status <> 'inactive'
  order by tp.jersey_number nulls last,
           pg_catalog.lower(gp.surname), pg_catalog.lower(gp.name);
end;
$$;

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
  v_participant_id uuid;
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
begin
  select ep.team_id, ep.event_id
    into v_team_id, v_event_id
  from public.pfms_legacy_team_event_participants ep
  where ep.id = p_participant_id
  for update;

  if not found then
    raise exception 'Event participant not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'events', 'edit') then
    raise exception 'Not authorized to update event participant' using errcode = '42501';
  end if;

  select e.event_type into v_event_type
  from public.pfms_legacy_team_calendar_events e
  where e.id = v_event_id and e.team_id = v_team_id
  for share;

  if not found or v_event_type not in ('tournament','event') then
    raise exception 'Event participant does not belong to an active event entry'
      using errcode = '42501';
  end if;
  if p_status not in ('invited','confirmed','declined','attended','absent')
     or (p_note is not null and length(p_note) > 1000) then
    raise exception 'Invalid event participant data' using errcode = '22023';
  end if;

  update public.pfms_legacy_team_event_participants
  set status = p_status,
      note = nullif(pg_catalog.btrim(coalesce(p_note, '')), ''),
      updated_at = pg_catalog.now()
  where id = p_participant_id;
end;
$$;

create or replace function public.pfms_remove_legacy_team_event_participant(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_event_id uuid;
  v_event_type text;
begin
  select ep.team_id, ep.event_id
    into v_team_id, v_event_id
  from public.pfms_legacy_team_event_participants ep
  where ep.id = p_participant_id
  for update;

  if not found then
    raise exception 'Event participant not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'events', 'edit') then
    raise exception 'Not authorized to remove event participant' using errcode = '42501';
  end if;

  select e.event_type into v_event_type
  from public.pfms_legacy_team_calendar_events e
  where e.id = v_event_id and e.team_id = v_team_id
  for share;

  if not found or v_event_type not in ('tournament','event') then
    raise exception 'Event participant does not belong to an active event entry'
      using errcode = '42501';
  end if;

  delete from public.pfms_legacy_team_event_participants
  where id = p_participant_id;
end;
$$;

revoke all on function public.pfms_list_legacy_team_event_participants(uuid) from public, anon;
grant execute on function public.pfms_list_legacy_team_event_participants(uuid) to authenticated;
revoke all on function public.pfms_list_legacy_team_event_player_options(uuid) from public, anon;
grant execute on function public.pfms_list_legacy_team_event_player_options(uuid) to authenticated;
revoke all on function public.pfms_add_legacy_team_event_participant(uuid, uuid) from public, anon;
grant execute on function public.pfms_add_legacy_team_event_participant(uuid, uuid) to authenticated;
revoke all on function public.pfms_update_legacy_team_event_participant(uuid, text, text) from public, anon;
grant execute on function public.pfms_update_legacy_team_event_participant(uuid, text, text) to authenticated;
revoke all on function public.pfms_remove_legacy_team_event_participant(uuid) from public, anon;
grant execute on function public.pfms_remove_legacy_team_event_participant(uuid) to authenticated;

comment on table public.pfms_legacy_team_event_participants is
  'Event/tournament RSVP and attendance for same-team squad players; client writes are blocked by RLS and table grants.';
