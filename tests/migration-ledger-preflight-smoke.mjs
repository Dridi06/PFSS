import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const migrationDirectory = resolve(process.cwd(), "supabase/migrations");
const versions = (await readdir(migrationDirectory))
  .map((name) => name.match(/^([0-9]{8})_[a-z0-9][a-z0-9_]*\.sql$/)?.[1])
  .filter(Boolean)
  .sort();
assert.ok(versions.length >= 3, "Ledger regression tests require at least three local migrations.");

const command = resolve(process.cwd(), "scripts/verify-migration-ledger.mjs");
function run(input) {
  return spawnSync(process.execPath, [command], {
    cwd: process.cwd(),
    input,
    encoding: "utf8"
  });
}
function table(remoteForVersion) {
  return [
    "LOCAL | REMOTE | TIME (UTC)",
    "--------|--------|----------",
    ...versions.map((version, index) =>
      version + " | " + (remoteForVersion(version, index) || "") + " | "
    )
  ].join("\n") + "\n";
}

const valid = run(table((_version, index) => index < 2 ? versions[index] : ""));
assert.equal(valid.status, 0, valid.stderr);
assert.match(valid.stdout, new RegExp("Local migrations: " + versions.length));
assert.match(valid.stdout, /Applied remotely: 2/);
assert.match(valid.stdout, new RegExp("Pending locally: " + (versions.length - 2)));

const remoteOnly = run(table((_version, index) => index < 2 ? versions[index] : "") +
  " | 20991231 |\n");
assert.notEqual(remoteOnly.status, 0);
assert.match(remoteOnly.stderr, /Remote migration ledger contains versions missing from this branch/);

const outOfOrder = run(table((_version, index) =>
  index === 0 || index === 2 ? versions[index] : ""
));
assert.notEqual(outOfOrder.status, 0);
assert.match(outOfOrder.stderr, /not a chronological prefix/);

const duplicateRemote = run(table((_version, index) =>
  index === 0 || index === 1 ? versions[0] : ""
));
assert.notEqual(duplicateRemote.status, 0);
assert.match(duplicateRemote.stderr, /Duplicate remote migration version/);

const missingHeader = run("No migrations found");
assert.notEqual(missingHeader.status, 0);
assert.match(missingHeader.stderr, /no LOCAL \| REMOTE header/);

console.log("PFMS migration ledger preflight regression tests passed: valid prefix, remote-only, out-of-order, duplicate and malformed CLI output.");
