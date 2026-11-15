import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

// The staging audit must remain a single read-only query and inventory every bucket.
const stagingAuditSql = await readFile(
  resolve(process.cwd(), "supabase/STAGING_READ_ONLY_AUDIT.sql"),
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

const combinedMigrationSql = migrationSources.join("\n");
const normalizedMigrationSql = combinedMigrationSql.replace(/\s+/g, " ").toLowerCase();
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
