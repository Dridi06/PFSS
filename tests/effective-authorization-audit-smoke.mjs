import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sql = await readFile(
  resolve(process.cwd(), "supabase/STAGING_EFFECTIVE_AUTHORIZATION_AUDIT_READ_ONLY.sql"),
  "utf8"
);
const executable = sql
  .replace(/--[^\n]*/g, "")
  .replace(/'(?:''|[^'])*'/g, "''")
  .trim();

assert.match(executable, /^WITH\b/i, "Effective authorization audit must be one read-only CTE query.");
assert.equal((executable.match(/;/g) ?? []).length, 1, "Audit must contain exactly one terminal statement.");
assert.match(executable, /SELECT\s+section,\s*object_name,\s*details/i);
assert.doesNotMatch(
  executable,
  /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_]|DELETE\s+FROM|MERGE\s+INTO|CREATE\s+[A-Z]|ALTER\s+[A-Z]|DROP\s+[A-Z]|TRUNCATE|GRANT|REVOKE)\b/i,
  "Audit must never mutate data, schema, or privileges."
);
for (const marker of [
  "pg_catalog.pg_policy",
  "polpermissive",
  "relrowsecurity",
  "relforcerowsecurity",
  "pg_catalog.pg_trigger",
  "tgenabled",
  "pg_get_triggerdef",
  "pg_get_functiondef",
  "prosecdef",
  "proconfig",
  "has_function_privilege",
  "aclexplode",
  "has_table_privilege",
  "RLS_EFFECTIVE_SUMMARY",
  "CROSS JOIN commands",
  "cmd.command_name",
  "TRIGGER_EFFECTIVE",
  "RPC_EFFECTIVE"
]) {
  assert.ok(sql.includes(marker), "Audit is missing required effective-security inventory: " + marker);
}
assert.match(sql, /PERMISSIVE policies OR together; RESTRICTIVE policies AND together/i);
assert.match(sql, /RLS denies all rows to roles subject to RLS/i);
assert.match(sql, /WHERE n\.nspname = 'public'/i, "RPC inventory must include all public functions.");
assert.match(sql, /OR \(n\.nspname = 'auth' AND c\.relname = 'users'\)/i,
  "Trigger inventory must include auth.users.");
console.log("PFMS effective authorization audit contract passed: read-only SQL, RLS combination semantics, trigger state, RPC ACLs and effective table grants.");
