import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../supabase/migrations/20261125030000_asi_candidate_atomic_promotion.sql", import.meta.url), "utf8");
for (const token of [
  "security invoker",
  "private.is_admin() or private.is_approved_scout()",
  "asi_candidate_already_processed",
  "asi_identity_confidence_below_promotion_threshold",
  "asi_candidate_has_no_recorded_sources",
  "asi_candidate_has_unresolved_blocking_conflicts",
  "pg_advisory_xact_lock",
  "asi_candidate_duplicate_player_exists",
  "public.asi_player_analyses",
  "set status = 'promoted'",
  "grant execute on function public.asi_promote_player_candidate(uuid) to authenticated"
]) assert.ok(sql.toLowerCase().includes(token.toLowerCase()), `Missing contract: ${token}`);

assert.ok(!/security\s+definer/i.test(sql), "Promotion RPC must remain SECURITY INVOKER.");
assert.ok(!/service_role/i.test(sql), "No service-role access may be introduced.");
console.log("ASI candidate promotion contract smoke test passed.");
