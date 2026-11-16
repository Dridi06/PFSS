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

const contracts = {
  pfms_is_org_member: [
    /SECURITY DEFINER/i, /SET search_path\s*=\s*''/i,
    /auth\.uid\(\)\s+IS\s+NOT\s+NULL/i, /JOIN public\.profiles profile/i,
    /profile\.status\s*=\s*'approved'/i, /o\.status\s*=\s*'active'/i,
    /m\.status\s*=\s*'active'/i
  ],
  pfss_has_org_role: [
    /SECURITY DEFINER/i, /SET search_path\s*=\s*''/i,
    /auth\.uid\(\)\s+IS\s+NOT\s+NULL/i, /JOIN public\.profiles profile/i,
    /profile\.status\s*=\s*'approved'/i, /o\.status\s*=\s*'active'/i,
    /m\.status\s*=\s*'active'/i
  ],
  pfss_create_organization: [
    /SECURITY DEFINER/i, /SET search_path\s*=\s*''/i,
    /v_user_id\s+IS\s+NULL/i, /Profile approval required/i,
    /profile\.status\s*=\s*'approved'/i
  ],
  pfss_org_remove_member: [
    /SECURITY DEFINER/i, /SET search_path\s*=\s*''/i,
    /auth\.uid\(\)\s+IS\s+NULL/i, /JOIN public\.pfss_organizations/i,
    /JOIN public\.profiles actor_profile/i, /actor_profile\.status\s*=\s*'approved'/i,
    /org\.status\s*=\s*'active'/i, /FOR UPDATE/i,
    /Owner membership cannot be removed/i, /pfss_audit_log/i
  ],
  pfss_org_update_member: [
    /SECURITY DEFINER/i, /SET search_path\s*=\s*''/i,
    /auth\.uid\(\)\s+IS\s+NULL/i, /JOIN public\.pfss_organizations/i,
    /JOIN public\.profiles actor_profile/i, /actor_profile\.status\s*=\s*'approved'/i,
    /org\.status\s*=\s*'active'/i, /FOR UPDATE/i,
    /Owner membership is protected/i, /pfss_audit_log/i
  ]
};

for (const [name, checks] of Object.entries(contracts)) {
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION public." + name + "(");
  assert.notEqual(start, -1, "Missing hardened definition for " + name);
  const endMarker = "$function$;";
  const end = sql.indexOf(endMarker, start);
  assert.notEqual(end, -1, "Missing function terminator for " + name);
  const definition = sql.slice(start, end + endMarker.length);
  for (const check of checks) {
    assert.match(definition, check, "Security contract failed for " + name + ": " + check);
  }
}
for (const line of [
  "REVOKE ALL ON FUNCTION public.pfms_is_org_member(uuid) FROM PUBLIC, anon;",
  "REVOKE ALL ON FUNCTION public.pfss_has_org_role(uuid, text[]) FROM PUBLIC, anon;",
  "REVOKE ALL ON FUNCTION public.pfss_create_organization(text, text, text) FROM PUBLIC, anon;",
  "REVOKE ALL ON FUNCTION public.pfss_org_remove_member(uuid) FROM PUBLIC, anon;",
  "REVOKE ALL ON FUNCTION public.pfss_org_update_member(uuid, text, text) FROM PUBLIC, anon;"
]) assert.ok(sql.includes(line), "Missing browser-role deny rule: " + line);

console.log("PFMS approved-profile and active-organization authorization contract passed.");
