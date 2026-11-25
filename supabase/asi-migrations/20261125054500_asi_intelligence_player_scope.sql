-- Enforce player ownership across all intelligence writes (defense against guessed IDs / IDOR).
drop policy if exists asi_observations_insert on public.asi_player_observations;
create policy asi_observations_insert on public.asi_player_observations for insert to authenticated
 with check (
  created_by=(select auth.uid())
  and exists(select 1 from public.players p where p.player_id=asi_player_observations.player_id and p.owner_id=asi_player_observations.owner_id)
  and (
   (owner_id=(select auth.uid()) and (select private.is_approved_scout()))
   or (select private.is_admin())
  )
 );

drop policy if exists asi_analyses_insert on public.asi_player_analyses;
create policy asi_analyses_insert on public.asi_player_analyses for insert to authenticated
 with check (
  created_by=(select auth.uid())
  and exists(select 1 from public.players p where p.player_id=asi_player_analyses.player_id and p.owner_id=asi_player_analyses.owner_id)
  and (
   (owner_id=(select auth.uid()) and (select private.is_approved_scout()))
   or (select private.is_admin())
  )
 );

drop policy if exists asi_predictions_insert on public.asi_prediction_records;
create policy asi_predictions_insert on public.asi_prediction_records for insert to authenticated
 with check (
  created_by=(select auth.uid())
  and exists(select 1 from public.players p where p.player_id=asi_prediction_records.player_id and p.owner_id=asi_prediction_records.owner_id)
  and (
   (owner_id=(select auth.uid()) and (select private.is_approved_scout()))
   or (select private.is_admin())
  )
 );

drop policy if exists asi_outcomes_insert on public.asi_prediction_outcomes;
create policy asi_outcomes_insert on public.asi_prediction_outcomes for insert to authenticated
 with check (
  recorded_by=(select auth.uid())
  and exists(
   select 1 from public.asi_prediction_records p
   where p.id=asi_prediction_outcomes.prediction_id
    and p.player_id=asi_prediction_outcomes.player_id
    and p.owner_id=asi_prediction_outcomes.owner_id
  )
  and (
   (owner_id=(select auth.uid()) and (select private.is_approved_scout()))
   or (select private.is_admin())
  )
 );

drop policy if exists asi_video_event_owner_insert_pending on public.asi_video_event_tags;
create policy asi_video_event_owner_insert_pending on public.asi_video_event_tags for insert to authenticated
 with check (
  created_by=(select auth.uid())
  and verification_status='pending'
  and exists(select 1 from public.players p where p.player_id=asi_video_event_tags.player_id and p.owner_id=asi_video_event_tags.owner_id)
  and (
   (owner_id=(select auth.uid()) and (select private.is_approved_scout()))
   or (select private.is_admin())
  )
 );

drop policy if exists asi_scout_calibration_owner_insert_pending on public.asi_scout_calibration_records;
create policy asi_scout_calibration_owner_insert_pending on public.asi_scout_calibration_records for insert to authenticated
 with check (
  created_by=(select auth.uid())
  and scout_id=(select auth.uid())
  and verification_status='pending'
  and verified_outcome is null and verified_by is null and verified_at is null
  and exists(select 1 from public.players p where p.player_id=asi_scout_calibration_records.player_id and p.owner_id=asi_scout_calibration_records.owner_id)
  and (
   (owner_id=(select auth.uid()) and (select private.is_approved_scout()))
   or (select private.is_admin())
  )
 );
