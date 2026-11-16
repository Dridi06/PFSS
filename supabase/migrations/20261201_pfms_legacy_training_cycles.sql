-- PFMS team training cycles and weekly microcycle planning.
-- Adds season-safe training blocks without changing existing session or attendance records.

create table if not exists public.pfms_legacy_training_cycles (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.pfms_legacy_teams(id) on delete cascade,
  title text not null,
  focus text,
  start_date date not null,
  end_date date not null,
  status text not null default 'planned'
    check (status in ('planned','active','completed','archived')),
  notes text,
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_training_cycle_title_check
    check (length(pg_catalog.btrim(title)) between 3 and 140),
  constraint pfms_legacy_training_cycle_focus_check
    check (focus is null or length(focus) <= 160),
  constraint pfms_legacy_training_cycle_dates_check
    check (end_date >= start_date and end_date <= start_date + 363),
  constraint pfms_legacy_training_cycle_notes_check
    check (notes is null or length(notes) <= 4000),
  unique (id, team_id)
);

create table if not exists public.pfms_legacy_training_cycle_weeks (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null,
  team_id uuid not null,
  week_number smallint not null check (week_number between 1 and 52),
  starts_on date not null,
  ends_on date not null,
  focus text,
  objectives text,
  target_load smallint check (target_load is null or target_load between 1 and 5),
  coach_notes text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_training_cycle_week_dates_check
    check (ends_on >= starts_on and ends_on <= starts_on + 6),
  constraint pfms_legacy_training_cycle_week_focus_check
    check (focus is null or length(focus) <= 160),
  constraint pfms_legacy_training_cycle_week_objectives_check
    check (objectives is null or length(objectives) <= 3000),
  constraint pfms_legacy_training_cycle_week_notes_check
    check (coach_notes is null or length(coach_notes) <= 3000),
  unique (cycle_id, week_number),
  unique (id, team_id),
  foreign key (cycle_id, team_id)
    references public.pfms_legacy_training_cycles(id, team_id)
    on delete cascade
);

create index if not exists pfms_legacy_training_cycles_team_dates_idx
  on public.pfms_legacy_training_cycles(team_id, start_date desc, end_date);
create index if not exists pfms_legacy_training_cycle_weeks_cycle_idx
  on public.pfms_legacy_training_cycle_weeks(cycle_id, week_number);

-- A scheduled session may be attached to one microcycle week only.
-- The composite foreign key prevents cross-team assignments at database level.
alter table public.pfms_legacy_training_sessions
  add column if not exists cycle_week_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pfms_legacy_training_sessions'::regclass
      and conname = 'pfms_legacy_training_sessions_cycle_week_team_fk'
  ) then
    alter table public.pfms_legacy_training_sessions
      add constraint pfms_legacy_training_sessions_cycle_week_team_fk
      foreign key (cycle_week_id, team_id)
      references public.pfms_legacy_training_cycle_weeks(id, team_id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists pfms_legacy_training_sessions_cycle_week_idx
  on public.pfms_legacy_training_sessions(team_id, cycle_week_id, session_date);

create or replace function public.pfms_touch_legacy_training_cycle()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfms_touch_legacy_training_cycle() from public, anon, authenticated;

drop trigger if exists pfms_legacy_training_cycles_touch_updated_at
  on public.pfms_legacy_training_cycles;
create trigger pfms_legacy_training_cycles_touch_updated_at
before update on public.pfms_legacy_training_cycles
for each row execute function public.pfms_touch_legacy_training_cycle();

drop trigger if exists pfms_legacy_training_cycle_weeks_touch_updated_at
  on public.pfms_legacy_training_cycle_weeks;
create trigger pfms_legacy_training_cycle_weeks_touch_updated_at
before update on public.pfms_legacy_training_cycle_weeks
for each row execute function public.pfms_touch_legacy_training_cycle();

alter table public.pfms_legacy_training_cycles enable row level security;
alter table public.pfms_legacy_training_cycles force row level security;
alter table public.pfms_legacy_training_cycle_weeks enable row level security;
alter table public.pfms_legacy_training_cycle_weeks force row level security;

drop policy if exists pfms_legacy_training_cycles_select on public.pfms_legacy_training_cycles;
create policy pfms_legacy_training_cycles_select
on public.pfms_legacy_training_cycles
for select to authenticated
using (public.pfms_has_legacy_team_permission(team_id, 'training', 'view'));

drop policy if exists pfms_legacy_training_cycle_weeks_select on public.pfms_legacy_training_cycle_weeks;
create policy pfms_legacy_training_cycle_weeks_select
on public.pfms_legacy_training_cycle_weeks
for select to authenticated
using (public.pfms_has_legacy_team_permission(team_id, 'training', 'view'));

revoke all on table public.pfms_legacy_training_cycles from public, anon, authenticated;
revoke all on table public.pfms_legacy_training_cycle_weeks from public, anon, authenticated;
grant select on table public.pfms_legacy_training_cycles to authenticated;
grant select on table public.pfms_legacy_training_cycle_weeks to authenticated;

create or replace function public.pfms_list_legacy_training_cycles(p_team_id uuid)
returns table (
  cycle_id uuid,
  cycle_title text,
  cycle_focus text,
  cycle_start date,
  cycle_end date,
  cycle_status text,
  cycle_notes text,
  created_at timestamptz,
  weeks jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.pfms_has_legacy_team_permission(p_team_id, 'training', 'view') then
    raise exception 'Not authorized to view training cycles' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.title,
    c.focus,
    c.start_date,
    c.end_date,
    c.status,
    c.notes,
    c.created_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'week_id', w.id,
          'week_number', w.week_number,
          'starts_on', w.starts_on,
          'ends_on', w.ends_on,
          'focus', w.focus,
          'objectives', w.objectives,
          'target_load', w.target_load,
          'coach_notes', w.coach_notes,
          'sessions', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'session_id', s.id,
                'title', s.title,
                'session_date', s.session_date,
                'starts_at', s.starts_at,
                'status', s.status,
                'focus', s.focus
              ) order by s.session_date, s.starts_at
            )
            from public.pfms_legacy_training_sessions s
            where s.cycle_week_id = w.id
              and s.team_id = c.team_id
          ), '[]'::jsonb)
        ) order by w.week_number
      )
      from public.pfms_legacy_training_cycle_weeks w
      where w.cycle_id = c.id
        and w.team_id = c.team_id
    ), '[]'::jsonb)
  from public.pfms_legacy_training_cycles c
  where c.team_id = p_team_id
  order by c.start_date desc, c.created_at desc;
end;
$$;

create or replace function public.pfms_create_legacy_training_cycle(
  p_team_id uuid,
  p_title text,
  p_focus text,
  p_start_date date,
  p_end_date date,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle_id uuid;
  v_week_start date;
  v_week_end date;
  v_week_number smallint := 1;
begin
  if not public.pfms_has_legacy_team_permission(p_team_id, 'training', 'edit') then
    raise exception 'Not authorized to create training cycles' using errcode = '42501';
  end if;

  if p_team_id is null
     or p_start_date is null
     or p_end_date is null
     or p_end_date < p_start_date
     or p_end_date > p_start_date + 363
     or length(btrim(coalesce(p_title, ''))) not between 3 and 140
     or (p_focus is not null and length(p_focus) > 160)
     or (p_notes is not null and length(p_notes) > 4000) then
    raise exception 'Invalid training cycle data; duration must be between 1 and 364 days'
      using errcode = '22023';
  end if;

  insert into public.pfms_legacy_training_cycles (
    team_id, title, focus, start_date, end_date, notes, created_by
  ) values (
    p_team_id,
    btrim(p_title),
    nullif(btrim(coalesce(p_focus, '')), ''),
    p_start_date,
    p_end_date,
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_cycle_id;

  v_week_start := p_start_date;
  while v_week_start <= p_end_date loop
    v_week_end := least(v_week_start + 6, p_end_date);
    insert into public.pfms_legacy_training_cycle_weeks (
      cycle_id, team_id, week_number, starts_on, ends_on, focus
    ) values (
      v_cycle_id, p_team_id, v_week_number, v_week_start, v_week_end,
      nullif(btrim(coalesce(p_focus, '')), '')
    );
    v_week_start := v_week_start + 7;
    v_week_number := v_week_number + 1;
  end loop;

  return v_cycle_id;
end;
$$;

create or replace function public.pfms_update_legacy_training_cycle_week(
  p_week_id uuid,
  p_focus text,
  p_objectives text,
  p_target_load smallint,
  p_coach_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  select w.team_id
    into v_team_id
  from public.pfms_legacy_training_cycle_weeks w
  where w.id = p_week_id
  for update;

  if not found then
    raise exception 'Training cycle week not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'training', 'edit') then
    raise exception 'Not authorized to update training cycle week' using errcode = '42501';
  end if;
  if (p_focus is not null and length(p_focus) > 160)
     or (p_objectives is not null and length(p_objectives) > 3000)
     or (p_target_load is not null and p_target_load not between 1 and 5)
     or (p_coach_notes is not null and length(p_coach_notes) > 3000) then
    raise exception 'Invalid training cycle week data' using errcode = '22023';
  end if;

  update public.pfms_legacy_training_cycle_weeks
  set focus = nullif(btrim(coalesce(p_focus, '')), ''),
      objectives = nullif(btrim(coalesce(p_objectives, '')), ''),
      target_load = p_target_load,
      coach_notes = nullif(btrim(coalesce(p_coach_notes, '')), ''),
      updated_at = pg_catalog.now()
  where id = p_week_id;
end;
$$;

create or replace function public.pfms_update_legacy_training_cycle_status(
  p_cycle_id uuid,
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
  select c.team_id
    into v_team_id
  from public.pfms_legacy_training_cycles c
  where c.id = p_cycle_id
  for update;

  if not found then
    raise exception 'Training cycle not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'training', 'edit') then
    raise exception 'Not authorized to update training cycle status' using errcode = '42501';
  end if;
  if p_status not in ('planned','active','completed','archived') then
    raise exception 'Invalid training cycle status' using errcode = '22023';
  end if;

  update public.pfms_legacy_training_cycles
  set status = p_status, updated_at = pg_catalog.now()
  where id = p_cycle_id;
end;
$$;

create or replace function public.pfms_assign_legacy_training_session_cycle_week(
  p_session_id uuid,
  p_week_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_session_date date;
  v_week_team_id uuid;
  v_week_start date;
  v_week_end date;
begin
  select s.team_id, s.session_date
    into v_team_id, v_session_date
  from public.pfms_legacy_training_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception 'Training session not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'training', 'edit') then
    raise exception 'Not authorized to assign a training session' using errcode = '42501';
  end if;

  if p_week_id is not null then
    select w.team_id, w.starts_on, w.ends_on
      into v_week_team_id, v_week_start, v_week_end
    from public.pfms_legacy_training_cycle_weeks w
    where w.id = p_week_id
    for share;

    if not found or v_week_team_id <> v_team_id then
      raise exception 'Training cycle week belongs to another team' using errcode = '23514';
    end if;
    if v_session_date < v_week_start or v_session_date > v_week_end then
      raise exception 'Training session date is outside the selected cycle week'
        using errcode = '22023';
    end if;
  end if;

  update public.pfms_legacy_training_sessions
  set cycle_week_id = p_week_id,
      updated_at = pg_catalog.now()
  where id = p_session_id;
end;
$$;

revoke all on function public.pfms_list_legacy_training_cycles(uuid) from public, anon;
grant execute on function public.pfms_list_legacy_training_cycles(uuid) to authenticated;

revoke all on function public.pfms_create_legacy_training_cycle(uuid, text, text, date, date, text) from public, anon;
grant execute on function public.pfms_create_legacy_training_cycle(uuid, text, text, date, date, text) to authenticated;

revoke all on function public.pfms_update_legacy_training_cycle_week(uuid, text, text, smallint, text) from public, anon;
grant execute on function public.pfms_update_legacy_training_cycle_week(uuid, text, text, smallint, text) to authenticated;

revoke all on function public.pfms_update_legacy_training_cycle_status(uuid, text) from public, anon;
grant execute on function public.pfms_update_legacy_training_cycle_status(uuid, text) to authenticated;

revoke all on function public.pfms_assign_legacy_training_session_cycle_week(uuid, uuid) from public, anon;
grant execute on function public.pfms_assign_legacy_training_session_cycle_week(uuid, uuid) to authenticated;

comment on table public.pfms_legacy_training_cycles is
  'Team-owned macrocycles; each cycle receives a generated set of dated weekly microcycles.';
comment on table public.pfms_legacy_training_cycle_weeks is
  'Weekly training targets and load planning scoped to the owning team and cycle.';
