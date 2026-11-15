import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

const root = process.cwd();
const migrationRoot = resolve(root, "supabase/migrations");
const functionRoot = resolve(root, "supabase/functions");
const migrationFiles = (await readdir(migrationRoot)).filter((name) => name.endsWith(".sql")).sort();

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (/\.(?:js|mjs|ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const migrationSources = await Promise.all(migrationFiles.map(async (file) => ({
  file, source: await readFile(resolve(migrationRoot, file), "utf8")
})));
const frontendPaths = ["app.js", "scout-workspace.js"];
const frontendSources = await Promise.all(frontendPaths.map(async (file) => ({
  file, source: await readFile(resolve(root, file), "utf8")
})));
const edgePaths = await walk(functionRoot);
const edgeSources = await Promise.all(edgePaths.map(async (path) => ({
  file: relative(root, path).replaceAll("\\", "/"),
  source: await readFile(path, "utf8")
})));

const functions = new Map();
const definitionPattern = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi;
for (const { file, source } of migrationSources) {
  for (const match of source.matchAll(definitionPattern)) {
    const name = match[1].toLowerCase();
    const record = functions.get(name) || {
      name, definitions: [], frontendCalls: [], edgeCalls: [],
      sqlReferences: [], triggerReferences: []
    };
    record.definitions.push(file);
    functions.set(name, record);
  }
}
assert.ok(functions.size > 0, "No public SQL function definitions found.");

function collectRpcCalls(source, file, target) {
  const pattern = /\.rpc\s*\(\s*(['"])([a-z_][a-z0-9_]*)\1/gi;
  for (const match of source.matchAll(pattern)) {
    const record = functions.get(match[2].toLowerCase());
    if (record) record[target].push(file);
  }
}
for (const { file, source } of frontendSources) collectRpcCalls(source, file, "frontendCalls");
for (const { file, source } of edgeSources) collectRpcCalls(source, file, "edgeCalls");

const triggerPattern = /execute\s+function\s+public\.([a-z0-9_]+)\s*\(/gi;
for (const { file, source } of migrationSources) {
  for (const match of source.matchAll(triggerPattern)) {
    functions.get(match[1].toLowerCase())?.triggerReferences.push(file);
  }
}

for (const { file, source } of migrationSources) {
  // Match the offset of "public.function_name", not the beginning of
  // CREATE FUNCTION; otherwise every definition falsely references itself.
  const declarationOffsets = new Set(
    [...source.matchAll(definitionPattern)].map((match) =>
      match.index + match[0].toLowerCase().lastIndexOf("public.")
    )
  );
  const referencePattern = /public\\.([a-z0-9_]+)\\s*\\(/gi;
  for (const match of source.matchAll(referencePattern)) {
    const name = match[1].toLowerCase();
    const record = functions.get(name);
    if (!record || declarationOffsets.has(match.index)) continue;
    const prefix = source.slice(Math.max(0, match.index - 90), match.index);
    if (/\\b(?:grant|revoke)\\b[\\s\\S]*\\bon\\s+function\\s*$/i.test(prefix)) continue;
    if (/\\bexecute\\s+function\\s*$/i.test(prefix)) continue;
    record.sqlReferences.push(file);
  }
}

const rows = [...functions.values()].sort((a, b) => a.name.localeCompare(b.name));
const definitionOnly = rows.filter((row) =>
  row.frontendCalls.length === 0 && row.edgeCalls.length === 0 &&
  row.sqlReferences.length === 0 && row.triggerReferences.length === 0
);
const count = (key) => rows.filter((row) => row[key].length > 0).length;
assert.ok(count("frontendCalls") + count("edgeCalls") + count("sqlReferences") + count("triggerReferences") > 0,
  "No public function references were detected; inventory scanner may be broken.");

console.log("PFMS RPC reference inventory:");
console.log("  public function names: " + rows.length);
console.log("  frontend referenced: " + count("frontendCalls"));
console.log("  Edge Function referenced: " + count("edgeCalls"));
console.log("  SQL referenced: " + count("sqlReferences"));
console.log("  trigger referenced: " + count("triggerReferences"));
console.log("  definition-only review candidates: " + definitionOnly.length);
for (const row of definitionOnly) {
  console.log("  REVIEW ONLY: " + row.name + " (latest definition: " + row.definitions.at(-1) + ")");
}
console.log("No function was modified, revoked, or deleted by this static inventory.");
