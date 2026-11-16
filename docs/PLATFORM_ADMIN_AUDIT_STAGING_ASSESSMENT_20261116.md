# PFMS platform administrator audit – staging assessment

Date: 2026-11-16
Scope: staging project `oolvpbzbqiojioazsoun`, branch `feature/pfss-complete-platform-build`

## Verified current state

- The deployed database function `public.pfss_admin_update_profile(uuid,text,text)` is SECURITY DEFINER and checks `public.pfss_is_platform_admin()`.
- It validates the requested role and status, prevents self-modification, updates `public.profiles`, and raises when the target profile does not exist.
- The function currently does **not** insert an audit record.
- The staging database has `public.pfss_audit_log` with columns `organization_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata`, and `created_at`. Existing organization-management routines use it with a real organization scope.
- The staging database has no dedicated platform-admin audit table and no matching platform audit read/write RPC. The public table inventory and function inventory were queried read-only.
- The existing `pfss_audit_log` must not be repurposed for platform-wide events by writing a NULL organization id. Its data model and existing authorization semantics are organization-scoped.
- Existing system-activity UI code calls `pfms_admin_list_system_events_page`, but that RPC is not present in the inspected staging database function inventory. The UI must not be represented as a working platform audit history until its backing store and RPC are installed.

## Release gate

Do not add, rename, repair, or apply SQL migrations until the dedicated STAGING migration ledger has been reconciled. The current build's migration collision guard explicitly records this as a release blocker. Production must remain untouched.

## Required design for the next safe database change

Create a separate platform-scoped audit stream, for example:

- Table: `public.pfms_platform_audit_log`
- Immutable event rows with identity, actor user id, target user id, action key, before/after JSON snapshots limited to role and status, timestamp, and request/correlation id where available.
- No organization id is required because this is a platform-level event.
- RLS enabled and direct browser INSERT/UPDATE/DELETE denied. No client-supplied actor id.
- Only a SECURITY DEFINER write path may append events, deriving the actor from `auth.uid()` and checking the canonical platform-admin predicate.
- The profile update and audit insert must execute in the same database transaction. If the audit insert fails, the profile change must roll back.
- The write function must lock/read the target profile, capture the actual old values, validate target role/status, reject self-change, update only when values differ, and append an event containing actual before/after values.
- A separate paginated read RPC must require platform-admin authorization, return only the fields needed by the UI, use a bounded page size, and support target/action/date filters.
- Effective grants must be audited: revoke PUBLIC/anon; grant only authenticated execution where the function's internal platform-admin gate is mandatory.
- Add regression tests for unauthorized callers, anon denial, self-change denial, no-op changes, role elevation, suspension, correct before/after snapshots, actor spoofing, pagination bounds, transaction rollback, and tenant isolation.

## Frontend acceptance requirements

- Show actor, target account, action, before/after role and status, and timestamp.
- Filter by target account, action type, and date range; newest events first.
- Escape all database-sourced text.
- Keep the audit feed read-only; do not expose edit/delete controls.
- Show a clear unavailable state when the RPC is not installed; never substitute browser local storage or fabricated events.
- Only report that an event was audited after the transaction-backed RPC returns success.

## Current completion status

The frontend confirmation safeguards for role/status changes are implemented separately. Durable platform-level audit history is **not implemented** because the required database migration is blocked by the unreconciled staging ledger. No database schema or production data was changed during this assessment.
