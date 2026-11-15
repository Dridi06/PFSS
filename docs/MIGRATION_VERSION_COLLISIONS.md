# PFMS migration version collision baseline

This file records the exact duplicate eight-digit version prefixes already present in the feature branch. Supabase migration history identifies migrations by their version prefix; multiple files with the same prefix are therefore a release blocker until the actual target project's history and schema are reconciled.

The baseline is a guardrail, not a fix. CI permits only the exact reviewed collision inventory and fails if a new collision appears, an existing collision disappears, or any filename in a collision group changes without an explicit review.

## Required resolution process

1. Confirm the dedicated STAGING Supabase project ref and connection target independently.
2. Capture the unmodified `supabase migration list` output for that project.
3. Export and back up the staging schema before any proposed reconciliation.
4. Compare each colliding migration's SQL and dependencies with the actual remote schema and migration ledger.
5. Produce a reviewed per-file decision: already represented remotely, safely pending, or needs a new forward-only migration.
6. Do not rename historical files, run migration repair, or use `--include-all` until the plan is approved and backed up.
7. Update this baseline only as part of the reviewed reconciliation, preserving the audit trail.

No database was queried or changed to create this baseline. The known collisions remain unresolved.
