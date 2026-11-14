-- PFMS team training sessions and attendance.
-- All data are scoped to one legacy club team. Reads and writes use the
-- granular training/attendance permissions defined in 20261122_team_permissions.

create table if not exists public.pfms_legacy_training_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null
    references public.pfms_legacy_teams(id) on delete cascade,
  title text not null,
  session_date date not null,
  starts_at time not null,
  ends_at time,
  location text,
  focus text,
  notes text,
  status text not null default 'planned'
    check (status in ('planned','completed','cancelled')),
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_training_title_check
    check (length(pg_catalog.btrim(title)) between 1 and 140),
  constraint pfms_legacy_training_end_check
    check (ends_at is null or ends_at > starts_at),
  constraint pfms_legacy_training_location_check
    check (location is null or length(location) <= 160),
  constraint pfms_legacy_training_focus_check
    check (focus is null or length(focus) <= 160),
  constraint pfms_legacy_training_notes_check
    check (notes is null or length(notes) <= 4000)
);

create index if not exists pfms_legacy_training_team_date_idx
  on public.pfms_legacy_training_sessions (team_id, session_date desc, starts_at);

create table if not exists public.pfms_legacy_training_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.pfms_legacy_training_sessions(id) on delete cascade,
  team_player_assignment_id uuid not null
    references public.pfms_legacy_team_players(id) on delete restrict,
  attendance_status text not null
    check (attendance_status in ('present','absent','excused','injured','late')),
  notes text,
  marked_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  marked_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_training_attendance_notes_check
    check (notes is null or length(notes) <= 1000),
  unique (session_id, team_player_assignment_id)
);

create index if not exists pfms_legacy_training_attendance_session_idx
  on public.pfms_legacy_training_attendance (session_id, attendance_status);

create or replace function public.pfms_touch_legacy_training_row()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  if tg_table_name = 'pfms_legacy_training_attendance' then
    new.marked_at := pg_catalog.now();
    new.marked_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.pfms_touch_legacy_training_row() from public, anon, authenticated;

drop trigger if exists pfms_legacy_training_sessions_touch_updated_at
  on public.pfms_legacy_training_sessions;
create trigger pfms_legacy_training_sessions_touch_updated_at
before update on public.pfms_legacy_training_sessions
for each row execute function public.pfms_touch_legacy_training_row();

drop trigger if exists pfms_legacy_training_attendance_touch_updated_at
  on public.pfms_legacy_training_attendance;
create trigger pfms_legacy_training_attendance_touch_updated_at
before update on public.pfms_legacy_training_attendance
for each row execute function public.pfms_touch_legacy_training_row();

alter table public.pfms_legacy_training_sessions enable row level security;
alter table public.pfms_legacy_training_sessions force row level security;
alter table public.pfms_legacy_training_attendance enable row level security;
alter table public.pfms_legacy_training_attendance force row level security;

drop policy if exists pfms_legacy_training_sessions_select on public.pfms_legacy_training_sessions;
create policy pfms_legacy_training_sessions_select
on public.pfms_legacy_training_sessions
for select to authenticated
using (
  public.pfms_has_legacy_team_permission(team_id, 'training', 'view')
  or public.pfms_has_legacy_team_permission(team_id, 'attendance', 'view')
);

drop policy if exists pfms_legacy_training_attendance_select on public.pfms_legacy_training_attendance;
create policy pfms_legacy_training_attendance_select
on public.pfms_legacy_training_attendance
for select to authenticated
using (
  exists (
    select 1
    from public.pfms_legacy_training_sessions s
    where s.id = session_id
      and public.pfms_has_legacy_team_permission(s.team_id, 'attendance', 'view')
  )
);

revoke all on table public.pfms_legacy_training_sessions from public, anon, authenticated;
revoke all on table public.pfms_legacy_training_attendance from public, anon, authenticated;
grant select on table public.pfms_legacy_training_sessions to authenticated;
grant select on table public.pfms_legacy_training_attendance to authenticated;

create or replace function public.pfms_list_legacy_team_training(p_team_id uuid)
returns table (
  session_id uuid,
  session_title text,
  session_date date,
  starts_at time,
  ends_at time,
  location text,
  focus text,
  session_notes text,
  session_status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    public.pfms_has_legacy_team_permission(p_team_id, 'training', 'view')
    or public.pfms_has_legacy_team_permission(p_team_id, 'attendance', 'view')
  ) then
    raise exception 'Not authorized to view team training sessions' using errcode = '42501';
  end if;

  return query
  select s.id, s.title, s.session_date, s.starts_at, s.ends_at,
         s.location, s.focus, s.notes, s.status, s.created_at
  from public.pfms_legacy_training_sessions s
  where s.team_id = p_team_id
  order by s.session_date desc, s.starts_at desc;
end;
$$;

create or replace function public.pfms_create_legacy_team_training(
  p_team_id uuid,
  p_title text,
  p_session_date date,
  p_starts_at time,
  p_ends_at time default null,
  p_location text default null,
  p_focus text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
begin
  if not public.pfms_has_legacy_team_permission(p_team_id, 'training', 'edit') then
    raise exception 'Not authorized to create team training sessions' using errcode = '42501';
  end if;
  if p_session_date is null
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_title,''))) not between 1 and 140
     or p_starts_at is null
     or (p_ends_at is not null and p_ends_at <= p_starts_at)
     or (p_location is not null and pg_catalog.length(p_location) > 160)
     or (p_focus is not null and pg_catalog.length(p_focus) > 160)
     or (p_notes is not null and pg_catalog.length(p_notes) > 4000) then
    raise exception 'Invalid training session data' using errcode = '22023';
  end if;

  insert into public.pfms_legacy_training_sessions (
    team_id, title, session_date, starts_at, ends_at,
    location, focus, notes, created_by
  ) values (
    p_team_id, pg_catalog.btrim(p_title), p_session_date, p_starts_at, p_ends_at,
    nullif(pg_catalog.btrim(coalesce(p_location,'')), ''),
    nullif(pg_catalog.btrim(coalesce(p_focus,'')), ''),
    nullif(pg_catalog.btrim(coalesce(p_notes,'')), ''),
    auth.uid()
  )
  returning id into v_session_id;
  return v_session_id;
end;
$$;

create or replace function public.pfms_update_legacy_team_training(
  p_session_id uuid,
  p_title text,
  p_session_date date,
  p_starts_at time,
  p_ends_at time,
  p_location text,
  p_focus text,
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
  select team_id into v_team_id
  from public.pfms_legacy_training_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Training session not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'training', 'edit') then
    raise exception 'Not authorized to update team training sessions' using errcode = '42501';
  end if;
  if p_session_date is null
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_title,''))) not between 1 and 140
     or p_starts_at is null
     or (p_ends_at is not null and p_ends_at <= p_starts_at)
     or p_status is null or p_status not in ('planned','completed','cancelled')
     or (p_location is not null and pg_catalog.length(p_location) > 160)
     or (p_focus is not null and pg_catalog.length(p_focus) > 160)
     or (p_notes is not null and pg_catalog.length(p_notes) > 4000) then
    raise exception 'Invalid training session data' using errcode = '22023';
  end if;

  update public.pfms_legacy_training_sessions
  set title = pg_catalog.btrim(p_title),
      session_date = p_session_date,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      location = nullif(pg_catalog.btrim(coalesce(p_location,'')), ''),
      focus = nullif(pg_catalog.btrim(coalesce(p_focus,'')), ''),
      notes = nullif(pg_catalog.btrim(coalesce(p_notes,'')), ''),
      status = p_status
  where id = p_session_id;
end;
$$;

create or replace function public.pfms_list_legacy_training_attendance(p_session_id uuid)
returns table (
  session_id uuid,
  assignment_id uuid,
  player_id uuid,
  player_name text,
  player_surname text,
  jersey_number smallint,
  preferred_position text,
  squad_status text,
  attendance_status text,
  attendance_notes text,
  marked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  select team_id into v_team_id
  from public.pfms_legacy_training_sessions
  where id = p_session_id;

  if not found then
    raise exception 'Training session not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'attendance', 'view') then
    raise exception 'Not authorized to view team attendance' using errcode = '42501';
  end if;

  return query
  select
    p_session_id,
    tp.id,
    p.id,
    p.name,
    p.surname,
    tp.jersey_number,
    coalesce(tp.position_override, p.position),
    tp.squad_status,
    coalesce(a.attendance_status, 'pending'),
    a.notes,
    a.marked_at
  from public.pfms_legacy_team_players tp
  join public.pfms_global_players p on p.id = tp.player_id
  left join public.pfms_legacy_training_attendance a
    on a.session_id = p_session_id
   and a.team_player_assignment_id = tp.id
  where tp.team_id = v_team_id
  order by tp.jersey_number nulls last,
           pg_catalog.lower(p.surname), pg_catalog.lower(p.name);
end;
$$;

create or replace function public.pfms_mark_legacy_training_attendance(
  p_session_id uuid,
  p_assignment_id uuid,
  p_attendance_status text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_assignment_team_id uuid;
begin
  select team_id into v_team_id
  from public.pfms_legacy_training_sessions
  where id = p_session_id
  for share;
  if not found then
    raise exception 'Training session not found' using errcode = 'P0002';
  end if;

  if not public.pfms_has_legacy_team_permission(v_team_id, 'attendance', 'edit') then
    raise exception 'Not authorized to edit team attendance' using errcode = '42501';
  end if;

  if p_attendance_status is null or p_attendance_status not in ('pending','present','absent','excused','injured','late')
     or (p_notes is not null and pg_catalog.length(p_notes) > 1000) then
    raise exception 'Invalid attendance data' using errcode = '22023';
  end if;

  select team_id into v_assignment_team_id
  from public.pfms_legacy_team_players
  where id = p_assignment_id
  for share;
  if not found or v_assignment_team_id <> v_team_id then
    raise exception 'Player is not assigned to this team' using errcode = '42501';
  end if;

  if p_attendance_status = 'pending' then
    delete from public.pfms_legacy_training_attendance
    where session_id = p_session_id
      and team_player_assignment_id = p_assignment_id;
    return;
  end if;

  insert into public.pfms_legacy_training_attendance (
    session_id, team_player_assignment_id, attendance_status, notes, marked_by
  ) values (
    p_session_id, p_assignment_id, p_attendance_status,
    nullif(pg_catalog.btrim(coalesce(p_notes,'')), ''),
    auth.uid()
  )
  on conflict (session_id, team_player_assignment_id)
  do update set
    attendance_status = excluded.attendance_status,
    notes = excluded.notes,
    marked_by = auth.uid(),
    marked_at = pg_catalog.now(),
    updated_at = pg_catalog.now();
end;
$$;

revoke all on function public.pfms_list_legacy_team_training(uuid) from public, anon;
revoke all on function public.pfms_create_legacy_team_training(uuid,text,date,time,time,text,text,text) from public, anon;
revoke all on function public.pfms_update_legacy_team_training(uuid,text,date,time,time,text,text,text,text) from public, anon;
revoke all on function public.pfms_list_legacy_training_attendance(uuid) from public, anon;
revoke all on function public.pfms_mark_legacy_training_attendance(uuid,uuid,text,text) from public, anon;

grant execute on function public.pfms_list_legacy_team_training(uuid) to authenticated;
grant execute on function public.pfms_create_legacy_team_training(uuid,text,date,time,time,text,text,text) to authenticated;
grant execute on function public.pfms_update_legacy_team_training(uuid,text,date,time,time,text,text,text,text) to authenticated;
grant execute on function public.pfms_list_legacy_training_attendance(uuid) to authenticated;
grant execute on function public.pfms_mark_legacy_training_attendance(uuid,uuid,text,text) to authenticated;

comment on table public.pfms_legacy_training_sessions is
  'Team-scoped training sessions. The training module permission controls session access.';
comment on table public.pfms_legacy_training_attendance is
  'Per-session attendance records linked to the roster. The attendance module permission controls access.';
