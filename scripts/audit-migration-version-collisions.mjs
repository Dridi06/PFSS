import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve(process.cwd(), "supabase/migrations");
const baseline = JSON.parse(await readFile(
  resolve(directory, "version-collision-baseline.json"), "utf8"
));
assert.equal(baseline.version, 1, "Migration collision baseline version must be explicit.");
assert.equal(
  baseline.status,
  "blocked-pending-staging-ledger-reconciliation",
  "Do not treat the known migration collision baseline as release approval."
);
assert.ok(
  typeof baseline.purpose === "string" && baseline.purpose.length > 80,
  "Collision baseline must explain its safety boundary."
);

const files = (await readdir(directory))
  .filter((name) => /^\d{8}_[a-z0-9][a-z0-9_]*\.sql$/.test(name))
  .sort();
const actual = new Map();
for (const name of files) {
  const version = name.slice(0, 8);
  if (!actual.has(version)) actual.set(version, []);
  actual.get(version).push(name);
}
const actualDuplicates = Object.fromEntries(
  [...actual.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([version, names]) => [version, names])
);
const expected = baseline.knownDuplicateVersions;
assert.ok(expected && typeof expected === "object" && !Array.isArray(expected),
  "Known duplicate migration versions must be an explicit object.");
assert.deepEqual(
  actualDuplicates,
  expected,
  "Migration version collisions changed. Review the actual staging ledger and explicitly update the baseline; never silently rename existing migrations."
);

const duplicateFileCount = Object.values(actualDuplicates)
  .reduce((total, names) => total + names.length, 0);
const duplicateExtraCount = duplicateFileCount - Object.keys(actualDuplicates).length;
console.log(
  "PFMS migration collision guard passed: " + files.length +
  " SQL files, " + Object.keys(actualDuplicates).length +
  " known duplicate version prefixes (" + duplicateExtraCount +
  " additional colliding files); no new or silently changed collisions."
);
console.log(
  "Release blocker remains explicit: reconcile the dedicated STAGING migration ledger before any migration rename, repair or application."
);
