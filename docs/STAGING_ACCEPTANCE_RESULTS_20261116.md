# PFMS – Staging acceptance test results (16.11.2026)

## Test target and safety
- Supabase staging project: `oolvpbzbqiojioazsoun` (PFFS-Test, eu-west-1).
- Executed source: `supabase/STAGING_ACCEPTANCE_READ_ONLY.sql` from `feature/pfss-complete-platform-build`.
- The query is a single read-only statement. No migration, DDL, grant, policy, trigger, or data mutation was executed.
- Production project and production deployment were not accessed or modified.

## First test attempt – SQL parser defect
The first live execution failed with PostgreSQL error 42601 near `FROM`. Cause: schema-qualified `pg_catalog.substring(value FROM position)` uses special SQL syntax that does not parse in that qualified form. Corrected all four occurrences to `pg_catalog.substr(value, position)` in commit `bebec5618a332b8ca5122ac618ec8daa194aa501`.

A regression assertion was added to `tests/staging-acceptance-sql-contract-smoke.mjs` in commit `cc5658c8053289c09a557cf2acfd2e639f0a4467` to prevent reintroducing the parser defect.

## Second test attempt – actual staging compatibility result
- The corrected SQL executed successfully and returned all 70 named checks.
- **1 check passed; 69 checks failed.**
- The failed checks cover newer branch features and controls that are not present in the currently provisioned staging schema: admin pagination, current owner/membership protections, event-trigger hardening, global catalogue, notifications, media ownership/bucket, team-task and training modules, and other later security migrations.
- This result is evidence that staging is materially behind the feature branch; it is not evidence that 69 controls are broken in the branch source.
- It is also not safe to bring staging forward by blindly applying the 66 migration files: the repository's migration tests report 11 explicit version-collision groups (16 additional colliding files), and the staging migration ledger relation `supabase_migrations.schema_migrations` is absent. A reliable migration baseline and explicit collision resolution are mandatory before any application.

## Static CI result
At the preceding audited branch commit `8f2f4e5fd06d45bbda147159903e38e105f15955`, both push and PR GitHub Actions checks completed successfully. The test log confirms:
- Migration dependency graph: 66 SQL files, 30 reviewed dependency edges, no missing nodes, ordering violations or cycles.
- Migration ledger preflight regression cases passed.
- Migration collision guard passed, while explicitly preserving the staging reconciliation blocker.
- 70-check acceptance SQL contract passed as a static contract.
- DDL RLS fail-closed, organization owner integrity, team permissions, tenant-role isolation, auth/session lifecycle, frontend/RPC contract, tenant-write boundary, function grants, SECURITY DEFINER ACL, backup integrity and storage archive tests passed.
- Inventory reported 131 public SQL RPC/function names and 110 SECURITY DEFINER signatures in migration history.

The parser-fix and regression-test commits trigger a fresh CI run; final status must be read from the new run, not inferred from earlier successful runs.

## Current release blockers
1. Reconstruct the actual staging schema baseline and migration history without inventing applied versions.
2. Resolve the 11 documented migration version-collision groups and verify the dependency graph.
3. Reconcile the schema and migration ledger in an isolated staging clone before changing the shared staging database.
4. Re-run all 70 acceptance checks and perform two-tenant positive/negative authorization tests.
5. Only then plan a reviewed, staged migration sequence. No production migration or deployment without explicit approval.
