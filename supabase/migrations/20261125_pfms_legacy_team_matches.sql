-- PFMS team match operations: fixtures, results and matchday lineups.
-- All direct client writes are revoked; mutations use permission-checked RPCs.

create table if not exists public.pfms_legacy_team_matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null
    references public.pfms_legacy_teams(id) on delete cascade,
  opponent text not null,
  competition text,
  home_away text not null default 'home'
    check (home_away in ('home','away')),
  match_date date not null,
  kickoff time not null,
  venue text,
  status text not null default 'scheduled'
    check (status in ('scheduled','completed','postponed','cancelled')),
  team_goals smallint,
  opponent_goals smallint,
  match_notes text,
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_team_matches_opponent_check
    check (length(pg_catalog.btrim(opponent)) between 1 and 140),
  constraint pfms_legacy_team_matches_competition_check
    check (competition is null or length(competition) <= 140),
  constraint pfms_legacy_team_matches_venue_check
    check (venue is null or length(venue) <= 180),
  constraint pfms_legacy_team_matches_goals_check
    check (
      (team_goals is null and opponent_goals is null)
      or (team_goals between 0 and 30 and opponent_goals between 0 and 30)
    ),
  constraint pfms_legacy_team_matches_result_status_check
    check (status <> 'completed' or (team_goals is not null and opponent_goals is not null)),
  constraint pfms_legacy_team_matches_notes_check
    check (match_notes is null or length(match_notes) <= 6000)
);

create index if not exists pfms_legacy_team_matches_team_date_idx
  on public.pfms_legacy_team_matches (team_id, match_date, kickoff);

create table if not exists public.pfms_legacy_team_match_lineup (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null
    references public.pfms_legacy_team_matches(id) on delete cascade,
  team_player_assignment_id uuid not null
    references public.pfms_legacy_team_players(id) on delete restrict,
  lineup_role text not null check (lineup_role in ('starter','bench')),
  position text not null
    check (position in ('Torwart','Abwehr','Mittelfeld','Sturm')),
  sort_order smallint not null check (sort_order between 1 and 30),
  is_captain boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  unique (match_id, team_player_assignment_id),
  unique (match_id, sort_order)
);

create unique index if not exists pfms_legacy_team_match_one_captain_uidx
  on public.pfms_legacy_team_match_lineup (match_id)
  where is_captain;

create index if not exists pfms_legacy_team_match_lineup_match_idx
  on public.pfms_legacy_team_match_lineup (match_id, lineup_role, sort_order);

create or replace function public.pfms_touch_legacy_team_match()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfms_touch_legacy_team_match() from public, anon, authenticated;

drop trigger if exists pfms_legacy_team_matches_touch_updated_at
  on public.pfms_legacy_team_matches;
create trigger pfms_legacy_team_matches_touch_updated_at
before update on public.pfms_legacy_team_matches
for each row execute function public.pfms_touch_legacy_team_match();

alter table public.pfms_legacy_team_matches enable row level security;
alter table public.pfms_legacy_team_matches force row level security;
alter table public.pfms_legacy_team_match_lineup enable row level security;
alter table public.pfms_legacy_team_match_lineup force row level security;

drop policy if exists pfms_legacy_team_matches_select on public.pfms_legacy_team_matches;
create policy pfms_legacy_team_matches_select
on public.pfms_legacy_team_matches
for select to authenticated
using (public.pfms_has_legacy_team_permission(team_id, 'matches', 'view'));

drop policy if exists pfms_legacy_team_match_lineup_select on public.pfms_legacy_team_match_lineup;
create policy pfms_legacy_team_match_lineup_select
on public.pfms_legacy_team_match_lineup
for select to authenticated
using (
  exists (
    select 1 from public.pfms_legacy_team_matches m
    where m.id = match_id
      and public.pfms_has_legacy_team_permission(m.team_id, 'matches', 'view')
  )
);

revoke all on table public.pfms_legacy_team_matches from public, anon, authenticated;
revoke all on table public.pfms_legacy_team_match_lineup from public, anon, authenticated;
grant select on table public.pfms_legacy_team_matches to authenticated;
grant select on table public.pfms_legacy_team_match_lineup to authenticated;

create or replace function public.pfms_list_legacy_team_matches(p_team_id uuid)
returns table (
  match_id uuid,
  opponent text,
  competition text,
  home_away text,
  match_date date,
  kickoff time,
  venue text,
  match_status text,
  team_goals smallint,
  opponent_goals smallint,
  match_notes text,
  lineup_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'matches', 'view') then
    raise exception 'Not authorized to view team matches' using errcode = '42501';
  end if;

  return query
  select m.id, m.opponent, m.competition, m.home_away, m.match_date,
         m.kickoff, m.venue, m.status, m.team_goals, m.opponent_goals,
         m.match_notes,
         count(l.id)
  from public.pfms_legacy_team_matches m
  left join public.pfms_legacy_team_match_lineup l on l.match_id = m.id
  where m.team_id = p_team_id
  group by m.id
  order by m.match_date, m.kickoff;
end;
$$;

create or replace function public.pfms_create_legacy_team_match(
  p_team_id uuid,
  p_opponent text,
  p_competition text,
  p_home_away text,
  p_match_date date,
  p_kickoff time,
  p_venue text default null,
  p_match_notes text default null,
  p_status text default 'scheduled',
  p_team_goals smallint default null,
  p_opponent_goals smallint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match_id uuid;
begin
  if p_team_id is null
     or not public.pfms_has_legacy_team_permission(p_team_id, 'matches', 'edit') then
    raise exception 'Not authorized to create team matches' using errcode = '42501';
  end if;

  if p_opponent is null
     or pg_catalog.length(pg_catalog.btrim(p_opponent)) not between 1 and 140
     or p_home_away is null or p_home_away not in ('home','away')
     or p_match_date is null or p_kickoff is null
     or p_status is null or p_status not in ('scheduled','completed','postponed','cancelled')
     or (p_status = 'completed' and (p_team_goals is null or p_opponent_goals is null))
     or ((p_team_goals is null) <> (p_opponent_goals is null))
     or (p_team_goals is not null and (p_team_goals not between 0 and 30 or p_opponent_goals not between 0 and 30))
     or (p_competition is not null and pg_catalog.length(p_competition) > 140)
     or (p_venue is not null and pg_catalog.length(p_venue) > 180)
     or (p_match_notes is not null and pg_catalog.length(p_match_notes) > 6000) then
    raise exception 'Invalid team match data' using errcode = '22023';
  end if;

  insert into public.pfms_legacy_team_matches (
    team_id, opponent, competition, home_away, match_date, kickoff,
    venue, match_notes, status, team_goals, opponent_goals, created_by
  ) values (
    p_team_id, pg_catalog.btrim(p_opponent),
    nullif(pg_catalog.btrim(coalesce(p_competition,'')), ''),
    p_home_away, p_match_date, p_kickoff,
    nullif(pg_catalog.btrim(coalesce(p_venue,'')), ''),
    nullif(pg_catalog.btrim(coalesce(p_match_notes,'')), ''),
    p_status, p_team_goals, p_opponent_goals,
    auth.uid()
  )
  returning id into v_match_id;

  return v_match_id;
end;
$$;

create or replace function public.pfms_update_legacy_team_match(
  p_match_id uuid,
  p_opponent text,
  p_competition text,
  p_home_away text,
  p_match_date date,
  p_kickoff time,
  p_venue text,
  p_match_notes text,
  p_status text,
  p_team_goals smallint,
  p_opponent_goals smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  if p_match_id is null then
    raise exception 'Match is required' using errcode = '22023';
  end if;

  select team_id into v_team_id
  from public.pfms_legacy_team_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'matches', 'edit') then
    raise exception 'Not authorized to update team matches' using errcode = '42501';
  end if;

  if p_opponent is null
     or pg_catalog.length(pg_catalog.btrim(p_opponent)) not between 1 and 140
     or p_home_away is null or p_home_away not in ('home','away')
     or p_match_date is null or p_kickoff is null
     or p_status is null or p_status not in ('scheduled','completed','postponed','cancelled')
     or (p_status = 'completed' and (p_team_goals is null or p_opponent_goals is null))
     or ((p_team_goals is null) <> (p_opponent_goals is null))
     or (p_team_goals is not null and (p_team_goals not between 0 and 30 or p_opponent_goals not between 0 and 30))
     or (p_competition is not null and pg_catalog.length(p_competition) > 140)
     or (p_venue is not null and pg_catalog.length(p_venue) > 180)
     or (p_match_notes is not null and pg_catalog.length(p_match_notes) > 6000) then
    raise exception 'Invalid team match data' using errcode = '22023';
  end if;

  update public.pfms_legacy_team_matches
  set opponent = pg_catalog.btrim(p_opponent),
      competition = nullif(pg_catalog.btrim(coalesce(p_competition,'')), ''),
      home_away = p_home_away,
      match_date = p_match_date,
      kickoff = p_kickoff,
      venue = nullif(pg_catalog.btrim(coalesce(p_venue,'')), ''),
      match_notes = nullif(pg_catalog.btrim(coalesce(p_match_notes,'')), ''),
      status = p_status,
      team_goals = p_team_goals,
      opponent_goals = p_opponent_goals
  where id = p_match_id;
end;
$$;

create or replace function public.pfms_list_legacy_team_match_lineup(p_match_id uuid)
returns table (
  assignment_id uuid,
  player_id uuid,
  player_name text,
  player_surname text,
  jersey_number smallint,
  lineup_role text,
  position text,
  sort_order smallint,
  is_captain boolean
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
  from public.pfms_legacy_team_matches
  where id = p_match_id;
  if not found then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'matches', 'view') then
    raise exception 'Not authorized to view match lineup' using errcode = '42501';
  end if;

  return query
  select l.team_player_assignment_id, p.id, p.name, p.surname,
         tp.jersey_number, l.lineup_role, l.position, l.sort_order, l.is_captain
  from public.pfms_legacy_team_match_lineup l
  join public.pfms_legacy_team_players tp on tp.id = l.team_player_assignment_id
  join public.pfms_global_players p on p.id = tp.player_id
  where l.match_id = p_match_id
  order by l.sort_order, pg_catalog.lower(p.surname), pg_catalog.lower(p.name);
end;
$$;

create or replace function public.pfms_list_legacy_team_match_candidates(p_match_id uuid)
returns table (
  assignment_id uuid,
  player_id uuid,
  player_name text,
  player_surname text,
  jersey_number smallint,
  preferred_position text,
  squad_status text
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
  from public.pfms_legacy_team_matches
  where id = p_match_id;
  if not found then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'matches', 'view') then
    raise exception 'Not authorized to view matchday candidates' using errcode = '42501';
  end if;

  return query
  select tp.id, p.id, p.name, p.surname, tp.jersey_number,
         coalesce(tp.position_override, p.position), tp.squad_status
  from public.pfms_legacy_team_players tp
  join public.pfms_global_players p on p.id = tp.player_id
  where tp.team_id = v_team_id
    and tp.squad_status in ('active','injured','loaned')
  order by tp.jersey_number nulls last,
           pg_catalog.lower(p.surname), pg_catalog.lower(p.name);
end;
$$;

create or replace function public.pfms_save_legacy_team_match_lineup(
  p_match_id uuid,
  p_lineup jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_item jsonb;
  v_assignment_id uuid;
  v_role text;
  v_position text;
  v_sort_order integer;
  v_is_captain boolean;
  v_count integer;
  v_starters integer;
  v_captains integer;
begin
  select team_id into v_team_id
  from public.pfms_legacy_team_matches
  where id = p_match_id
  for update;
  if not found then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;
  if not public.pfms_has_legacy_team_permission(v_team_id, 'matches', 'edit') then
    raise exception 'Not authorized to edit match lineup' using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(p_lineup) is distinct from 'array' then
    raise exception 'Lineup must be a JSON array' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_array_length(p_lineup) > 30 then
    raise exception 'Lineup can contain at most 30 players' using errcode = '22023';
  end if;

  select pg_catalog.count(*),
         pg_catalog.count(*) filter (where value ->> 'lineup_role' = 'starter'),
         pg_catalog.count(*) filter (where coalesce((value ->> 'is_captain')::boolean, false))
  into v_count, v_starters, v_captains
  from pg_catalog.jsonb_array_elements(p_lineup);

  if v_count > 30 or v_starters > 11 or v_captains > 1 then
    raise exception 'Lineup can contain at most 30 players, 11 starters and one captain' using errcode = '22023';
  end if;

  if (
    select pg_catalog.count(distinct value ->> 'assignment_id')
    from pg_catalog.jsonb_array_elements(p_lineup)
  ) <> v_count then
    raise exception 'Duplicate player assignments are not allowed' using errcode = '22023';
  end if;

  for v_item in
    select value from pg_catalog.jsonb_array_elements(p_lineup)
  loop
    if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
       or pg_catalog.jsonb_typeof(v_item -> 'is_captain') is distinct from 'boolean'
       or (v_item ->> 'lineup_role') not in ('starter','bench')
       or (v_item ->> 'position') not in ('Torwart','Abwehr','Mittelfeld','Sturm')
       or nullif(v_item ->> 'sort_order','') is null
       or (v_item ->> 'sort_order') !~ '^[0-9]+$' then
      raise exception 'Invalid lineup entry' using errcode = '22023';
    end if;

    v_assignment_id := (v_item ->> 'assignment_id')::uuid;
    v_role := v_item ->> 'lineup_role';
    v_position := v_item ->> 'position';
    v_sort_order := (v_item ->> 'sort_order')::integer;
    v_is_captain := (v_item ->> 'is_captain')::boolean;

    if v_sort_order not between 1 and 30 then
      raise exception 'Invalid lineup order' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.pfms_legacy_team_players tp
      where tp.id = v_assignment_id
        and tp.team_id = v_team_id
        and tp.squad_status in ('active','injured','loaned')
    ) then
      raise exception 'Every lineup player must belong to the selected team' using errcode = '42501';
    end if;
  end loop;

  delete from public.pfms_legacy_team_match_lineup
  where match_id = p_match_id;

  for v_item in
    select value from pg_catalog.jsonb_array_elements(p_lineup)
  loop
    insert into public.pfms_legacy_team_match_lineup (
      match_id, team_player_assignment_id, lineup_role, position, sort_order, is_captain
    ) values (
      p_match_id,
      (v_item ->> 'assignment_id')::uuid,
      v_item ->> 'lineup_role',
      v_item ->> 'position',
      (v_item ->> 'sort_order')::smallint,
      (v_item ->> 'is_captain')::boolean
    );
  end loop;
end;
$$;

revoke all on function public.pfms_list_legacy_team_matches(uuid) from public, anon;
revoke all on function public.pfms_create_legacy_team_match(uuid,text,text,text,date,time,text,text,text,smallint,smallint) from public, anon;
revoke all on function public.pfms_update_legacy_team_match(uuid,text,text,text,date,time,text,text,text,smallint,smallint) from public, anon;
revoke all on function public.pfms_list_legacy_team_match_lineup(uuid) from public, anon;
revoke all on function public.pfms_list_legacy_team_match_candidates(uuid) from public, anon;
revoke all on function public.pfms_save_legacy_team_match_lineup(uuid,jsonb) from public, anon;

grant execute on function public.pfms_list_legacy_team_matches(uuid) to authenticated;
grant execute on function public.pfms_create_legacy_team_match(uuid,text,text,text,date,time,text,text,text,smallint,smallint) to authenticated;
grant execute on function public.pfms_update_legacy_team_match(uuid,text,text,text,date,time,text,text,text,smallint,smallint) to authenticated;
grant execute on function public.pfms_list_legacy_team_match_lineup(uuid) to authenticated;
grant execute on function public.pfms_list_legacy_team_match_candidates(uuid) to authenticated;
grant execute on function public.pfms_save_legacy_team_match_lineup(uuid,jsonb) to authenticated;

comment on table public.pfms_legacy_team_matches is
  'Team match fixtures and results; access is controlled by the matches module permission.';
comment on table public.pfms_legacy_team_match_lineup is
  'Match-specific lineup referencing the team roster. Each player must belong to the match team.';
