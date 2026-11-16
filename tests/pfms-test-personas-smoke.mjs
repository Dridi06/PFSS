import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sql = await readFile(
  resolve(process.cwd(), "supabase/PFMS_TEST_PERSONAS_ACCEPTANCE_READ_ONLY.sql"),
  "utf8"
);
const executable = sql.replace(/--[^\n]*/g, "").trim();

assert.match(executable, /^WITH\s+role_counts\s+AS\s*\(/i,
  "Persona audit must start with a read-only CTE.");
assert.match(executable, /SELECT\s+check_name,\s*passed,\s*details\s+FROM\s+checks\s+ORDER\s+BY\s+check_name\s*;$/i,
  "Persona audit must return the stable check_name/passed/details contract.");
assert.equal((executable.match(/;/g) ?? []).length, 1,
  "Persona audit must contain exactly one SQL statement.");
assert.doesNotMatch(executable,
  /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_]|DELETE\s+FROM|MERGE\s+INTO|CREATE\s+[A-Z]|ALTER\s+[A-Z]|DROP\s+[A-Z]|TRUNCATE|GRANT|REVOKE|CALL\s+)\b/i,
  "Persona acceptance audit must never mutate data, schema, privileges or invoke procedures.");

for (const required of [
  "all_expected_roles_present",
  "total_fixture_count",
  "all_fixtures_marked_test",
  "all_logins_disabled",
  "no_email_or_auth_identity",
  "rls_enabled_and_forced",
  "no_client_role_grants",
  "real_auth_users_unchanged_baseline",
  "real_profiles_unchanged_baseline"
]) {
  assert.ok(executable.includes(required),
    "Missing required persona acceptance gate: " + required);
}
assert.match(executable, /\('scout',\s*5\)/);
assert.match(executable, /\('admin',\s*1\)/);
assert.match(executable, /\)\s*=\s*41/);
console.log("PFMS test-persona acceptance contract passed: 9 safety and role gates, read-only SQL.");
