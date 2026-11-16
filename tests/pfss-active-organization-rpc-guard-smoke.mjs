import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sql = await readFile(
  resolve(process.cwd(),
    "supabase/manual-staging-hardening/20261116_pfss_active_organization_membership_guard.sql"),
  "utf8"
);

assert.match(sql, /MANUAL STAGING HARDENING ONLY/);
assert.doesNotMatch(sql, /production\s+(?:database|project|environment)[\s\S]{0,80}apply/i);

for (const name of ["pfss_org_remove_member", "pfss_org_update_member"]) {
  const match = sql.match(new RegExp(
    "CREATE OR REPLACE FUNCTION public\\\\." + name + "[\\\\s\\\\S]*?\\\\$function\\\\$;",
    "i"
  ));
  assert.ok(match, "Missing hardened definition for " + name);
  assert.match(match[0], /SECURITY DEFINER/i);
  assert.match(match[0], /SET search_path\s*=\s*''/i);
  assert.match(match[0], /auth\.uid\(\)\s+IS\s+NULL/i);
  assert.match(match[0], /JOIN public\.pfss_organizations/i);
  assert.match(match[0], /org\.status\s*=\s*'active'/i);
  assert.match(match[0], /actor\.status\s*=\s*'active'/i);
  assert.match(match[0], /NOT IN\s*\('owner',\s*'admin'\)/i);
  assert.match(match[0], /FOR UPDATE/i);
  assert.match(match[0], /pfss_audit_log/i);
}
assert.match(sql, /REVOKE ALL ON FUNCTION public\.pfss_org_remove_member\(uuid\)\s+FROM PUBLIC, anon/i);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.pfss_org_remove_member\(uuid\)\s+TO authenticated/i);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.pfss_org_update_member\(uuid, text, text\)\s+FROM PUBLIC, anon/i);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.pfss_org_update_member\(uuid, text, text\)\s+TO authenticated/i);
console.log("PFMS active-organization membership RPC hardening contract passed.");
