import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../supabase/migrations/20270103_pfss_org_member_remove_and_invitation_revoke.sql", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

for (const name of ["pfss_org_remove_member", "pfss_org_revoke_invitation"]) {
  assert.match(sql, new RegExp("CREATE OR REPLACE FUNCTION public[.]"+name+"\\("));
  assert.match(sql, new RegExp("REVOKE ALL ON FUNCTION public[.]"+name+"\\(uuid\\) FROM PUBLIC, anon"));
  assert.match(sql, new RegExp("GRANT EXECUTE ON FUNCTION public[.]"+name+"\\(uuid\\) TO authenticated"));
  assert.ok(app.includes("'" + name + "'"), "Frontend must call " + name);
}
assert.match(sql, /actor\.user_id = auth\.uid\(\)[\s\S]*?actor\.status = 'active'[\s\S]*?org\.status = 'active'[\s\S]*?profile\.status = 'approved'/);
assert.match(sql, /v_target_role = 'owner'[\s\S]*?Owner membership is protected/);
assert.match(sql, /v_actor_role = 'admin' AND v_target_role = 'admin'[\s\S]*?Only the owner may remove an administrator/);
assert.match(sql, /v_target_user_id = auth\.uid\(\)[\s\S]*?Self-removal is not permitted/);
assert.match(sql, /SET status = 'removed'[\s\S]*?membership\.removed/);
assert.match(sql, /accepted_at IS NOT NULL OR i\.revoked_at IS NOT NULL/);
assert.match(sql, /SET revoked_at = pg_catalog\.now\(\)/);
assert.match(sql, /invitation\.revoked/);
assert.match(sql, /'target_user_id', v_target_user_id/);
assert.match(sql, /'email', v_email, 'role', v_role/);
assert.doesNotMatch(sql, /\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i);
console.log("PFMS organization management action tests passed: approved actor, active tenant scope, owner/admin hierarchy, self-removal guard, single-use invitation revocation, audit logging and least-privilege grants.");
