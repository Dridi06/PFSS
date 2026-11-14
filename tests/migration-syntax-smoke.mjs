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

console.log("PFMS migration smoke tests passed: " + migrationFiles.length + " SQL migration files checked.");
