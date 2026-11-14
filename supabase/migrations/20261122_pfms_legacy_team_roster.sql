-- PFMS team roster linked to the global player catalogue.
-- A team membership is a separate record: removing a player from a squad never
-- deletes or edits the global player profile.

create table if not exists public.pfms_legacy_team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.pfms_legacy_teams(id) on delete cascade,
  player_id uuid not null references public.pfms_global_players(id) on delete restrict,
  jersey_number smallint,
  position_override text,
  squad_status text not null default 'active'
    check (squad_status in ('active','injured','loaned','inactive')),
  joined_on date not null default current_date,
  notes text,
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pfms_legacy_team_players_jersey_check
    check (jersey_number is null or jersey_number between 1 and 99),
  constraint pfms_legacy_team_players_position_check
    check (position_override is null or position_override in ('Torwart','Abwehr','Mittelfeld','Sturm')),
  constraint pfms_legacy_team_players_notes_check
    check (notes is null or length(notes) <= 1000),
  unique (team_id, player_id)
);

create unique index if not exists pfms_legacy_team_players_jersey_uidx
  on public.pfms_legacy_team_players(team_id, jersey_number)
  where jersey_number is not null;

create index if not exists pfms_legacy_team_players_team_status_idx
  on public.pfms_legacy_team_players(team_id, squad_status, jersey_number);

create or replace function public.pfms_touch_legacy_team_player()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.pfms_touch_legacy_team_player() from public, anon, authenticated;

drop trigger if exists pfms_legacy_team_players_touch_updated_at on public.pfms_legacy_team_players;
create trigger pfms_legacy_team_players_touch_updated_at
before update on public.pfms_legacy_team_players
for each row execute function public.pfms_touch_legacy_team_player();

alter table public.pfms_legacy_team_players enable row level security;
alter table public.pfms_legacy_team_players force row level security;

drop policy if exists pfms_legacy_team_players_select on public.pfms_legacy_team_players;
create policy pfms_legacy_team_players_select
on public.pfms_legacy_team_players
for select to authenticated
using (public.pfms_can_access_legacy_team(team_id));

revoke all on table public.pfms_legacy_team_players from public, anon, authenticated;
grant select on table public.pfms_legacy_team_players to authenticated;

create or replace function public.pfms_list_legacy_team_players(p_team_id uuid)
returns table (
  assignment_id uuid,
  player_id uuid,
  player_name text,
  player_surname text,
  birth date,
  nationality text,
  club text,
  preferred_position text,
  position_override text,
  squad_position text,
  foot text,
  height integer,
  jersey_number smallint,
  squad_status text,
  joined_on date,
  notes text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.pfms_can_access_legacy_team(p_team_id) then
    raise exception 'Not authorized to view this team roster' using errcode = '42501';
  end if;

  return query
  select
    tp.id,
    p.id,
    p.name,
    p.surname,
    p.birth,
    p.nationality,
    p.club,
    p.position,
    tp.position_override,
    coalesce(tp.position_override, p.position),
    p.foot,
    p.height,
    tp.jersey_number,
    tp.squad_status,
    tp.joined_on,
    tp.notes
  from public.pfms_legacy_team_players tp
  join public.pfms_global_players p on p.id = tp.player_id
  where tp.team_id = p_team_id
  order by tp.jersey_number nulls last, pg_catalog.lower(p.surname), pg_catalog.lower(p.name);
end;
$$;

create or replace function public.pfms_search_global_players_for_team(
  p_team_id uuid,
  p_query text default ''
)
returns table (
  player_id uuid,
  player_name text,
  player_surname text,
  birth date,
  nationality text,
  club text,
  position text,
  foot text,
  height integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := pg_catalog.btrim(coalesce(p_query, ''));
begin
  if not public.pfms_can_manage_legacy_team(p_team_id) then
    raise exception 'Not authorized to search players for this team' using errcode = '42501';
  end if;

  return query
  select p.id, p.name, p.surname, p.birth, p.nationality, p.club, p.position, p.foot, p.height
  from public.pfms_global_players p
  where (
    v_query = ''
    or p.name ilike '%' || v_query || '%'
    or coalesce(p.surname, '') ilike '%' || v_query || '%'
    or coalesce(p.club, '') ilike '%' || v_query || '%'
  )
  and not exists (
    select 1
    from public.pfms_legacy_team_players existing
    where existing.team_id = p_team_id
      and existing.player_id = p.id
  )
  order by pg_catalog.lower(coalesce(p.surname, p.name)), pg_catalog.lower(p.name)
  limit 50;
end;
$$;

create or replace function public.pfms_add_legacy_team_player(
  p_team_id uuid,
  p_player_id uuid,
  p_jersey_number smallint default null,
  p_position_override text default null,
  p_squad_status text default 'active',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment_id uuid;
begin
  if not public.pfms_can_manage_legacy_team(p_team_id) then
    raise exception 'Not authorized to manage this team roster' using errcode = '42501';
  end if;

  if p_jersey_number is not null and p_jersey_number not between 1 and 99 then
    raise exception 'Jersey number must be between 1 and 99' using errcode = '22023';
  end if;
  if p_position_override is not null and p_position_override not in ('Torwart','Abwehr','Mittelfeld','Sturm') then
    raise exception 'Invalid squad position' using errcode = '22023';
  end if;
  if p_squad_status not in ('active','injured','loaned','inactive') then
    raise exception 'Invalid squad status' using errcode = '22023';
  end if;
  if p_notes is not null and length(p_notes) > 1000 then
    raise exception 'Notes are too long' using errcode = '22023';
  end if;

  if not exists (select 1 from public.pfms_global_players where id = p_player_id) then
    raise exception 'Global player not found' using errcode = 'P0002';
  end if;

  insert into public.pfms_legacy_team_players (
    team_id, player_id, jersey_number, position_override, squad_status,
    notes, created_by
  )
  values (
    p_team_id, p_player_id, p_jersey_number, p_position_override, p_squad_status,
    nullif(pg_catalog.btrim(coalesce(p_notes,'')),''), auth.uid()
  )
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

create or replace function public.pfms_update_legacy_team_player(
  p_assignment_id uuid,
  p_jersey_number smallint,
  p_position_override text,
  p_squad_status text,
  p_notes text
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
  from public.pfms_legacy_team_players
  where id = p_assignment_id
  for update;

  if not found then
    raise exception 'Team player assignment not found' using errcode = 'P0002';
  end if;
  if not public.pfms_can_manage_legacy_team(v_team_id) then
    raise exception 'Not authorized to update this team roster' using errcode = '42501';
  end if;
  if p_jersey_number is not null and p_jersey_number not between 1 and 99 then
    raise exception 'Jersey number must be between 1 and 99' using errcode = '22023';
  end if;
  if p_position_override is not null and p_position_override not in ('Torwart','Abwehr','Mittelfeld','Sturm') then
    raise exception 'Invalid squad position' using errcode = '22023';
  end if;
  if p_squad_status not in ('active','injured','loaned','inactive') then
    raise exception 'Invalid squad status' using errcode = '22023';
  end if;
  if p_notes is not null and length(p_notes) > 1000 then
    raise exception 'Notes are too long' using errcode = '22023';
  end if;

  update public.pfms_legacy_team_players
  set jersey_number = p_jersey_number,
      position_override = p_position_override,
      squad_status = p_squad_status,
      notes = nullif(pg_catalog.btrim(coalesce(p_notes,'')),'')
  where id = p_assignment_id;
end;
$$;

create or replace function public.pfms_remove_legacy_team_player(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  select team_id into v_team_id
  from public.pfms_legacy_team_players
  where id = p_assignment_id
  for update;

  if not found then
    return;
  end if;
  if not public.pfms_can_manage_legacy_team(v_team_id) then
    raise exception 'Not authorized to remove this player from the team' using errcode = '42501';
  end if;

  delete from public.pfms_legacy_team_players where id = p_assignment_id;
end;
$$;

revoke all on function public.pfms_list_legacy_team_players(uuid) from public, anon;
revoke all on function public.pfms_search_global_players_for_team(uuid,text) from public, anon;
revoke all on function public.pfms_add_legacy_team_player(uuid,uuid,smallint,text,text,text) from public, anon;
revoke all on function public.pfms_update_legacy_team_player(uuid,smallint,text,text,text) from public, anon;
revoke all on function public.pfms_remove_legacy_team_player(uuid) from public, anon;

grant execute on function public.pfms_list_legacy_team_players(uuid) to authenticated;
grant execute on function public.pfms_search_global_players_for_team(uuid,text) to authenticated;
grant execute on function public.pfms_add_legacy_team_player(uuid,uuid,smallint,text,text,text) to authenticated;
grant execute on function public.pfms_update_legacy_team_player(uuid,smallint,text,text,text) to authenticated;
grant execute on function public.pfms_remove_legacy_team_player(uuid) to authenticated;

comment on table public.pfms_legacy_team_players is
  'Team-specific roster entries linked to shared PFMS global players. Removing a roster entry never deletes the shared player.';
