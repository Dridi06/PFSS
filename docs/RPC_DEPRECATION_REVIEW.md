# RPC deprecation review – 15 November 2026

## Decision

**No candidate is approved for deletion or privilege reduction.** The review confirms safer paginated replacements for three administrator directory RPCs, but static repository inspection cannot rule out external PostgREST clients, older deployed clients, scripts, or integrations. The two team-event write RPCs have no direct frontend call in the current branch; this is not evidence that they are unused.

## Candidate findings

| Legacy RPC | Current repository evidence | Decision |
|---|---|---|
| `pfms_admin_search_legacy_organizations` | Current admin UI calls `pfms_admin_search_legacy_organizations_page`; the old function remains defined in `20261111_admin_legacy_organization_management.sql`. | Retain for compatibility. |
| `pfms_admin_list_legacy_scouts` | Current admin UI selects `pfms_admin_list_legacy_scouts_page`; the old function remains defined in the same legacy management migration. | Retain for compatibility. |
| `pfms_admin_list_legacy_org_members` | Current admin UI calls `pfms_admin_list_legacy_org_members_page`; old function remains defined in the legacy management migration. | Retain for compatibility. |
| `pfms_create_legacy_team_event` | Definition and authenticated EXECUTE grant exist in `20261203_pfms_legacy_team_events.sql`; no direct call to this exact RPC was found in `app.js` or `scout-workspace.js`. Event-participant RPC names are separate functions. | Retain; investigate whether an external/older client uses it. |
| `pfms_update_legacy_team_event` | Definition and authenticated EXECUTE grant exist in `20261203_pfms_legacy_team_events.sql`; no direct call to this exact RPC was found in `app.js` or `scout-workspace.js`. Participant-update RPCs are separate functions. | Retain; investigate whether an external/older client uses it. |

## Security and compatibility observations

- The three newer directory RPCs are additive, bounded page APIs with input validation, stable ordering, and a maximum page size of 100. Their migrations explicitly state that the older endpoints remain available for compatibility.
- The legacy directory functions use `public.is_admin()`; the newer paginated directory functions use `public.pfms_is_admin()`. Do not assume these helpers are semantically interchangeable without inspecting their effective definitions and testing the intended administrator population in isolated staging.
- The two event write functions are `SECURITY DEFINER` with an empty `search_path` and call the team-scoped `events.edit` permission check before performing writes. Their grants are limited to `authenticated` after revoking default/public and anonymous access in the migration. This is a source-level observation, not a live effective-ACL result.
- Event participant, logistics, and travel-plan RPCs are distinct APIs. Their presence does not prove that the event create/update RPCs are called.
- The static scanner cannot see external consumers, dynamic SQL, deployed clients, API gateway traffic, or calls outside this repository.

## Required evidence before any deprecation

1. Confirm the exact applied migration ledger and effective `pg_proc`, owner, SECURITY DEFINER, `proconfig`, trigger dependencies, and EXECUTE ACLs in a dedicated isolated staging project.
2. Compare the effective definitions of `is_admin()` and `pfms_is_admin()`; test positive and negative administrator cases.
3. Search API logs/telemetry and ask owners of integrations, scripts, mobile clients, and other deployed frontends about these exact RPC names.
4. Run compatibility tests against each supported client version and verify that no old endpoint is still called.
5. If removal is ever approved, use a separate deprecation window, release note, monitoring period, and reversible migration plan.

## Scope and limitations

This report is based on the feature branch's migration files and the two current browser entry points. It does not query Supabase, Render, production, or external systems. It makes no schema, data, grant, or deployment changes. Do not interpret a green static test as staging acceptance or production readiness.
