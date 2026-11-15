import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const migrationDirectory = resolve(root, "supabase/migrations");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const migrationSources = await Promise.all(
  migrationFiles.map((file) => readFile(resolve(migrationDirectory, file), "utf8"))
);
const frontendFiles = ["app.js", "scout-workspace.js"];
const frontendSources = await Promise.all(
  frontendFiles.map((file) => readFile(resolve(root, file), "utf8"))
);

function findClosingParen(source, openIndex) {
  let depth = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") { blockComment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (ch === "\\" ) { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "-" && next === "-") { lineComment = true; i += 1; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error("Unclosed SQL function parameter list.");
}

function splitTopLevel(text) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\" ) { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === "(" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]") depth -= 1;
    else if (ch === "," && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (text.slice(start).trim()) parts.push(text.slice(start).trim());
  return parts;
}

const sqlFunctions = new Map();
for (const source of migrationSources) {
  const pattern = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi;
  for (const match of source.matchAll(pattern)) {
    const openIndex = match.index + match[0].lastIndexOf("(");
    const closeIndex = findClosingParen(source, openIndex);
    const params = source.slice(openIndex + 1, closeIndex);
    const declarations = splitTopLevel(params).filter(Boolean);
    const names = [];
    const required = [];
    for (const declaration of declarations) {
      const name = declaration.match(/^\s*([a-z_][a-z0-9_]*)\s+/i)?.[1]?.toLowerCase();
      if (!name) continue;
      names.push(name);
      if (!/\bdefault\b|:=/.test(declaration.slice(name.length))) required.push(name);
    }
    const key = match[1].toLowerCase();
    const signatures = sqlFunctions.get(key) || [];
    signatures.push({ names, required, source: migrationFiles.find((file) => source === migrationSources[migrationFiles.indexOf(file)]) || "migration" });
    sqlFunctions.set(key, signatures);
  }
}

function scanRpcCalls(source, file) {
  const calls = [];
  const marker = /\.rpc\s*\(/g;
  for (const match of source.matchAll(marker)) {
    let i = match.index + match[0].length;
    while (/\s/.test(source[i] || "")) i += 1;
    const quote = source[i];
    if (quote !== "'" && quote !== '"') continue;
    i += 1;
    const nameStart = i;
    while (i < source.length && source[i] !== quote) {
      if (source[i] === "\\") i += 1;
      i += 1;
    }
    const name = source.slice(nameStart, i);
    i += 1;
    while (/\s/.test(source[i] || "")) i += 1;
    if (source[i] !== ",") continue;
    i += 1;
    while (/\s/.test(source[i] || "")) i += 1;
    if (source[i] !== "{") {
      calls.push({ file, name, dynamic: true, keys: [], spread: true });
      continue;
    }
    const objectStart = i;
    let depth = 0;
    let string = null;
    let lineComment = false;
    let blockComment = false;
    for (; i < source.length; i += 1) {
      const ch = source[i], next = source[i + 1];
      if (lineComment) { if (ch === "\n") lineComment = false; continue; }
      if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i += 1; } continue; }
      if (string) {
        if (ch === "\\") { i += 1; continue; }
        if (ch === string) string = null;
        continue;
      }
      if (ch === "/" && next === "/") { lineComment = true; i += 1; continue; }
      if (ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
      if (ch === "'" || ch === '"' || ch === "`") { string = ch; continue; }
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const objectBody = source.slice(objectStart + 1, i);
    const keys = [...objectBody.matchAll(/(?:^|[,\n])\s*(p_[a-z0-9_]+)\s*:/gi)].map((x) => x[1].toLowerCase());
    calls.push({ file, name, dynamic: false, keys, spread: /\.\.\./.test(objectBody) });
  }
  return calls;
}

const calls = frontendSources.flatMap((source, index) => scanRpcCalls(source, frontendFiles[index]));
const errors = [];
let checked = 0;
for (const call of calls) {
  const signatures = sqlFunctions.get(call.name.toLowerCase());
  if (!signatures?.length) {
    errors.push(call.file + ": RPC " + call.name + " has no SQL function definition in migrations.");
    continue;
  }
  const compatible = signatures.find((signature) => {
    const available = new Set(signature.names);
    if (!call.keys.every((key) => available.has(key))) return false;
    if (!call.spread && !call.dynamic) {
      const supplied = new Set(call.keys);
      return signature.required.every((key) => supplied.has(key));
    }
    return true;
  });
  if (!compatible) {
    const detail = signatures.map((signature) =>
      "expected [" + signature.required.join(", ") + "] required / [" + signature.names.join(", ") + "] total"
    ).join(" OR ");
    errors.push(
      call.file + ": RPC " + call.name + " has incompatible argument keys [" +
      call.keys.join(", ") + "]. SQL signature: " + detail
    );
    continue;
  }
  checked += 1;
}

assert.deepEqual(
  errors,
  [],
  "Frontend-to-SQL RPC contract mismatches detected:\n" + errors.join("\n")
);
console.log(
  "PFMS frontend/SQL RPC contract tests passed: " + checked +
  " frontend calls checked against " + sqlFunctions.size +
  " SQL RPC names across " + migrationFiles.length + " migrations."
);
