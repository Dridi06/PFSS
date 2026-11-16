import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const migrationDirectory = resolve(process.cwd(), "supabase/migrations");
const manifestPath = resolve(migrationDirectory, "dependency-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
assert.equal(manifest.version, 1, "Migration dependency manifest version must be explicit.");
assert.ok(
  typeof manifest.purpose === "string" && manifest.purpose.length > 40,
  "Migration dependency manifest must explain its scope and limitations."
);
assert.ok(Array.isArray(manifest.dependencies) && manifest.dependencies.length > 0,
  "Migration dependency graph must contain reviewed dependency edges.");

const files = (await readdir(migrationDirectory))
  .filter((name) => /^\d{8}_[a-z0-9][a-z0-9_]*\.sql$/.test(name))
  .sort();
const position = new Map(files.map((name, index) => [name, index]));
const edges = new Set();
const adjacency = new Map(files.map((name) => [name, []]));
const indegree = new Map(files.map((name) => [name, 0]));

for (const [index, edge] of manifest.dependencies.entries()) {
  assert.ok(edge && typeof edge === "object", "Dependency edge " + index + " must be an object.");
  const { before, after, reason } = edge;
  assert.ok(typeof before === "string" && position.has(before),
    "Dependency source migration does not exist: " + before);
  assert.ok(typeof after === "string" && position.has(after),
    "Dependency target migration does not exist: " + after);
  assert.notEqual(before, after, "A migration cannot depend on itself: " + before);
  assert.ok(typeof reason === "string" && reason.trim().length >= 20,
    "Dependency edge must include a meaningful review rationale: " + before + " -> " + after);
  const key = before + " -> " + after;
  assert.ok(!edges.has(key), "Duplicate migration dependency edge: " + key);
  edges.add(key);

  assert.ok(position.get(before) < position.get(after),
    "Migration execution order violates dependency: " + key);
  adjacency.get(before).push(after);
  indegree.set(after, indegree.get(after) + 1);
}

// Keep the latest security-hardening migrations connected to the schema and
// authorization helpers they alter or call. This prevents a valid-looking
// filename order from silently losing a critical dependency contract.
const requiredEdges = [
  ["20261111_organizations_memberships_permissions.sql", "20261224_pfms_legacy_core_search_path_hardening.sql"],
  ["20261111_organizations_memberships_permissions.sql", "20261225_pfms_organization_table_write_acl_hardening.sql"],
  ["20261111_organizations_memberships_permissions.sql", "20261227_pfms_legacy_team_access_null_guard.sql"],
  ["20261121_pfms_legacy_team_management.sql", "20261227_pfms_legacy_team_access_null_guard.sql"],
  ["20261222_pfms_legacy_org_manager_active_org_gate.sql", "20261227_pfms_legacy_team_access_null_guard.sql"]
];
for (const [before, after] of requiredEdges) {
  assert.ok(edges.has(before + " -> " + after),
    "Required security migration dependency is missing: " + before + " -> " + after);
}

// Kahn's algorithm: reject cycles even if future edits to ordering conventions
// accidentally make a dependency graph appear superficially plausible.
const queue = files.filter((name) => indegree.get(name) === 0);
let visited = 0;
for (let cursor = 0; cursor < queue.length; cursor += 1) {
  const current = queue[cursor];
  visited += 1;
  for (const dependent of adjacency.get(current)) {
    const remaining = indegree.get(dependent) - 1;
    indegree.set(dependent, remaining);
    if (remaining === 0) queue.push(dependent);
  }
}
assert.equal(visited, files.length, "Migration dependency graph contains a cycle.");

console.log(
  "PFMS migration dependency graph passed: " +
  files.length + " migration files, " +
  edges.size + " reviewed dependency edges, no missing nodes, ordering violations or cycles."
);
