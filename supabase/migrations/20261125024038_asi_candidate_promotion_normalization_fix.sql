-- Correct whitespace normalization in the candidate duplicate key.
create or replace function public.asi_promote_player_candidate(p_candidate_id uuid)
returns bigint
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_candidate public.asi_player_candidates%rowtype;
  v_player_id bigint;
  v_allowed_positions text[] := array[
    'Torwart','AV links','AV rechts','IV links','IV rechts','6er','8er','10er',
    'Flügel links','Flügel rechts','9er','AV re/li','IV re/li','Flügel re/li'
  ];
  v_conflicts jsonb;
  v_source_count integer := 0;
  v_normalized_name text;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not (private.is_admin() or private.is_approved_scout()) then
    raise exception 'approved_scout_or_admin_required' using errcode = '42501';
  end if;

  select * into v_candidate
    from public.asi_player_candidates
   where id = p_candidate_id
     and (owner_id = v_actor or private.is_admin())
   for update;
  if not found then
    raise exception 'asi_candidate_not_found_or_not_accessible' using errcode = 'P0002';
  end if;
  if v_candidate.status <> 'saved' then
    raise exception 'asi_candidate_already_processed' using errcode = '22023';
  end if;
  if length(trim(v_candidate.player_name)) = 0 then
    raise exception 'asi_candidate_name_required' using errcode = '22023';
  end if;
  if v_candidate.birth_year is not null
     and (v_candidate.birth_year < 1900 or v_candidate.birth_year > extract(year from current_date)::integer) then
    raise exception 'asi_candidate_birth_year_invalid' using errcode = '22023';
  end if;
  if cardinality(v_candidate.positions) = 0
     or not (v_candidate.positions <@ v_allowed_positions) then
    raise exception 'asi_candidate_positions_invalid_or_missing' using errcode = '22023';
  end if;
  if coalesce(v_candidate.identity_confidence, 0) < 0.75 then
    raise exception 'asi_identity_confidence_below_promotion_threshold' using errcode = '22023';
  end if;

  if jsonb_typeof(v_candidate.sources) = 'array' then
    v_source_count := jsonb_array_length(v_candidate.sources);
  elsif jsonb_typeof(v_candidate.sources) = 'object' then
    v_source_count := (select count(*) from jsonb_object_keys(v_candidate.sources));
  end if;
  if v_source_count = 0 then
    raise exception 'asi_candidate_has_no_recorded_sources' using errcode = '22023';
  end if;

  v_conflicts := v_candidate.analysis -> 'blocking_conflicts';
  if jsonb_typeof(v_conflicts) = 'array' and jsonb_array_length(v_conflicts) > 0 then
    raise exception 'asi_candidate_has_unresolved_blocking_conflicts' using errcode = '22023';
  end if;
  if jsonb_typeof(v_conflicts) = 'number' and (v_conflicts #>> '{}')::numeric > 0 then
    raise exception 'asi_candidate_has_unresolved_blocking_conflicts' using errcode = '22023';
  end if;

  v_normalized_name := lower(regexp_replace(trim(v_candidate.player_name), '[[:space:]]+', ' ', 'g'));
  perform pg_advisory_xact_lock(hashtext(
    v_candidate.owner_id::text || ':' || v_normalized_name || ':' ||
    coalesce(v_candidate.birth_year::text, 'unknown')
  )::bigint);

  if exists (
    select 1 from public.players p
     where p.owner_id = v_candidate.owner_id
       and lower(regexp_replace(trim(p.name), '[[:space:]]+', ' ', 'g')) = v_normalized_name
       and coalesce(p.year, '') = coalesce(v_candidate.birth_year::text, '')
  ) then
    raise exception 'asi_candidate_duplicate_player_exists' using errcode = '23505';
  end if;

  insert into public.players (
    owner_id, name, year, club, positions, ratings, notes, observed_on, documented_by
  )
  values (
    v_candidate.owner_id,
    trim(v_candidate.player_name),
    v_candidate.birth_year::text,
    nullif(trim(coalesce(v_candidate.current_club, '')), ''),
    v_candidate.positions,
    case when jsonb_typeof(v_candidate.analysis -> 'ratings') = 'object'
      then v_candidate.analysis -> 'ratings' else '{}'::jsonb end,
    concat_ws(E'\n',
      'ASI-Übernahme · Kandidat ' || v_candidate.id::text,
      nullif(trim(coalesce(v_candidate.analysis ->> 'summary', '')), ''),
      nullif(trim(coalesce(v_candidate.search_query, '')), '')
    ),
    current_date,
    'ASI'
  )
  returning player_id into v_player_id;

  insert into public.asi_player_analyses (
    player_id, owner_id, created_by, analysis_type, model_version, analysis_json, input_snapshot
  )
  values (
    v_player_id, v_candidate.owner_id, v_actor, 'candidate_promotion', 'asi-promotion-v1',
    jsonb_build_object(
      'candidate_id', v_candidate.id,
      'promoted_player_id', v_player_id,
      'promoted_at', now(),
      'promoted_by', v_actor,
      'source_count', v_source_count,
      'analysis', v_candidate.analysis,
      'sources', v_candidate.sources
    ),
    to_jsonb(v_candidate)
  );

  update public.asi_player_candidates
     set status = 'promoted', updated_at = now()
   where id = v_candidate.id;

  return v_player_id;
end;
$$;

revoke all on function public.asi_promote_player_candidate(uuid) from public;
grant execute on function public.asi_promote_player_candidate(uuid) to authenticated;
