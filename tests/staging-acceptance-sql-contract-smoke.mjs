import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sql = await readFile(
  resolve(process.cwd(), "supabase/STAGING_ACCEPTANCE_READ_ONLY.sql"),
  "utf8"
);
const executable = sql
  .replace(/--[^\n]*/g, "")
  .replace(/'(?:''|[^'])*'/g, "''")
  .trim();

assert.match(executable, /^WITH\s+checks\s+AS\s*\(/i,
  "Staging acceptance audit must be a single read-only checks CTE.");
assert.match(executable, /\)\s*SELECT\s+check_name,\s*passed,\s*details\s+FROM\s+checks\s+ORDER\s+BY\s+check_name\s*;$/i,
  "Audit must return a stable check_name/passed/details result contract.");
assert.equal((executable.match(/;/g) ?? []).length, 1,
  "Acceptance audit must contain exactly one terminal SQL statement.");
assert.doesNotMatch(
  executable,
  /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_]|DELETE\s+FROM|MERGE\s+INTO|CREATE\s+[A-Z]|ALTER\s+[A-Z]|DROP\s+[A-Z]|TRUNCATE|GRANT|REVOKE|CALL\s+)\b/i,
  "Staging acceptance audit must never mutate data, schema, privileges or invoke procedures."
);

const checkNames = [...sql.matchAll(
  /^\s*select\s+'([a-z][a-z0-9_]*)'(?:\s*::\s*text)?(?:\s+as\s+check_name)?\s*,/gim
)].map((match) => match[1]);
assert.ok(checkNames.length >= 25,
  "Acceptance audit unexpectedly lost coverage; expected at least 25 named checks.");
assert.equal(new Set(checkNames).size, checkNames.length,
  "Staging acceptance check names must be unique.");
for (const required of [
  "team_tasks_rls",
  "notifications_rls",
  "organization_core_table_write_acl",
  "owner_bootstrap_security_boundary",
  "auth_trigger_function_acl",
  "legacy_invitation_table_acl",
  "legacy_team_access_requires_active_org_membership",
  "pfms_membership_owner_lock_order",
  "pfms_membership_input_validation"
]) {
  assert.ok(checkNames.includes(required),
    "Required staging acceptance gate is missing: " + required);
}

console.log(
  "PFMS staging acceptance SQL contract passed: " + checkNames.length +
  " unique named checks, stable result schema, one read-only statement and critical auth/tenant gates."
);
