import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261228_pfms_ddl_rls_fail_closed.sql"
);
const migration = (await readFile(migrationPath, "utf8"))
  .replace(/\s+/g, " ")
  .toLowerCase();

assert.match(
  migration,
  /create or replace function public\.rls_auto_enable\(\) returns event_trigger language plpgsql security definer set search_path = '' as \$\$/,
  "The DDL event-trigger function must be SECURITY DEFINER with an empty search_path."
);
assert.match(
  migration,
  /from pg_catalog\.pg_event_trigger_ddl_commands\(\)/,
  "The event trigger must inspect PostgreSQL's DDL command catalog."
);
for (const commandTag of ["create table", "create table as", "select into"]) {
  assert.ok(
    migration.includes("'" + commandTag + "'"),
    "The event trigger must preserve its intended DDL coverage: " + commandTag
  );
}
assert.match(
  migration,
  /command_row\.schema_name = 'public'/,
  "Only newly created public-schema relations may be changed."
);
assert.match(
  migration,
  /relation\.relkind in \('r', 'p'\)/,
  "Only ordinary and partitioned tables may be altered."
);
assert.match(
  migration,
  /raise exception[\s\S]*using errcode = '55000'/,
  "Failure to resolve a newly created public relation must abort the DDL transaction."
);
assert.match(
  migration,
  /execute pg_catalog\.format\([\s\S]*enable row level security/,
  "RLS activation must use a safely quoted, schema-qualified ALTER TABLE statement."
);
assert.doesNotMatch(
  migration,
  /exception\s+when\s+others\s+then/,
  "The DDL event trigger must not swallow failures while enabling RLS."
);
assert.match(
  migration,
  /revoke all on function public\.rls_auto_enable\(\) from public, anon, authenticated/,
  "The event-trigger function must not be directly executable by browser roles."
);
assert.match(
  migration,
  /comment on function public\.rls_auto_enable\(\)/,
  "The hardened event-trigger contract must be documented in the database."
);

const acceptance = await readFile(
  resolve(process.cwd(), "supabase/STAGING_ACCEPTANCE_READ_ONLY.sql"),
  "utf8"
);
assert.match(
  acceptance,
  /'ddl_rls_event_trigger_fail_closed'/,
  "The read-only staging audit must verify the DDL RLS event-trigger boundary."
);
assert.match(
  acceptance,
  /pg_event_trigger[\s\S]*?ensure_rls[\s\S]*?rls_auto_enable/,
  "The staging audit must verify the registered ensure_rls event trigger."
);

console.log(
  "PFMS DDL RLS event-trigger hardening smoke test passed: fixed search_path, public-table scope, fail-closed behavior and browser EXECUTE revocation."
);
