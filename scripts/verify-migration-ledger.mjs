#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const MIGRATION_FILE = /^([0-9]{8})_[a-z0-9][a-z0-9_]*\.sql$/;
const VERSION = /^[0-9]{8}$/;

function parseLedger(output) {
  const lines = String(output ?? "").split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => {
    const cells = line.split("|").map((cell) => cell.trim().toLowerCase());
    return cells.length >= 2 && cells[0] === "local" && cells[1] === "remote";
  });
  assert.notEqual(headerIndex, -1,
    "Supabase migration list output has no LOCAL | REMOTE header; refusing an unverifiable audit.");

  const local = [];
  const remote = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.includes("|")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 2) continue;
    const localVersion = cells[0];
    const remoteVersion = cells[1];
    if (VERSION.test(localVersion)) local.push(localVersion);
    if (VERSION.test(remoteVersion)) remote.push(remoteVersion);
  }
  return { local, remote };
}

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    assert.ok(!seen.has(value), "Duplicate " + label + " migration version: " + value);
    seen.add(value);
  }
}

async function main() {
  const migrationDirectory = resolve(process.env.PFMS_MIGRATION_DIRECTORY || "supabase/migrations");
  const files = (await readdir(migrationDirectory))
    .map((name) => ({ name, match: name.match(MIGRATION_FILE) }))
    .filter((entry) => entry.match)
    .sort((a, b) => a.match[1].localeCompare(b.match[1]));
  const localFiles = files.map((entry) => entry.match[1]);
  assert.ok(localFiles.length > 0, "No timestamped local SQL migrations were found.");
  assertUnique(localFiles, "local");

  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  assert.ok(input.trim(), "Pipe the unmodified output of 'supabase migration list' to this command.");

  const ledger = parseLedger(input);
  assertUnique(ledger.local, "CLI local");
  assertUnique(ledger.remote, "remote");
  assert.deepEqual([...ledger.local].sort(), localFiles,
    "Supabase CLI LOCAL inventory differs from the repository migration files.");

  const localSet = new Set(localFiles);
  const remoteOnly = ledger.remote.filter((version) => !localSet.has(version));
  assert.deepEqual(remoteOnly, [],
    "Remote migration ledger contains versions missing from this branch: " + remoteOnly.join(", "));

  const remoteSet = new Set(ledger.remote);
  const expectedAppliedPrefix = localFiles.filter((version) => remoteSet.has(version));
  assert.deepEqual(ledger.remote, expectedAppliedPrefix,
    "Remote migrations are not a chronological prefix of this branch. Reconcile history before applying anything.");

  const pending = localFiles.filter((version) => !remoteSet.has(version));
  console.log("PFMS migration ledger preflight passed.");
  console.log("Local migrations: " + localFiles.length);
  console.log("Applied remotely: " + ledger.remote.length);
  console.log("Pending locally: " + pending.length);
  if (pending.length) console.log("Pending versions: " + pending.join(", "));
  console.log("No remote-only versions, duplicate versions or out-of-order applied migrations detected.");
  console.log("This is a comparison of CLI output and repository files, not a database schema or authorization audit.");
}

await main();
