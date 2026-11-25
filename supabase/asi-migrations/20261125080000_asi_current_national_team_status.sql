alter table public.players
  add column if not exists is_current_national_player boolean not null default false,
  add column if not exists national_team_level text,
  add column if not exists national_team_country text;
alter table public.asi_player_candidates
  add column if not exists is_current_national_player boolean not null default false,
  add column if not exists national_team_level text,
  add column if not exists national_team_country text;
alter table public.players drop constraint if exists players_national_team_level_check;
alter table public.players add constraint players_national_team_level_check
  check (national_team_level is null or national_team_level in ('U15','U16','U17','U18','U19','U20','U21','A'));
alter table public.players drop constraint if exists players_national_team_consistency_check;
alter table public.players add constraint players_national_team_consistency_check
  check ((is_current_national_player and national_team_level is not null and nullif(trim(national_team_country),'') is not null)
      or (not is_current_national_player and national_team_level is null and national_team_country is null));
alter table public.asi_player_candidates drop constraint if exists asi_player_candidates_national_team_level_check;
alter table public.asi_player_candidates add constraint asi_player_candidates_national_team_level_check
  check (national_team_level is null or national_team_level in ('U15','U16','U17','U18','U19','U20','U21','A'));
alter table public.asi_player_candidates drop constraint if exists asi_player_candidates_national_team_consistency_check;
alter table public.asi_player_candidates add constraint asi_player_candidates_national_team_consistency_check
  check ((is_current_national_player and national_team_level is not null and nullif(trim(national_team_country),'') is not null)
      or (not is_current_national_player and national_team_level is null and national_team_country is null));
do $migration$
declare v_definition text;
begin
  select pg_get_functiondef('public.asi_promote_player_candidate(uuid)'::regprocedure) into v_definition;
  v_definition := replace(v_definition,
    'owner_id, name, year, club, positions, ratings, notes, observed_on, documented_by',
    'owner_id, name, year, club, positions, ratings, notes, observed_on, documented_by, is_current_national_player, national_team_level, national_team_country');
  v_definition := replace(v_definition,
    E'    current_date,\n    ''ASI''\n  )',
    E'    current_date,\n    ''ASI'',\n    coalesce(v_candidate.is_current_national_player,false),\n    case when coalesce(v_candidate.is_current_national_player,false) then v_candidate.national_team_level else null end,\n    case when coalesce(v_candidate.is_current_national_player,false) then v_candidate.national_team_country else null end\n  )');
  if position('v_candidate.national_team_level' in v_definition)=0 then
    raise exception 'Could not safely extend candidate promotion function';
  end if;
  execute v_definition;
end;
$migration$;