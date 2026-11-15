# PFSS Development Checkpoint – 15 November 2026

## Repository state

- Repository: `Dridi06/PFSS`
- Working branch: `feature/pfss-complete-platform-build`
- Baseline commit before this checkpoint: `05b42da08122bf4acbb5d4fef643f68ed387f724`
- Security-audit implementation commit: `b3ac7c1f1514e6f9eeea94388020c42b1ef97287`
- No merge to `main`, no Render deployment, no Supabase migration execution and no production changes.

## Work completed in this checkpoint

1. Added `supabase/STAGING_EFFECTIVE_AUTHORIZATION_AUDIT_READ_ONLY.sql`.
   - Inventories effective RLS policy definitions and per-table/per-command policy summaries.
   - Reports RLS enabled/FORCE state and table ownership.
   - Explains PostgreSQL permissive-OR and restrictive-AND policy composition.
   - Reports enabled/disabled trigger state, trigger definitions and trigger-function security configuration.
   - Inventories every function in `public`, including effective EXECUTE privileges for `anon` and `authenticated`, PUBLIC EXECUTE ACLs and SECURITY DEFINER/search_path metadata.
   - Reports effective table privileges for browser roles.
   - Read-only: catalog inspection only; no DDL/DML or privilege changes.

2. Added `tests/effective-authorization-audit-smoke.mjs`.
   - Enforces a single read-only query contract.
   - Guards required RLS, trigger, RPC and ACL inventory coverage.
   - Included in `npm run check:syntax` and `npm run test:dist`.

3. Added `docs/EFFECTIVE_AUTHORIZATION_AUDIT.md` with staging execution, interpretation, limitations and release-gate instructions.

4. GitHub Actions run `43729072924` for commit `b3ac7c1f1514e6f9eeea94388020c42b1ef97287` completed successfully. Both project checks and Supabase Edge Function type checks passed.

## Next steps

1. Verify the follow-up per-command policy summary enhancement with CI.
2. Review all effective RLS policies and trigger definitions from the real isolated staging database.
3. Complete RPC source-reference inventory to identify unreferenced/legacy functions without deleting compatibility functions.
4. Run cross-tenant positive and negative integration tests with separate staging identities.
5. Compare migration ledger, actual schema and effective privileges against the feature branch.
6. Resolve the known branch/migration-history integration risks before any merge or release.

## Explicit limitations

A green CI run proves repository checks, not the live PostgreSQL authorization behavior. The new SQL audit has not yet been executed against Supabase staging. Do not claim staging acceptance or production readiness until its output and the required negative tests have been reviewed.

## Follow-up verification – final state

- Per-command RLS summaries now distinguish SELECT, INSERT, UPDATE and DELETE, including ALL policies for each command.
- The smoke test verifies the per-command summary and the exact permissive/restrictive combination explanation.
- The first follow-up CI attempts exposed test-fixture assertion/syntax issues; these were corrected in subsequent commits rather than ignored.
- Final verification commit: `2a494af212034417ca54ddd2754aedbe2e72ae27`.
- Final GitHub Actions run: `43729260827` – completed successfully; both jobs passed.
- Current feature branch head at checkpoint: `2a494af212034417ca54ddd2754aedbe2e72ae27`.
- Staging SQL execution and live tenant-isolation tests remain outstanding. CI success is not a substitute for those gates.


## RPC scanner hardening – final verification

- Extended `tests/rpc-reference-inventory-smoke.mjs`: static RPC names found in both browser entry points and Supabase Edge Functions must resolve to a public SQL function defined in the migration set. Unresolved static names now fail CI.
- Computed RPC expressions are explicitly reported for manual review; the scanner does not infer their target.
- Latest verified inventory from CI: 128 public SQL function names; 77 frontend-referenced names; 2 Edge Function-referenced names; 128 SQL-referenced names; 28 trigger-referenced names; 0 definition-only review candidates; 2 dynamic RPC expressions requiring manual review.
- The first attempt exposed a regular-expression escaping error in the new test. It was fixed in commit `9d1daf16a845528cfafb6f02c14924163d5f2a1b`; the corrected scanner passed both push and pull-request CI.
- Verified CI: [Push run 43730127752](https://github.com/Dridi06/PFSS/actions/runs/43730127752) and [PR run 43730132807](https://github.com/Dridi06/PFSS/actions/runs/43730132807). Both jobs passed in both runs.
- Current feature branch head at this checkpoint update: `9d1daf16a845528cfafb6f02c14924163d5f2a1b`.
- The inventory is static and repository-scoped. It does not prove that external consumers do not exist, nor does it establish live database grants or runtime authorization. Staging catalog review and two-tenant positive/negative tests remain open.


## RPC reference inventory – SQL self-reference and dynamic-name correction

- Corrected the SQL reference scanner so a function's own `CREATE FUNCTION` declaration does not count as an internal call. This materially improves the usefulness of definition-only candidates.
- Added exact quoted-name detection across browser and Edge Function sources to recognize functions selected through a variable before the Supabase `.rpc(...)` call.
- Latest verified inventory: 128 public function names; 77 statically referenced by frontend RPC calls; 2 statically referenced by Edge Functions; 36 internal SQL references; 28 trigger references; 5 definition-only review candidates; 2 computed RPC call expressions requiring manual review.
- Five review candidates: `pfms_admin_list_legacy_org_members`, `pfms_admin_list_legacy_scouts`, `pfms_admin_search_legacy_organizations`, `pfms_create_legacy_team_event`, and `pfms_update_legacy_team_event`. The first three are older unpaginated directory RPCs and may be compatibility endpoints; the event RPCs require checking UI/integration usage. No deletion or privilege change was made.
- Verified CI for commit `11117733a641c43d61169250d192845babc75f65`: [Push run 43730466429](https://github.com/Dridi06/PFSS/actions/runs/43730466429) and [PR run 43730471577](https://github.com/Dridi06/PFSS/actions/runs/43730471577); both Node project tests and Supabase Edge Function type-check jobs passed in both runs.
- These counts describe static source references only. Confirm actual staging `pg_proc`, effective ACLs, external consumers and API usage before any deprecation decision.


## Checkpoint closure – RPC inventory review

- RPC inventory implementation and interpretation documentation were finalized. Latest code-level verification commit: `11117733a641c43d61169250d192845babc75f65`; both push and PR CI passed (runs `43730466429` and `43730471577`).
- Follow-up documentation/test-label commit: `fa347431b49f7fe12126b0ac12ec1c3b5ab3c215`; both push and PR CI passed (runs `43730585646` and `43730589612`).
- Current branch head at checkpoint closure: `fa347431b49f7fe12126b0ac12ec1c3b5ab3c215`.
- Pull request #1 remains open and Draft. GitHub currently reports it as mergeable/clean, but that is not a release approval and does not resolve migration-ledger or runtime staging acceptance.
- Next safe work: inspect the five review-only RPC candidates against their effective latest SQL definitions and current UI workflows; preserve legacy endpoints until external-client usage is excluded. Then execute read-only catalog audits and isolated two-tenant runtime tests only after the dedicated Staging project is explicitly confirmed.
