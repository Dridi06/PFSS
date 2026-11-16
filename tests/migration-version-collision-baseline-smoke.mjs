import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const baseline = JSON.parse(await readFile(
  resolve(process.cwd(), "supabase/migrations/version-collision-baseline.json"),
  "utf8"
));
assert.equal(baseline.status, "blocked-pending-staging-ledger-reconciliation");
assert.equal(Object.keys(baseline.knownDuplicateVersions).length, 11);
for (const [version, names] of Object.entries(baseline.knownDuplicateVersions)) {
  assert.match(version, /^\d{8}$/);
  assert.ok(names.length > 1, "Collision group must contain at least two files: " + version);
  assert.equal(new Set(names).size, names.length, "Duplicate filename in collision group: " + version);
  for (const name of names) {
    assert.ok(name.startsWith(version + "_"), "Filename/version mismatch: " + name);
    assert.match(name, /^\d{8}_[a-z0-9][a-z0-9_]*\.sql$/);
  }
}
console.log("PFMS migration collision baseline contract passed: 11 explicit collision groups; staging reconciliation remains mandatory.");
