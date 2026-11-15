# PFMS – Effective Authorization Audit

## Purpose

`supabase/STAGING_EFFECTIVE_AUTHORIZATION_AUDIT_READ_ONLY.sql` complements the broader staging inventory. It reports the effective PostgreSQL catalog state for row-level security policies, triggers, public RPCs and table privileges.

The query is read-only. It does not apply migrations, modify records, change grants, or create database objects.

## Execution

1. Confirm the Supabase project selector identifies the isolated PFMS STAGING project, never production.
2. Apply only the reviewed feature-branch migrations to staging using the documented migration procedure.
3. Run the SQL file in the Supabase SQL Editor.
4. Export/save the complete result with the staging project reference, execution timestamp and feature commit SHA.
5. Review every row; a successful query is an inventory result, not an automatic security pass.

## Interpretation

- RLS must be enabled on every tenant-owned relation. `FORCE ROW LEVEL SECURITY` is a separate control and must be reviewed against table ownership and trusted service-role access.
- PostgreSQL combines applicable permissive policies with OR and restrictive policies with AND. At least one applicable permissive policy must allow a row; restrictive policies can further narrow that result. Review command, role, USING and WITH CHECK independently.
- RLS enabled with no applicable policy denies rows to roles subject to RLS. Superusers and roles with BYPASSRLS remain privileged; table owners normally bypass RLS unless FORCE RLS applies.
- Trigger rows expose enabled state, trigger definition, trigger function, SECURITY DEFINER flag and function configuration. Review disabled triggers, ordering for triggers sharing timing/event, empty or unsafe search paths, and whether trigger functions are unnecessarily callable directly.
- RPC rows include all functions in `public`, not just PFMS-prefixed functions. Effective EXECUTE for `anon` and `authenticated` includes inherited PUBLIC grants. Review SECURITY DEFINER functions for an empty/fixed search_path, explicit authorization checks, safe object qualification and least-privilege EXECUTE.
- Table ACL rows report effective privileges for browser roles. RLS does not replace table/column grants; both layers must be correct.

## Limitations

This catalog report does not prove application-level business correctness, enumerate every dynamic SQL dependency, determine whether an RPC is still called by the frontend, or simulate cross-tenant attacks. Those require source-level dependency analysis and authenticated positive/negative integration tests. It also does not replace the existing `STAGING_READ_ONLY_AUDIT.sql`, `STAGING_ACCEPTANCE_READ_ONLY.sql`, backup/restore validation or formal release approval.

## Release gate

Do not merge or deploy based only on a clean static test or successful SQL execution. Resolve every unexpected policy/grant/trigger/RPC result, run tenant-isolation tests using distinct staging identities, verify the migration ledger and schema, and record an explicit staging acceptance decision.
