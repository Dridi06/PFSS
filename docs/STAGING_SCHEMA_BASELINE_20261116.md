# PFMS – Read-only staging schema baseline (16.11.2026)

Target: Supabase staging project `oolvpbzbqiojioazsoun` (PFFS-Test), PostgreSQL 17.11.
Query: `supabase/STAGING_SCHEMA_BASELINE_READ_ONLY.sql` on `feature/pfss-complete-platform-build`.
Execution identity: `postgres`. Query is read-only and reads PostgreSQL catalogs and information_schema only.

## Inventory result
- 787 catalog rows returned.
- 15 public relations; 10 public tables plus views/other relations are not inferred from the count alone.
- 25 relations across public and storage schemas.
- 222 columns, 106 constraints, 62 indexes, 28 RLS policies, 22 non-internal triggers, 31 functions/procedures and 290 table privilege grant rows.
- Public relations:
  `pfms_memberships`, `pfms_organizations`, `pfms_scout_profiles`, `pfss_audit_log`, `pfss_calendar_events`, `pfss_invitations`, `pfss_media`, `pfss_memberships`, `pfss_organizations`, `pfss_platform_roles`, `pfss_players`, `pfss_scouting_reports`, `pfss_tasks`, `pfss_teams`, `profiles`.
- Storage relations include buckets, objects, migrations and S3 multipart/lifecycle/vector metadata.
- `to_regclass('supabase_migrations.schema_migrations')` returns NULL. The migration ledger remains absent.

## Cross-check against branch acceptance contract
The corrected 70-check acceptance query executes successfully. It returned 1 pass and 69 fails against the current shared staging schema. This matches the gap between the older live schema inventory and later branch migrations, including missing global catalogue, notifications, team tasks, main scouting reports/media and other newer modules/security controls. Do not interpret this as 69 source-code tests failing; these are live database schema/policy assertions.

## Migration safety
- Repository contains 66 SQL migration files, with 11 documented version-prefix collision groups (16 additional colliding files).
- Dependency graph and collision regression tests pass, but that does not establish which migrations were applied to the live database.
- Do not apply migrations, rename migration files, or fabricate migration history until the true schema provenance and migration ledger are reconciled.
- Use a disposable staging clone to validate a baseline and ordered migration plan before modifying shared staging.

## Environment boundary
- Render service is `pfss-staging`, static site, branch `feature/pfss-complete-platform-build`, manual deploy only (Auto Deploy OFF).
- Current live staging deploy is older than the latest branch commits.
- Service IP allowlist currently includes `0.0.0.0/0`; staging is publicly reachable. Do not place production data or production secrets in staging.
- Production resources were not queried or modified.
