-- PFMS team-scoped training exercise library and session plans.
-- Uses the existing 'training.view' and 'training.edit' module permissions.
-- Direct browser writes are blocked; all changes run through checked RPCs.

create unique index if not exists pfms_legacy_training_sessions_id_team_uidx
  on public.pfms_legacy_training_sessions (id, team_id);

create table if not exists public.pfms_legacy_team_training_exercises (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null
    references public.pfms_legacy_teams(id) on delete cascade,
  title text not null,
  category text not null default 'technical'
    check (category in ('warmup','technical','tactical','physical','finishing','cooldown','other')),
  duration_minutes smallint not null default 15
    check (duration_minutes between 1 and 180),
  min_players smallint not null default 2
    check (min_players between 1 and 40),
  max_players smallint
    check (max_players is null or max_players between 1 and 40),
  difficulty text not null default 'intermediate'
    check (difficulty in ('beginner','intermediate','advanced')),
  pitch_size text
    check (pitch_size is null or length(pitch_size) <= 100),
  equipment text
    check (equipment is null or length(equipment) <= 1500),
  setup text
    check (setup is null or length(setup) <= 4000),
  instructions text
    check (instructions is null or length(instructions) <= 8000),
  coaching_points text
    check (coaching_points is null or length(coaching_points) <= 5000),
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_team_exercise_title_check
    check (length(pg_catalog.btrim(title)) between 1 and 140),
  constraint pfms_legacy_team_exercise_player_range_check
    check (max_players is null or max_players >= min_players),
  constraint pfms_legacy_team_exercise_id_team_unique
    unique (id, team_id)
);

create index if not exists pfms_legacy_team_exercises_team_category_idx
  on public.pfms_legacy_team_training_exercises (team_id, category, title);

create table if not exists public.pfms_legacy_training_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  exercise_id uuid not null,
  team_id uuid not null,
  sort_order smallint not null
    check (sort_order between 1 and 30),
  planned_duration_minutes smallint not null
    check (planned_duration_minutes between 1 and 180),
  notes text
    check (notes is null or length(notes) <= 2000),
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_session_exercise_session_team_fk
    foreign key (session_id, team_id)
    references public.pfms_legacy_training_sessions(id, team_id)
    on delete cascade,
  constraint pfms_legacy_session_exercise_exercise_team_fk
    foreign key (exercise_id, team_id)
    references public.pfms_legacy_team_training_exercises(id, team_id)
    on delete restrict,
  constraint pfms_legacy_session_exercise_unique
    unique (session_id, exercise_id),
  constraint pfms_legacy_session_exercise_order_unique
    unique (session_id, sort_order)
);

create index if not exists pfms_legacy_session_exercises_team_session_idx
  on public.pfms_legacy_training_session_exercises (team_id, session_id, sort_order);

create or replace function public.pfms_touch_legacy_team_exercise()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfms_touch_legacy_team_exercise() from public, anon, authenticated;
drop trigger if exists pfms_legacy_team_exercise_touch_updated_at
  on public.pfms_legacy_team_training_exercises;
create trigger pfms_legacy_team_exercise_touch_updated_at
before update on public.pfms_legacy_team_training_exercises
for each row execute function public.pfms_touch_legacy_team_exercise();

alter table public.pfms_legacy_team_training_exercises enable row level security;
alter table public.pfms_legacy_team_training_exercises force row level security;
alter table public.pfms_legacy_training_session_exercises enable row level security;
alter table public.pfms_legacy_training_session_exercises force row level security;

drop policy if exists pfms_legacy_team_exercises_select on public.pfms_legacy_team_training_exercises;
create policy pfms_legacy_team_exercises_select
on public.pfms_legacy_team_training_exercises
for select to authenticated
using (public.pfms_has_legacy_team_permission(team_id, 'training', 'view'));

drop policy if exists pfms_legacy_session_exercises_select on public.pfms_legacy_training_session_exercises;
create policy pfms_legacy_session_exercises_select
on public.pfms_legacy_training_session_exercises
for select to authenticated
using (
  team_id is not null
  and public.pfms_has_legacy_team_permission(team_id, 'training', 'view')
);

revoke all on table public.pfms_legacy_team_training_exercises from public, anon, authenticated;
revoke all on table public.pfms_legacy_training_session_exercises from public, anon, authenticated;
grant select on table public.pfms_legacy_team_training_exercises to authenticated;
grant select on table public.pfms_legacy_training_session_exercises to authenticated;

create or replace function public.pfms_list_legacy_team_training_exercises(p_team_id uuid)
returns table (
  exercise_id uuid,
  title text,
  category text,
  duration_minutes smallint,
  min_players smallint,
  max_players smallint,
  difficulty text,
  pitch_size text,
  equipment text,
  setup text,
  instructions text,
  coaching_points text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'training', 'view') then
    raise exception 'Not authorized to view team exercises' using errcode = '42501';
  end if;

  return query
  select e.id, e.title, e.category, e.duration_minutes, e.min_players,
         e.max_players, e.difficulty, e.pitch_size, e.equipment,
         e.setup, e.instructions, e.coaching_points, e.updated_at
  from public.pfms_legacy_team_training_exercises e
  where e.team_id = p_team_id
  order by e.category, e.title;
end;
$$;

create or replace function public.pfms_create_legacy_team_training_exercise(
  p_team_id uuid,
  p_title text,
  p_category text,
  p_duration_minutes smallint,
  p_min_players smallint,
  p_max_players smallint,
  p_difficulty text,
  p_pitch_size text,
  p_equipment text,
  p_setup text,
  p_instructions text,
  p_coaching_points text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exercise_id uuid;
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'training', 'edit') then
    raise exception 'Not authorized to create team exercises' using errcode = '42501';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(p_title,''))) not between 1 and 140
     or p_category not in ('warmup','technical','tactical','physical','finishing','cooldown','other')
     or p_duration_minutes not between 1 and 180
     or p_min_players not between 1 and 40
     or (p_max_players is not null and (p_max_players not between 1 and 40 or p_max_players < p_min_players))
     or p_difficulty not in ('beginner','intermediate','advanced')
     or (p_pitch_size is not null and pg_catalog.length(p_pitch_size) > 100)
     or (p_equipment is not null and pg_catalog.length(p_equipment) > 1500)
     or (p_setup is not null and pg_catalog.length(p_setup) > 4000)
     or (p_instructions is not null and pg_catalog.length(p_instructions) > 8000)
     or (p_coaching_points is not null and pg_catalog.length(p_coaching_points) > 5000) then
    raise exception 'Invalid team exercise data' using errcode = '22023';
  end if;

  insert into public.pfms_legacy_team_training_exercises (
    team_id, title, category, duration_minutes, min_players, max_players,
    difficulty, pitch_size, equipment, setup, instructions, coaching_points, created_by
  ) values (
    p_team_id, pg_catalog.btrim(p_title), p_category, p_duration_minutes,
    p_min_players, p_max_players, p_difficulty,
    nullif(pg_catalog.btrim(coalesce(p_pitch_size,'')), ''),
    nullif(pg_catalog.btrim(coalesce(p_equipment,'')), ''),
    nullif(pg_catalog.btrim(coalesce(p_setup,'')), ''),
    nullif(pg_catalog.btrim(coalesce(p_instructions,'')), ''),
    nullif(pg_catalog.btrim(coalesce(p_coaching_points,'')), ''),
    auth.uid()
  )
  returning id into v_exercise_id;

  return v_exercise_id;
end;
$$;

create or replace function public.pfms_update_legacy_team_training_exercise(
  p_exercise_id uuid,
  p_title text,
  p_category text,
  p_duration_minutes smallint,
  p_min_players smallint,
  p_max_players smallint,
  p_difficulty text,
  p_pitch_size text,
  p_equipment text,
  p_setup text,
  p_instructions text,
  p_coaching_points text
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
  from public.pfms_legacy_team_training_exercises
  where id = p_exercise_id
  for update;

  if not found then
    raise exception 'Training exercise not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'training', 'edit') then
    raise exception 'Not authorized to update team exercises' using errcode = '42501';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(p_title,''))) not between 1 and 140
     or p_category not in ('warmup','technical','tactical','physical','finishing','cooldown','other')
     or p_duration_minutes not between 1 and 180
     or p_min_players not between 1 and 40
     or (p_max_players is not null and (p_max_players not between 1 and 40 or p_max_players < p_min_players))
     or p_difficulty not in ('beginner','intermediate','advanced')
     or (p_pitch_size is not null and pg_catalog.length(p_pitch_size) > 100)
     or (p_equipment is not null and pg_catalog.length(p_equipment) > 1500)
     or (p_setup is not null and pg_catalog.length(p_setup) > 4000)
     or (p_instructions is not null and pg_catalog.length(p_instructions) > 8000)
     or (p_coaching_points is not null and pg_catalog.length(p_coaching_points) > 5000) then
    raise exception 'Invalid team exercise data' using errcode = '22023';
  end if;

  update public.pfms_legacy_team_training_exercises
  set title = pg_catalog.btrim(p_title),
      category = p_category,
      duration_minutes = p_duration_minutes,
      min_players = p_min_players,
      max_players = p_max_players,
      difficulty = p_difficulty,
      pitch_size = nullif(pg_catalog.btrim(coalesce(p_pitch_size,'')), ''),
      equipment = nullif(pg_catalog.btrim(coalesce(p_equipment,'')), ''),
      setup = nullif(pg_catalog.btrim(coalesce(p_setup,'')), ''),
      instructions = nullif(pg_catalog.btrim(coalesce(p_instructions,'')), ''),
      coaching_points = nullif(pg_catalog.btrim(coalesce(p_coaching_points,'')), '')
  where id = p_exercise_id;
end;
$$;

create or replace function public.pfms_delete_legacy_team_training_exercise(p_exercise_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  select team_id into v_team_id
  from public.pfms_legacy_team_training_exercises
  where id = p_exercise_id
  for update;

  if not found then
    raise exception 'Training exercise not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'training', 'edit') then
    raise exception 'Not authorized to delete team exercises' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.pfms_legacy_training_session_exercises
    where exercise_id = p_exercise_id
  ) then
    raise exception 'Exercise is used in a training plan and cannot be deleted' using errcode = '23503';
  end if;

  delete from public.pfms_legacy_team_training_exercises where id = p_exercise_id;
end;
$$;

create or replace function public.pfms_list_legacy_training_session_exercises(p_session_id uuid)
returns table (
  exercise_id uuid,
  title text,
  category text,
  library_duration_minutes smallint,
  planned_duration_minutes smallint,
  sort_order smallint,
  notes text
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
  if not public.pfms_has_legacy_team_permission(v_team_id, 'training', 'view') then
    raise exception 'Not authorized to view this training plan' using errcode = '42501';
  end if;

  return query
  select e.id, e.title, e.category, e.duration_minutes,
         se.planned_duration_minutes, se.sort_order, se.notes
  from public.pfms_legacy_training_session_exercises se
  join public.pfms_legacy_team_training_exercises e
    on e.id = se.exercise_id and e.team_id = se.team_id
  where se.session_id = p_session_id
    and se.team_id = v_team_id
  order by se.sort_order;
end;
$$;

create or replace function public.pfms_save_legacy_training_session_exercises(
  p_session_id uuid,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_item jsonb;
  v_exercise_id uuid;
  v_order integer;
  v_duration integer;
  v_count integer;
  v_total_duration integer;
  v_notes text;
begin
  select team_id into v_team_id
  from public.pfms_legacy_training_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Training session not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'training', 'edit') then
    raise exception 'Not authorized to edit this training plan' using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Training plan items must be a JSON array' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_array_length(p_items) > 30 then
    raise exception 'Training plan must contain at most 30 exercises' using errcode = '22023';
  end if;

  select pg_catalog.count(*),
         coalesce(sum((value ->> 'planned_duration_minutes')::integer), 0)
  into v_count, v_total_duration
  from pg_catalog.jsonb_array_elements(p_items);

  if v_total_duration > 480 then
    raise exception 'Training plan cannot exceed 480 minutes' using errcode = '22023';
  end if;

  if (
    select pg_catalog.count(distinct value ->> 'exercise_id')
    from pg_catalog.jsonb_array_elements(p_items)
  ) <> v_count then
    raise exception 'An exercise may only appear once in a training plan' using errcode = '22023';
  end if;

  if (
    select pg_catalog.count(distinct value ->> 'sort_order')
    from pg_catalog.jsonb_array_elements(p_items)
  ) <> v_count then
    raise exception 'Training plan order must be unique' using errcode = '22023';
  end if;

  for v_item in
    select value from pg_catalog.jsonb_array_elements(p_items)
  loop
    if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
       or nullif(v_item ->> 'exercise_id','') is null
       or nullif(v_item ->> 'sort_order','') is null
       or (v_item ->> 'sort_order') !~ '^[0-9]+$'
       or nullif(v_item ->> 'planned_duration_minutes','') is null
       or (v_item ->> 'planned_duration_minutes') !~ '^[0-9]+$' then
      raise exception 'Invalid training plan entry' using errcode = '22023';
    end if;

    v_exercise_id := (v_item ->> 'exercise_id')::uuid;
    v_order := (v_item ->> 'sort_order')::integer;
    v_duration := (v_item ->> 'planned_duration_minutes')::integer;
    v_notes := nullif(pg_catalog.btrim(coalesce(v_item ->> 'notes','')), '');

    if v_order not between 1 and 30
       or v_duration not between 1 and 180
       or (v_notes is not null and pg_catalog.length(v_notes) > 2000) then
      raise exception 'Invalid training plan duration, order or notes' using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.pfms_legacy_team_training_exercises e
      where e.id = v_exercise_id and e.team_id = v_team_id
    ) then
      raise exception 'Every exercise must belong to the selected team' using errcode = '42501';
    end if;
  end loop;

  delete from public.pfms_legacy_training_session_exercises
  where session_id = p_session_id and team_id = v_team_id;

  for v_item in
    select value from pg_catalog.jsonb_array_elements(p_items)
  loop
    insert into public.pfms_legacy_training_session_exercises (
      session_id, exercise_id, team_id, sort_order,
      planned_duration_minutes, notes, created_by
    ) values (
      p_session_id,
      (v_item ->> 'exercise_id')::uuid,
      v_team_id,
      (v_item ->> 'sort_order')::smallint,
      (v_item ->> 'planned_duration_minutes')::smallint,
      nullif(pg_catalog.btrim(coalesce(v_item ->> 'notes','')), ''),
      auth.uid()
    );
  end loop;

  return v_count;
end;
$$;

revoke all on function public.pfms_list_legacy_team_training_exercises(uuid) from public, anon;
revoke all on function public.pfms_create_legacy_team_training_exercise(uuid,text,text,smallint,smallint,smallint,text,text,text,text,text,text) from public, anon;
revoke all on function public.pfms_update_legacy_team_training_exercise(uuid,text,text,smallint,smallint,smallint,text,text,text,text,text,text) from public, anon;
revoke all on function public.pfms_delete_legacy_team_training_exercise(uuid) from public, anon;
revoke all on function public.pfms_list_legacy_training_session_exercises(uuid) from public, anon;
revoke all on function public.pfms_save_legacy_training_session_exercises(uuid,jsonb) from public, anon;

grant execute on function public.pfms_list_legacy_team_training_exercises(uuid) to authenticated;
grant execute on function public.pfms_create_legacy_team_training_exercise(uuid,text,text,smallint,smallint,smallint,text,text,text,text,text,text) to authenticated;
grant execute on function public.pfms_update_legacy_team_training_exercise(uuid,text,text,smallint,smallint,smallint,text,text,text,text,text,text) to authenticated;
grant execute on function public.pfms_delete_legacy_team_training_exercise(uuid) to authenticated;
grant execute on function public.pfms_list_legacy_training_session_exercises(uuid) to authenticated;
grant execute on function public.pfms_save_legacy_training_session_exercises(uuid,jsonb) to authenticated;

comment on table public.pfms_legacy_team_training_exercises is
  'Team-owned exercise library. All read/write access is guarded by training.view/edit.';
comment on table public.pfms_legacy_training_session_exercises is
  'Ordered exercises attached to a specific training session. Composite foreign keys prevent cross-team plans.';
