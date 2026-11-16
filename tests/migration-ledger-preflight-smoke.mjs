import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = await mkdtemp(resolve(tmpdir(), "pfms-ledger-test-"));
const migrationDirectory = resolve(root, "migrations");
await mkdir(migrationDirectory);
const versions = ["20261110", "20261111", "20261112", "20261113"];
for (const version of versions) {
  await writeFile(resolve(migrationDirectory, version + "_fixture.sql"), "-- fixture\n");
}

const command = resolve(process.cwd(), "scripts/verify-migration-ledger.mjs");
function run(input, directory = migrationDirectory) {
  return spawnSync(process.execPath, [command], {
    cwd: process.cwd(),
    input,
    encoding: "utf8",
    env: { ...process.env, PFMS_MIGRATION_DIRECTORY: directory }
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

try {
  const valid = run(table((_version, index) => index < 2 ? versions[index] : ""));
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /Local migrations: 4/);
  assert.match(valid.stdout, /Applied remotely: 2/);
  assert.match(valid.stdout, /Pending locally: 2/);

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

  const duplicateDirectory = resolve(root, "duplicate-migrations");
  await mkdir(duplicateDirectory);
  await writeFile(resolve(duplicateDirectory, "20261110_first.sql"), "-- fixture\n");
  await writeFile(resolve(duplicateDirectory, "20261110_second.sql"), "-- fixture\n");
  const duplicateLocal = run("LOCAL | REMOTE | TIME (UTC)\n", duplicateDirectory);
  assert.notEqual(duplicateLocal.status, 0);
  assert.match(duplicateLocal.stderr, /Duplicate local migration version: 20261110/);

  const missingHeader = run("No migrations found");
  assert.notEqual(missingHeader.status, 0);
  assert.match(missingHeader.stderr, /no LOCAL \| REMOTE header/);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("PFMS migration ledger preflight regression tests passed: valid prefix, remote-only, out-of-order, duplicate local/remote and malformed CLI output.");
