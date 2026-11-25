# myScoutingDatabase — KI-Ausbau Checkpoint (25.11.2026)

## Scope and safety
- Product: myScoutingDatabase only.
- Dedicated Supabase staging project: vxtybjaabtfhxfwctnyj (Frankfurt).
- No production deployment or PFMS production changes were made.
- Source still resides in legacy repository Dridi06/PFSS, branch feature/asi-intelligence-platform. A dedicated repository and independent Render service remain release blockers.

## Six workstreams

1. **Video intelligence — provider adapter implemented, actual video inference not connected**
   - Added asi-core/video-detection.mjs.
   - Normalizes structured detections from an external computer-vision provider.
   - Rejects unknown event types, invalid player IDs, invalid timestamps, non-HTTPS source URLs, invalid normalized bounding boxes, and confidence below 0.70.
   - Added AI detection JSON import in the AI Lab.
   - Imported events are always pending and require human/admin verification.
   - Added provider/model/confidence/metadata provenance columns to asi_video_event_tags.
   - No raw video upload, decoding, tracking, or local computer-vision model is currently running. A provider/model and credentials are still needed.

2. **Verified training data**
   - Existing prediction outcome workflow keeps user-submitted outcomes pending until admin source verification.
   - Training reads only verified, dated outcome/prediction pairs.
   - Current staging counts at checkpoint: 0 prediction records, 0 verified outcomes, 0 video event tags. No model can be responsibly trained on current data.

3. **Machine-learning training**
   - Added asi-core/model-training.mjs with standardized ridge regression.
   - Minimum 50 verified complete pairs, minimum 30 training rows and 10 chronological holdout rows.
   - Requires at least three feature dimensions with >=80% coverage.
   - Training artifacts, model candidates, metrics and dataset fingerprints are stored using existing asi_training_runs, asi_model_versions and asi_model_evaluations tables.
   - A candidate must beat the baseline by at least 2% on the chronological holdout to pass the initial gate.
   - No trained model has yet been produced because the verified dataset is empty.

4. **Prediction validation**
   - Chronological train/holdout split and baseline comparison implemented.
   - MAE, RMSE, mean error, sample counts, date boundaries and dataset fingerprint retained.
   - Further cohort validation by position/age and external season holdout remains necessary before production use.

5. **Model governance**
   - Added asi_model_reviews audit table and SECURITY INVOKER RPC asi_review_model_candidate.
   - Only administrators can approve/reject candidates.
   - Approval requires a passing evaluation; prior active version is retired before candidate activation.
   - Added admin review controls in the AI Lab.
   - No automatic activation.

6. **Testing and deployment**
   - Added unit/contract tests for training, video detection and model lifecycle.
   - Added isolated myScoutingDatabase GitHub Actions workflow.
   - Existing repository CI run 45541255748 passed Edge Function type-checking but failed one video adapter test assertion; assertion was corrected in a later commit. A subsequent passing CI run has not yet been verified.
   - Browser E2E against a deployed preview is still outstanding.
   - No independent Render staging service exists; do not deploy to the legacy PFMS service.

## Database migrations applied to dedicated staging
- Audited model candidate approval and review audit.
- External video detection provenance fields and indexes.
- Model review foreign-key indexes.

## Remaining release blockers
- Select and configure a real video-computer-vision provider; secure its credentials server-side.
- Collect >=50 verified outcomes with complete features before training; more data is preferable for robust validation.
- Add age/position cohort validation and a second untouched season/competition holdout.
- Run the isolated CI workflow successfully and complete browser E2E tests.
- Move myScoutingDatabase to a dedicated repository and create a dedicated Render staging service.
- Keep PFMS/production isolated and untouched.
