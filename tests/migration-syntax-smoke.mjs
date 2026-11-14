import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

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
