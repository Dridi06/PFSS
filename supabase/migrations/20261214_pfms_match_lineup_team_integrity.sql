-- Enforce that every match lineup row belongs to the same team as
-- both its match and its roster assignment, at database level.
-- Existing inconsistent rows abort the migration rather than being rewritten.

create unique index if not exists pfms_legacy_team_players_id_team_uidx
  on public.pfms_legacy_team_players (id, team_id);

alter table public.pfms_legacy_team_match_lineup
  add column if not exists team_id uuid;

do $$
begin
  if exists (
    select 1
    from public.pfms_legacy_team_match_lineup l
    join public.pfms_legacy_team_matches m on m.id = l.match_id
    join public.pfms_legacy_team_players tp
      on tp.id = l.team_player_assignment_id
    where m.team_id <> tp.team_id
  ) then
    raise exception 'Existing match lineup contains a player from another team; resolve the rows before applying this migration';
  end if;
end;
$$;

update public.pfms_legacy_team_match_lineup l
set team_id = m.team_id
from public.pfms_legacy_team_matches m
where m.id = l.match_id
  and l.team_id is null;

do $$
begin
  if exists (
    select 1
    from public.pfms_legacy_team_match_lineup
    where team_id is null
  ) then
    raise exception 'Could not determine team for every existing match lineup row';
  end if;
end;
$$;

alter table public.pfms_legacy_team_match_lineup
  alter column team_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.pfms_legacy_team_match_lineup'::regclass
      and conname = 'pfms_legacy_match_lineup_match_team_fk'
  ) then
    alter table public.pfms_legacy_team_match_lineup
      add constraint pfms_legacy_match_lineup_match_team_fk
      foreign key (match_id, team_id)
      references public.pfms_legacy_team_matches(id, team_id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.pfms_legacy_team_match_lineup'::regclass
      and conname = 'pfms_legacy_match_lineup_roster_team_fk'
  ) then
    alter table public.pfms_legacy_team_match_lineup
      add constraint pfms_legacy_match_lineup_roster_team_fk
      foreign key (team_player_assignment_id, team_id)
      references public.pfms_legacy_team_players(id, team_id)
      on delete restrict;
  end if;
end;
$$;

create or replace function public.pfms_set_legacy_match_lineup_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  select m.team_id into v_team_id
  from public.pfms_legacy_team_matches m
  where m.id = new.match_id
  for share;

  if not found then
    raise exception 'Match not found for lineup entry' using errcode = '23503';
  end if;

  if new.team_id is not null and new.team_id <> v_team_id then
    raise exception 'Lineup team must match the selected match team'
      using errcode = '23514';
  end if;

  new.team_id := v_team_id;
  return new;
end;
$$;

revoke all on function public.pfms_set_legacy_match_lineup_team()
  from public, anon, authenticated;

drop trigger if exists pfms_legacy_match_lineup_set_team
  on public.pfms_legacy_team_match_lineup;

create trigger pfms_legacy_match_lineup_set_team
before insert or update of match_id, team_id
on public.pfms_legacy_team_match_lineup
for each row
execute function public.pfms_set_legacy_match_lineup_team();

comment on column public.pfms_legacy_team_match_lineup.team_id is
  'Denormalized team scope, constrained to both the match and roster assignment by composite foreign keys.';
