-- Reduce overlapping permissive policies and index the new intelligence foreign keys.
drop policy if exists asi_candidate_evidence_admin_all on public.asi_candidate_evidence;
create policy asi_candidate_evidence_admin_update on public.asi_candidate_evidence for update to authenticated
 using((select private.is_admin())) with check((select private.is_admin()));

drop policy if exists asi_video_event_admin_all on public.asi_video_event_tags;
create policy asi_video_event_admin_update on public.asi_video_event_tags for update to authenticated
 using((select private.is_admin())) with check((select private.is_admin()));

drop policy if exists asi_scout_calibration_admin_all on public.asi_scout_calibration_records;
create policy asi_scout_calibration_admin_update on public.asi_scout_calibration_records for update to authenticated
 using((select private.is_admin())) with check((select private.is_admin()));

create index if not exists asi_candidate_evidence_created_by_idx on public.asi_candidate_evidence(created_by);
create index if not exists asi_candidate_evidence_owner_idx on public.asi_candidate_evidence(owner_id);
create index if not exists asi_candidate_evidence_reviewed_by_idx on public.asi_candidate_evidence(reviewed_by);
create index if not exists asi_candidate_evidence_reviews_evidence_idx on public.asi_candidate_evidence_reviews(evidence_id);
create index if not exists asi_candidate_evidence_reviews_reviewer_idx on public.asi_candidate_evidence_reviews(reviewer_id);
create index if not exists asi_prediction_outcomes_verified_by_idx on public.asi_prediction_outcomes(verified_by);
create index if not exists asi_prediction_outcome_reviews_outcome_idx on public.asi_prediction_outcome_reviews(outcome_id);
create index if not exists asi_prediction_outcome_reviews_reviewer_idx on public.asi_prediction_outcome_reviews(reviewer_id);
create index if not exists asi_video_event_created_by_idx on public.asi_video_event_tags(created_by);
create index if not exists asi_scout_calibration_player_idx on public.asi_scout_calibration_records(player_id);
create index if not exists asi_scout_calibration_created_by_idx on public.asi_scout_calibration_records(created_by);
create index if not exists asi_scout_calibration_verified_by_idx on public.asi_scout_calibration_records(verified_by);
create index if not exists asi_scout_calibration_audit_record_idx on public.asi_scout_calibration_audit(record_id);
create index if not exists asi_scout_calibration_audit_reviewer_idx on public.asi_scout_calibration_audit(reviewer_id);
