import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sql = await readFile(
  resolve(process.cwd(),
    "supabase/manual-staging-hardening/20261116_pfss_active_organization_membership_guard.sql"),
  "utf8"
);

assert.match(sql, /MANUAL STAGING HARDENING ONLY/);
assert.match(sql, /Do not place this file in supabase\/migrations or apply it to production/i);

for (const name of ["pfss_org_remove_member", "pfss_org_update_member"]) {
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION public." + name + "(");
  assert.notEqual(start, -1, "Missing hardened definition for " + name);
  const endMarker = "$function$;";
  const end = sql.indexOf(endMarker, start);
  assert.notEqual(end, -1, "Missing function terminator for " + name);
  const definition = sql.slice(start, end + endMarker.length);

  assert.match(definition, /SECURITY DEFINER/i);
  assert.match(definition, /SET search_path\s*=\s*''/i);
  assert.match(definition, /auth\.uid\(\)\s+IS\s+NULL/i);
  assert.match(definition, /JOIN public\.pfss_organizations/i);
  assert.match(definition, /org\.status\s*=\s*'active'/i);
  assert.match(definition, /actor\.status\s*=\s*'active'/i);
  assert.match(definition, /NOT IN\s*\('owner',\s*'admin'\)/i);
  assert.match(definition, /FOR UPDATE/i);
  assert.match(definition, /pfss_audit_log/i);
}
assert.match(sql, /REVOKE ALL ON FUNCTION public\.pfss_org_remove_member\(uuid\)\s+FROM PUBLIC, anon/i);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.pfss_org_remove_member\(uuid\)\s+TO authenticated/i);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.pfss_org_update_member\(uuid, text, text\)\s+FROM PUBLIC, anon/i);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.pfss_org_update_member\(uuid, text, text\)\s+TO authenticated/i);
console.log("PFMS active-organization membership RPC hardening contract passed.");
