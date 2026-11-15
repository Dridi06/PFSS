import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const command = resolve(process.cwd(), "scripts/verify-migration-ledger.mjs");
function run(input) {
  return spawnSync(process.execPath, [command], {
    cwd: process.cwd(),
    input,
    encoding: "utf8"
  });
}

const valid = run(`LOCAL | REMOTE | TIME (UTC)
--------|--------|----------
20261110 | 20261110 | 2026-11-10
20261111 | 20261111 | 2026-11-11
20261112 |          |
20261113 |          |
`);
assert.equal(valid.status, 0, valid.stderr);
assert.match(valid.stdout, /Local migrations: 58/);
assert.match(valid.stdout, /Applied remotely: 2/);
assert.match(valid.stdout, /Pending locally: 56/);

const remoteOnly = run(`LOCAL | REMOTE | TIME (UTC)
20261110 | 20261110 |
20261111 | 20269999 |
`);
assert.notEqual(remoteOnly.status, 0);
assert.match(remoteOnly.stderr, /Remote migration ledger contains versions missing from this branch/);

const outOfOrder = run(`LOCAL | REMOTE | TIME (UTC)
20261110 | 20261110 |
20261111 |          |
20261112 | 20261112 |
`);
assert.notEqual(outOfOrder.status, 0);
assert.match(outOfOrder.stderr, /not a chronological prefix/);

const duplicateRemote = run(`LOCAL | REMOTE | TIME (UTC)
20261110 | 20261110 |
20261111 | 20261110 |
`);
assert.notEqual(duplicateRemote.status, 0);
assert.match(duplicateRemote.stderr, /Duplicate remote migration version/);

const missingHeader = run("No migrations found");
assert.notEqual(missingHeader.status, 0);
assert.match(missingHeader.stderr, /no LOCAL \| REMOTE header/);

console.log("PFMS migration ledger preflight regression tests passed: valid prefix, remote-only, out-of-order, duplicate and malformed CLI output.");
