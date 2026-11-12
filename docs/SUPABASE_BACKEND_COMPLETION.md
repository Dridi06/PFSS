# PFSS – Supabase Backend Completion Package

Stand: 13.11.2026  
Branch: `foundation/permissions-v1`

## Purpose

This package prepares the remaining Supabase work without changing the live database. It distinguishes repository code from changes that still require a separate test project and verified schema information.

**Production is not part of this procedure.** Do not run these migrations in the production Supabase project.

## Source files in this package

| File | Purpose | Changes data/schema? |
|---|---|---:|
| `supabase/preflight/00_schema_security_inventory.sql` | Existing complete first schema/security inventory | No |
| `supabase/preflight/01_pfss_backend_gap_assessment.sql` | Additional inventory of identity models, RPCs, triggers, grants, enums and Storage policies | No |
| `supabase/migrations/20261112_private_scout_workspaces.sql` | Private standalone scout players, reports, media metadata and private bucket | Yes |
| `supabase/migrations/20261113_pfss_private_scout_integrity.sql` | Composite owner/player foreign keys, owner-path check and updated_at triggers | Yes |
| `supabase/migrations/20261112_username_login_rate_limits.sql` | Atomic distributed username-login rate limits | Yes |
| `supabase/migrations/20261112_pfss_tenant_integrity_hardening.sql` | Tenant-scoped composite foreign keys for club/agency domain tables | Yes |
| `supabase/tests/00_pfss_backend_release_gate.sql` | Read-only metadata release gate | No |

## What is already prepared in the branch

1. Username login Edge Function hardening: POST/JSON/body-size checks, exact origin allowlist, HMAC-keyed distributed limits, generic errors and no-store responses.
2. R2 diagnostic Edge Function: JWT validation, explicit admin-user allowlist, POST-only and origin checks.
3. Private solo-scout tables and a private Storage bucket with owner-folder policies.
4. Tenant-integrity migration for the club/agency domain tables.
5. Read-only metadata inventory and static repository checks.

Prepared does not mean deployed or tested against Supabase. The Edge Functions have not been deployed by this package. The SQL migrations must first be tested on an isolated Supabase development project.

## Mandatory order on a separate Supabase development project

1. Run `supabase/preflight/00_schema_security_inventory.sql`.
2. Run `supabase/preflight/01_pfss_backend_gap_assessment.sql`.
3. Export the result sets, especially columns, constraints, RLS policies, function signatures, function definitions, grants and enum values. These are schema metadata, not user-row exports.
4. Compare the results with the prepared migrations. Stop if table names, columns, foreign keys or existing policies differ.
5. Apply `20261112_private_scout_workspaces.sql`, then `20261113_pfss_private_scout_integrity.sql` to the test project only.
6. Apply `20261112_username_login_rate_limits.sql` to the test project and verify RPC permissions and concurrent behavior.
7. Run `supabase/tests/00_pfss_backend_release_gate.sql`; resolve every FAIL and investigate every WARN.
8. Run two-user positive and negative tests for read, insert, update, delete, Storage upload/download/delete, manipulated IDs and cross-tenant references. A metadata PASS does not prove row isolation.
9. Only after successful tests, prepare a separate migration and explicit release review for any production change.

## Why the final RBAC migration is not fabricated yet

The current frontend still calls legacy functions such as `pfss_admin_list_profiles`, `pfms_create_legacy_invitation`, `pfms_admin_update_legacy_membership` and `pfms_admin_list_legacy_org_members`. The repository also contains references to both generic organization tables (`organizations`, `organization_memberships`) and PFMS organization tables (`pfms_organizations`, `pfms_memberships`).

The exact live column definitions, existing function signatures, grants, trigger side-effects and policy predicates have not been verified. Creating a second role/membership model or guessing these structures could split permissions, break invitations or accidentally widen access. The final RBAC/invitation migration must therefore be generated against the exported preflight results, with one canonical organization source and a documented role-to-permission matrix.

## Remaining Supabase work after the inventory

- Canonical organization and membership model; safe reconciliation of the generic and PFMS models.
- Server-side role/permission matrix and RLS for every tenant table.
- Invitation lifecycle: one-time token hashing, expiry, revocation, replay protection and role-limited issuance/acceptance.
- Security-definer RPC audit: fixed search_path, minimal grants and authorization inside every privileged function.
- Audit event coverage, tamper resistance, access policy and retention.
- Storage lifecycle, file-content validation and download authorization.
- Minor-player data access, consent/retention/deletion workflow, requiring a privacy/legal review.
- Finance tables and posting controls only after the finance data model and approval workflow are designed. The existing finance UI is a preview, not a database-backed accounting system.
- Auth runtime configuration, Edge Function secrets, deployment and end-to-end tests.
- Backup/restore verification, including Storage objects (not just PostgreSQL rows).

## Required safety boundary

- Never paste service-role keys, secret keys, passwords, access/refresh tokens or real player/financial records into chat or GitHub.
- Do not run the read/write migrations against production as part of this task.
- Do not copy real minors' records into a test project.
- Do not treat a static validator, a release-gate query or a green CI job as a penetration test or compliance certification.
