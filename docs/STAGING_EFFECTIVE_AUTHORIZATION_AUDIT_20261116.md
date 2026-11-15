# PFMS Staging – Effective Authorization Audit (16.11.2026)

Target: Supabase project `oolvpbzbqiojioazsoun` (PFFS-Test, eu-west-1). Source: `supabase/STAGING_EFFECTIVE_AUTHORIZATION_AUDIT_READ_ONLY.sql` on branch `feature/pfss-complete-platform-build`, executed as a read-only catalog query.

## Inventory totals
- 15 public relations and 10 storage relations were included in the per-command RLS summary.
- 28 RLS policies were returned.
- 22 non-internal trigger definitions were returned.
- 27 public RPC/function entries were returned by the audit query; 26 are SECURITY DEFINER.
- Of the 26 SECURITY DEFINER functions, 23 are effectively executable by `authenticated`, one is effectively executable by `anon`, and one has a PUBLIC EXECUTE ACL. These are not automatically vulnerabilities: the authenticated functions must be checked for robust authorization in their bodies; the anonymous/PUBLIC exposure must be explained and constrained.
- The event-trigger function `public.rls_auto_enable()` is not represented as an ordinary RPC in the RPC inventory query. A separate direct privilege check showed effective EXECUTE=true for anon and authenticated; its actual direct-call behavior must be tested separately. The branch's `20261228_pfms_ddl_rls_fail_closed.sql` already contains a REVOKE for PUBLIC, anon and authenticated.

## RLS observations
- RLS is enabled on all 15 public relations. The RLS summary also includes 10 storage relations.
- Several public tables intentionally have no direct INSERT/UPDATE/DELETE policies. This is fail-closed for browser roles; mutations must use narrowly authorized RPCs.
- Public tables with no SELECT policy in a command summary are denied to roles subject to RLS. The audit query shows no SELECT-policy gaps on the core public tables in its result.
- RLS is not FORCE-enabled on the public relations. Table owner is postgres. Owner bypass is expected for privileged maintenance and SECURITY DEFINER code; browser-role access remains subject to RLS.
- Storage tables `storage.objects` and some metadata relations have explicit table grants; effective object-level policy conditions and bucket configuration still require a focused storage-path/tenant isolation test. Table grants alone do not prove a data leak because RLS and Storage API checks also apply.

## Key security interpretation
- A SECURITY DEFINER function being executable by an authenticated user is only safe when its body performs a server-side authorization check, validates all IDs/tenant relationships and uses a safe search_path or schema-qualified references.
- The audit is a catalog inventory, not a penetration test. It does not prove cross-tenant isolation or that a malicious caller cannot exploit a function's parameter handling.
- `rls_auto_enable()` is a PostgreSQL event-trigger function. Event-trigger dispatch does not require a browser client to invoke it as an ordinary RPC. Nevertheless, direct EXECUTE should be revoked; this exact hardening already exists in the branch migration but is not yet reflected in staging.
- Do not apply migrations or alter grants until the absent `supabase_migrations.schema_migrations` relation and existing schema provenance are reconciled. The database currently has 15 public tables and 26 public SECURITY DEFINER functions despite that missing ledger relation.

## Performance advisor
Supabase Advisor separately reports 16 unindexed foreign keys, 7 policies with repeated auth-function evaluation, 6 multiple-permissive-policy groups and 6 unused indexes. Prioritize the FK indexes and RLS initplan rewrites after query-plan review. Do not drop unused indexes until a representative workload has been observed.

## Verification status
- Read-only SQL only; no privileges, policies, tables, functions, triggers, or data were changed.
- No migration was applied.
- No production resource was queried or modified.
- Required next gates: two-tenant positive/negative tests, storage object isolation tests, function-by-function authorization review, and migration-history/schema reconciliation.
