import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

// The staging audit must remain a single read-only query and inventory every bucket.
const stagingAuditSql = await readFile(
  resolve(process.cwd(), "supabase/STAGING_READ_ONLY_AUDIT.sql"),
  "utf8"
);
const stagingAcceptanceSql = await readFile(
  resolve(process.cwd(), "supabase/STAGING_ACCEPTANCE_READ_ONLY.sql"),
  "utf8"
);
const executableAuditSql = stagingAuditSql
  .replace(/--[^\n]*/g, "")
  .replace(/'(?:''|[^'])*'/g, "''")
  .trim();
assert.match(executableAuditSql, /^WITH\b/i, "Staging audit must begin with a read-only CTE query.");
assert.match(executableAuditSql, /\bSELECT\s+section,\s*object_name,\s*details\b[\s\S]*;$/i);
assert.equal(
  (executableAuditSql.match(/;/g) ?? []).length,
  1,
  "Staging audit must contain exactly one terminal statement."
);
assert.doesNotMatch(
  executableAuditSql,
  /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_]|DELETE\s+FROM|MERGE\s+INTO|CREATE\s+[A-Z]|ALTER\s+[A-Z]|DROP\s+[A-Z]|TRUNCATE|GRANT|REVOKE)\b/i,
  "Staging audit must not contain data or schema mutations."
);
assert.match(stagingAuditSql, /FROM\s+storage\.buckets\s*\)/i);
assert.doesNotMatch(
  stagingAuditSql,
  /FROM\s+storage\.buckets\s+WHERE\s+id\s+IN/i,
  "Staging audit must inventory all buckets, not only a hard-coded bucket."
);
assert.match(
  stagingAuditSql,
  /to_regclass\('supabase_migrations\.schema_migrations'\)\s+IS\s+NOT\s+NULL/i,
  "Staging audit must report whether the Supabase migration ledger exists."
);

const migrationsDirectory = resolve(process.cwd(), "supabase/migrations");
const entries = await readdir(migrationsDirectory, { withFileTypes: true });
const migrationFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort();

assert.ok(migrationFiles.length > 0, "No Supabase migrations were found.");

for (const filename of migrationFiles) {
  const source = await readFile(resolve(migrationsDirectory, filename), "utf8");
  const delimiters = source.match(/\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/g) ?? [];
  const counts = new Map();

  for (const delimiter of delimiters) {
    counts.set(delimiter, (counts.get(delimiter) ?? 0) + 1);
  }

  for (const [delimiter, count] of counts) {
    assert.equal(count % 2, 0, filename + " has an unbalanced " + delimiter + " quote delimiter");
  }

  assert.doesNotMatch(
    source,
    /\bas\s\$(?:\s|$)/i,
    filename + " contains a bare dollar after AS; use $$ or a named dollar-quote delimiter"
  );
}

const migrationSources = await Promise.all(
  migrationFiles.map((filename) => readFile(resolve(migrationsDirectory, filename), "utf8"))
);
// Every public table introduced by a repository migration must appear in
// the read-only staging inventory. This prevents silent audit blind spots.
const auditTargetTableBlock = stagingAuditSql.match(
  /c\.relname\s+IN\s*\(([\s\S]*?)\n\s*\)/i
);
assert.ok(auditTargetTableBlock, "Staging audit must declare its public table inventory.");
const auditedTableNames = new Set(
  [...auditTargetTableBlock[1].matchAll(/'([a-z_][a-z0-9_]*)'/gi)].map((match) => match[1])
);
const createdPublicTables = new Set();
for (const source of migrationSources) {
  const executableSource = source.replace(/--[^\n]*/g, "");
  for (const match of executableSource.matchAll(
    /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\b/gi
  )) {
    createdPublicTables.add(match[1].toLowerCase());
  }
}
assert.ok(createdPublicTables.size > 0, "No migration-created public tables were discovered.");
for (const tableName of createdPublicTables) {
  assert.ok(
    auditedTableNames.has(tableName),
    "Staging read-only audit omits migration-created table: public." + tableName
  );
}


const adminDirectoryPagination = migrationSources[
  migrationFiles.indexOf("20261218_pfms_admin_directory_pagination.sql")
];
const adminProfilePagination = migrationSources[
  migrationFiles.indexOf("20261219_pfss_admin_profile_pagination.sql")
];
assert.ok(adminDirectoryPagination, "Admin directory pagination migration is missing.");
assert.ok(adminProfilePagination, "Admin profile pagination migration is missing.");
function extractSqlFunction(source, name) {
  const start = source.toLowerCase().indexOf("create or replace function public." + name + "(");
  if (start < 0) return "";
  const bodyMarker = source.toLowerCase().indexOf("as $$", start);
  if (bodyMarker < 0) return "";
  const end = source.indexOf("$$;", bodyMarker + 5);
  return end < 0 ? "" : source.slice(start, end + 3).replace(/\s+/g, " ").toLowerCase();
}
for (const [name, source, functionName] of [
  ["organization page", adminDirectoryPagination, "pfms_admin_search_legacy_organizations_page"],
  ["scout page", adminDirectoryPagination, "pfms_admin_list_legacy_scouts_page"],
  ["membership page", adminDirectoryPagination, "pfms_admin_list_legacy_members_page"],
  ["profile page", adminProfilePagination, "pfss_admin_list_profiles_page"]
]) {
  const definition = extractSqlFunction(source, functionName);
  assert.ok(definition, name + " function definition is missing.");
  assert.match(definition, /security definer set search_path = '' as \$\$/,
    name + " must be a SECURITY DEFINER function with an empty search_path.");
  assert.match(definition, /public\.pfms_is_admin\(\)/,
    name + " must enforce the canonical platform administrator check.");
  assert.match(definition, /p_limit is null or p_limit not between 1 and 100/,
    name + " must cap each page at 100 rows.");
  assert.match(definition, /p_offset is null or p_offset not between 0 and 1000000/,
    name + " must reject unbounded offsets.");
  assert.match(definition, /count\(\*\) over \(\)/,
    name + " must return a total count for stable pagination.");
}
const profileCountsDefinition = extractSqlFunction(adminProfilePagination, "pfss_admin_profile_counts");
assert.match(profileCountsDefinition, /public\.pfms_is_admin\(\)/,
  "The dashboard counters must have a separate administrator-only aggregate RPC.");
assert.match(stagingAcceptanceSql, /'admin_directory_pagination_rpc_security'/,
  "The read-only staging acceptance audit must verify pagination RPC security.");
assert.match(stagingAcceptanceSql, /'admin_directory_pagination_bounds'/,
  "The read-only staging acceptance audit must verify pagination limits.");
for (const signature of [
  "pfms_admin_search_legacy_organizations_page(text, text, text, text, integer, integer)",
  "pfms_admin_list_legacy_scouts_page(text, text, text, text, integer, integer)",
  "pfms_admin_list_legacy_members_page(text, text, text, text, integer, integer)",
  "pfss_admin_list_profiles_page(text, text, text, text, integer, integer)",
  "pfss_admin_profile_counts()"
]) {
  const functionName = signature.slice(0, signature.indexOf("("));
  assert.ok(
    adminDirectoryPagination.includes("grant execute on function public." + signature) ||
      adminProfilePagination.includes("grant execute on function public." + signature),
    functionName + " must explicitly grant its RPC to authenticated."
  );
  assert.ok(
    adminDirectoryPagination.includes("revoke all on function public." + signature) ||
      adminProfilePagination.includes("revoke all on function public." + signature),
    functionName + " must revoke default public/anon execution."
  );
}

const combinedMigrationSql = migrationSources.join("\n");
const normalizedMigrationSql = combinedMigrationSql.replace(/\s+/g, " ").toLowerCase();
const expectedReadPolicies = new Map([
  ["pfms_organizations", "pfms_org_read"],
  ["pfms_memberships", "pfms_membership_read"],
  ["pfms_scout_profiles", "pfms_scout_profile_read"]
]);
for (const [tableName, policyName] of expectedReadPolicies) {
  assert.match(
    normalizedMigrationSql,
    new RegExp("create\\s+policy\\s+" + policyName + "\\s+on\\s+public\\." + tableName + "\\s+for\\s+select\\s+to\\s+authenticated"),
    "RLS exception must retain its authenticated read policy: " + policyName
  );
  assert.doesNotMatch(
    normalizedMigrationSql,
    new RegExp("create\\s+policy\\s+[a-z0-9_]+\\s+on\\s+public\\." + tableName + "\\s+for\\s+(?:insert|update|delete|all)\\b"),
    "Legacy foundation tables must not gain direct browser write policies: public." + tableName
  );
}

const forceRlsExceptions = new Map([
  [
    "organization_invitations",
    "RLS is enabled; browser table privileges are fully revoked; access is through the controlled invitation RPC and auth trigger."
  ],
  [
    "pfms_platform_owner",
    "RLS is enabled; browser table privileges are fully revoked; ownership is accessed only by protected server-side functions."
  ],
  [
    "pfms_owner_bootstrap_requests",
    "RLS is enabled; browser table privileges are fully revoked; eligibility evidence is written only by the auth trigger and consumed by the server-side owner bootstrap."
  ],
  [
    "pfms_organizations",
    "Legacy organization foundation uses an explicit authenticated read policy; writes are performed by protected server-side functions."
  ],
  [
    "pfms_memberships",
    "Legacy membership foundation uses an explicit authenticated read policy; writes are performed by protected server-side functions."
  ],
  [
    "pfms_scout_profiles",
    "Legacy scout-profile foundation uses an explicit authenticated read policy; writes are performed by protected server-side functions."
  ]
]);
for (const tableName of createdPublicTables) {
  const tableReference = "public\\." + tableName;
  assert.match(
    normalizedMigrationSql,
    new RegExp("alter\\s+table\\s+(?:if\\s+exists\\s+)?" + tableReference + "\\s+enable\\s+row\\s+level\\s+security"),
    "Migration-created table must enable RLS: public." + tableName
  );
  if (forceRlsExceptions.has(tableName)) {
    if (expectedReadPolicies.has(tableName)) {
      // The original foundation tables intentionally expose SELECT only through
      // authenticated RLS policies; no INSERT/UPDATE/DELETE/ALL policy is allowed.
      continue;
    }
    assert.match(
      normalizedMigrationSql,
      new RegExp("revoke\\s+all\\s+on\\s+table\\s+" + tableReference + "\\s+from\\s+public,\\s*anon,\\s*authenticated"),
      "RLS exception must revoke all direct browser table privileges: public." + tableName
    );
    continue;
  }
  assert.match(
    normalizedMigrationSql,
    new RegExp("alter\\s+table\\s+(?:if\\s+exists\\s+)?" + tableReference + "\\s+force\\s+row\\s+level\\s+security"),
    "Migration-created table must force RLS unless explicitly and safely exempted: public." + tableName
  );
}


const functionDefinitions = combinedMigrationSql.matchAll(
  /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\([\s\S]*?\bas\s+\$\$[\s\S]*?\$\$;/gi
);

let securityDefinerCount = 0;
for (const match of functionDefinitions) {
  const definition = match[0];
  const header = definition.slice(0, definition.search(/\bas\s+\$\$/i));
  if (!/security\s+definer/i.test(header)) continue;

  const functionName = match[1].toLowerCase();
  assert.match(
    header,
    /set\s+search_path\s*=/i,
    functionName + " is SECURITY DEFINER but has no fixed search_path"
  );
  assert.ok(
    normalizedMigrationSql.includes("revoke all on function public." + functionName),
    functionName + " is SECURITY DEFINER but its default function privileges are not explicitly revoked"
  );
  securityDefinerCount += 1;
}

assert.ok(securityDefinerCount > 0, "No SECURITY DEFINER migration functions were checked.");

// Documentation must never instruct operators to apply a migration that is
// absent from the repository. Check explicit migration paths in project docs.
const docsDirectory = resolve(process.cwd(), "docs");
const docsEntries = await readdir(docsDirectory, { withFileTypes: true });
const markdownFiles = docsEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => entry.name);
for (const filename of markdownFiles) {
  const document = await readFile(resolve(docsDirectory, filename), "utf8");
  for (const match of document.matchAll(/supabase\/migrations\/([A-Za-z0-9_-]+\.sql)/g)) {
    assert.ok(
      migrationFiles.includes(match[1]),
      filename + " references a migration that does not exist: " + match[1]
    );
  }
}


console.log(
  "PFMS migration smoke tests passed: " +
  migrationFiles.length +
  " SQL migrations and " +
  securityDefinerCount +
  " SECURITY DEFINER definitions checked."
);
