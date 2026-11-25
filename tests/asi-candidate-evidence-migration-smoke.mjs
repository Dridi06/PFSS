import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../supabase/asi-migrations/20261125031000_asi_candidate_evidence_ledger.sql", import.meta.url), "utf8");
assert.match(sql,/create table if not exists public\.asi_candidate_evidence/);
assert.match(sql,/foreign key \(candidate_id, owner_id\)/);
assert.match(sql,/enable row level security/);
assert.match(sql,/asi_candidate_evidence_owner_insert_pending/);
assert.match(sql,/review_status = 'pending'/);
assert.match(sql,/legal_review_status = 'not_approved'/);
assert.match(sql,/create table if not exists public\.asi_candidate_evidence_reviews/);
assert.match(sql,/security invoker/i);
assert.match(sql,/p_decision is null or p_decision not in/);
assert.match(sql,/asi_candidate_evidence_reviews_admin_insert/);
assert.doesNotMatch(sql,/asi_candidate_evidence_reviews_admin_all/);
assert.match(sql,/revoke all on function public\.asi_review_candidate_evidence/);
assert.doesNotMatch(sql,/security definer/i);
console.log("ASI candidate evidence migration contract smoke tests passed.");
