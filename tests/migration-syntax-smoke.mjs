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
const adminSystemEventsPagination = migrationSources[
  migrationFiles.indexOf("20261220_pfms_admin_system_event_pagination.sql")
];
assert.ok(adminSystemEventsPagination, "Admin system event pagination migration is missing.");
const systemEventsPageDefinition = extractSqlFunction(
  adminSystemEventsPagination, "pfms_admin_list_system_events_page"
);
assert.ok(systemEventsPageDefinition, "Admin system event pagination RPC is missing.");
assert.match(systemEventsPageDefinition, /security definer set search_path = '' as \$\$/,
  "System event pagination must be SECURITY DEFINER with an empty search_path.");
assert.match(systemEventsPageDefinition, /public\.pfms_is_admin\(\)/,
  "System event pagination must enforce the canonical admin check.");
assert.match(systemEventsPageDefinition, /p_limit is null or p_limit not between 1 and 100/,
  "System event pagination must cap page size at 100.");
assert.match(systemEventsPageDefinition, /p_offset is null or p_offset not between 0 and 1000000/,
  "System event pagination must reject unbounded offsets.");
assert.match(systemEventsPageDefinition, /count\(\*\) over \(\)/,
  "System event pagination must return the total matching event count.");
assert.ok(
  adminSystemEventsPagination.includes("grant execute on function public.pfms_admin_list_system_events_page(text, text, text, integer, integer)"),
  "System event pagination must explicitly grant its RPC to authenticated."
);
assert.ok(
  adminSystemEventsPagination.includes("revoke all on function public.pfms_admin_list_system_events_page(text, text, text, integer, integer)"),
  "System event pagination must revoke default public/anon execution."
);

const organizationMembersPagination = migrationSources[
  migrationFiles.indexOf("20261221_pfms_admin_org_member_pagination.sql")
];
assert.ok(organizationMembersPagination, "Organization member pagination migration is missing.");
const organizationMembersPageDefinition = extractSqlFunction(
  organizationMembersPagination, "pfms_admin_list_legacy_org_members_page"
);
assert.ok(organizationMembersPageDefinition, "Organization member pagination RPC is missing.");
for (const field of ["total_count", "active_count", "pending_count", "suspended_count", "filtered_count"]) {
  assert.ok(
    organizationMembersPageDefinition.includes(field),
    "Organization member pagination must return the " + field + " summary."
  );
}
assert.match(
  organizationMembersPageDefinition,
  /left join page on true/,
  "Organization summary counters must remain available even when a requested page has no rows."
);
assert.match(
  organizationMembersPageDefinition,
  /from stats[\\s\\S]*?left join page on true/,
  "The page result must be anchored on the unfiltered organization summary."
);
assert.match(organizationMembersPageDefinition, /count\(\*\) as total_count/,
  "Organization member totals must be calculated before page filtering.");


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


const ownerIntegrityMigration = migrationSources[
  migrationFiles.indexOf("20261210_pfms_owner_integrity_hardening.sql")
];
assert.ok(ownerIntegrityMigration, "Organization owner integrity migration is missing.");
const protectedProfileUpdate = extractSqlFunction(
  ownerIntegrityMigration, "pfss_admin_update_profile"
);
assert.ok(protectedProfileUpdate, "Protected administrator profile RPC is missing.");
assert.match(protectedProfileUpdate, /security definer set search_path = '' as \$\$/,
  "Administrator profile changes must run with a locked-down SECURITY DEFINER context.");
assert.match(protectedProfileUpdate, /p_user_id = auth\.uid\(\)/,
  "Administrators must not be able to modify their own administrator profile.");
assert.match(protectedProfileUpdate, /public\.pfms_platform_owner[\s\S]*?owner_user_id = p_user_id/,
  "The separately designated platform owner must be protected from ordinary profile edits.");
assert.match(protectedProfileUpdate, /p_role not in \('user', 'scout', 'admin'\)/,
  "Administrator profile roles must be explicitly allow-listed.");
assert.match(protectedProfileUpdate, /p_status not in \('pending', 'approved', 'suspended'\)/,
  "Administrator profile statuses must be explicitly allow-listed.");

const protectedMembershipUpdate = extractSqlFunction(
  ownerIntegrityMigration, "pfms_admin_update_legacy_membership"
);
assert.ok(protectedMembershipUpdate, "Serialized administrator membership RPC is missing.");
assert.match(protectedMembershipUpdate, /security definer set search_path = '' as \$\$/,
  "Administrator membership changes must run with a locked-down SECURITY DEFINER context.");
assert.match(protectedMembershipUpdate, /public\.is_admin\(\)/,
  "Administrator membership changes must enforce the server-side administrator check.");
const organizationLockPosition = protectedMembershipUpdate.indexOf("from public.organizations o");
const membershipLockPosition = protectedMembershipUpdate.indexOf("from public.organization_memberships m", organizationLockPosition + 1);
assert.ok(organizationLockPosition >= 0 && membershipLockPosition > organizationLockPosition,
  "Membership updates must lock the parent organization before re-reading and locking the membership.");
assert.match(protectedMembershipUpdate, /for update[\s\S]*?from public\.organization_memberships m[\s\S]*?for update/,
  "Membership updates must lock both the parent organization and the target membership.");
assert.match(protectedMembershipUpdate, /v_current_role = 'owner'[\s\S]*?v_current_status = 'active'[\s\S]*?other_owner\.role = 'owner'[\s\S]*?other_owner\.status = 'active'/,
  "An active owner may only be demoted or suspended when another active owner remains.");
assert.match(protectedMembershipUpdate, /p_role not in \([\s\S]*?'owner'[\s\S]*?'club_admin'[\s\S]*?'agency_admin'/,
  "Administrator membership roles must use the explicit supported role allow-list.");
assert.ok(
  ownerIntegrityMigration.includes("revoke all on function public.pfms_admin_update_legacy_membership(uuid, text, text)"),
  "The administrator membership RPC must revoke default public/anon execution."
);
assert.ok(
  ownerIntegrityMigration.replace(/\s+/g, " ").toLowerCase().includes(
    "grant execute on function public.pfms_admin_update_legacy_membership(uuid, text, text) to authenticated"
  ),
  "The administrator membership RPC must explicitly grant execution to authenticated."
);
assert.match(stagingAcceptanceSql, /'admin_owner_integrity_membership'/,
  "The read-only staging audit must verify the active organization-owner invariant.");
assert.match(stagingAcceptanceSql, /'admin_platform_owner_profile_protection'/,
  "The read-only staging audit must verify platform-owner profile protection.");

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
