# PFMS – Staging Security and Performance Advisor Audit (16.11.2026)

## Scope and safety

- Target: dedicated Supabase staging project `oolvpbzbqiojioazsoun` (PFFS-Test, EU West).
- Read-only inspection only; no database DDL, grants, Auth settings, data, or production resources were changed.
- Repository branch: `feature/pfss-complete-platform-build`.
- This report records the effective staging findings at the time of inspection. It does not certify release readiness.

## Migration history

The Supabase migration-list API returned an empty migration collection. The previously observed `supabase_migrations.schema_migrations` relation is absent. Therefore the deployed schema has no verifiable migration provenance through the supported migration ledger. The 66 repository migration files and their 11 duplicate eight-digit version groups remain unresolved. No migration was applied, repaired, renamed, or marked as applied.

## Security Advisor

The staging Security Advisor returned three finding groups:

1. `anon_security_definer_function_executable`: one function, `public.rls_auto_enable()`, is directly callable by `anon` as SECURITY DEFINER.
2. `authenticated_security_definer_function_executable`: 23 SECURITY DEFINER functions are executable by `authenticated`. This is not automatically a vulnerability: each RPC must be checked for its authorization contract, argument validation, tenant scoping, search_path, and intended caller roles. Do not revoke all authenticated EXECUTE grants indiscriminately because that can break legitimate application workflows.
3. `auth_leaked_password_protection`: leaked-password protection is disabled in staging Auth settings.

The feature branch contains a forward migration `20261228_pfms_ddl_rls_fail_closed.sql` which fixes the event-trigger function's empty search_path, fail-closed behavior, and revokes direct EXECUTE from PUBLIC, anon, and authenticated. The branch also contains an effective SECURITY DEFINER ACL regression test. These repository safeguards are not evidence that the migration has been applied to staging; the empty ledger prevents that conclusion.

### Required remediation sequence

- Reconcile and verify the isolated test database's schema and migration history before applying the hardening migration.
- Re-run the effective grants and Security Advisor checks after migration application.
- Review each authenticated SECURITY DEFINER RPC individually; retain only intended authenticated entry points with explicit internal authorization.
- Enable leaked-password protection in the dedicated staging Auth configuration and verify the resulting setting. Do not change production Auth settings under this work authorization.

## Performance Advisor

Observed staging findings:

- 16 foreign keys without covering indexes.
- 7 RLS policies that may repeatedly evaluate auth/current_setting functions per row.
- 6 groups of multiple permissive policies for the same role/action.
- 6 indexes reported unused.

These are optimization candidates, not automatic fixes. Index additions need query/workload review and write-cost consideration. Unused indexes must not be dropped solely from a low-traffic staging sample. Policy consolidation must preserve the exact effective authorization truth table; a performance rewrite that widens tenant access is unacceptable.

## Release gate

Staging remains **not accepted**. The schema acceptance query previously returned 1 of 70 checks passing. Migration provenance, the 69 schema/security mismatches, tenant-isolation positive/negative runtime tests, Auth round-trip, module workflows, backup/restore drill, and responsive UI acceptance remain open.

No production resources, `main`, or live user data were changed.
