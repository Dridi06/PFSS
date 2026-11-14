import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve(process.cwd(), "supabase/migrations");
const entries = await readdir(directory, { withFileTypes: true });
const files = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort();

function closingParen(source, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === quote && source[i + 1] === quote) {
        i += 1;
        continue;
      }
      if (char === quote && source[i - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error("Unbalanced function argument list at offset " + openIndex);
}

function splitTopLevel(value) {
  const result = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (quote) {
      if (char === quote && value[i + 1] === quote) {
        i += 1;
        continue;
      }
      if (char === quote && value[i - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      result.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (value.slice(start).trim()) result.push(value.slice(start).trim());
  return result;
}

function stripDefault(value) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (quote) {
      if (char === quote && value[i + 1] === quote) {
        i += 1;
        continue;
      }
      if (char === quote && value[i - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth === 0 && /^\s*(?:default|=)\s/i.test(value.slice(i))) {
      return value.slice(0, i).trim();
    }
  }
  return value.trim();
}

function normalizeArguments(argumentText, declaration) {
  if (!argumentText.trim()) return "";
  return splitTopLevel(argumentText).map((argument) => {
    let value = declaration ? stripDefault(argument) : argument.trim();
    if (declaration) {
      value = value.replace(/^\s*(?:inout|in|out|variadic)\s+/i, "");
      const named = value.match(/^"?[a-z_][a-z0-9_]*"?\s+(.+)$/i);
      if (named) value = named[1];
    }
    return value.replace(/\s+/g, " ").trim().toLowerCase().replace(/\bpg_catalog\./g, "");
  }).join(",");
}

const sources = await Promise.all(files.map((file) => readFile(resolve(directory, file), "utf8")));
const sql = sources.join("\n");
const definitions = new Set();
const securityDefinerSignatures = new Set();

for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi)) {
  const open = match.index + match[0].lastIndexOf("(");
  const close = closingParen(sql, open);
  const tail = sql.slice(close + 1);
  if (!/^\s*returns\b/i.test(tail)) continue;
  const name = match[1].toLowerCase();
  const args = normalizeArguments(sql.slice(open + 1, close), true);
  const signature = name + "(" + args + ")";
  definitions.add(signature);

  const header = sql.slice(match.index, close + 1 + tail.search(/\breturns\b/i));
  if (/security\s+definer/i.test(header)) securityDefinerSignatures.add(signature);
}

const grants = [];
for (const match of sql.matchAll(/grant\s+execute\s+on\s+function\s+public\.([a-z0-9_]+)\s*\(/gi)) {
  const open = match.index + match[0].lastIndexOf("(");
  const close = closingParen(sql, open);
  const args = normalizeArguments(sql.slice(open + 1, close), false);
  const signature = match[1].toLowerCase() + "(" + args + ")";
  grants.push(signature);
  assert.ok(
    definitions.has(signature),
    "EXECUTE grant does not match any declared function signature: " + signature
  );
}

const revokes = new Set();
for (const match of sql.matchAll(/revoke\s+(?:all|execute)\s+on\s+function\s+public\.([a-z0-9_]+)\s*\(/gi)) {
  const open = match.index + match[0].lastIndexOf("(");
  const close = closingParen(sql, open);
  const args = normalizeArguments(sql.slice(open + 1, close), false);
  revokes.add(match[1].toLowerCase() + "(" + args + ")");
}

for (const signature of securityDefinerSignatures) {
  assert.ok(
    revokes.has(signature),
    "SECURITY DEFINER function has no signature-matched EXECUTE revoke: " + signature
  );
}

assert.ok(definitions.size > 0, "No public function signatures were inspected.");
assert.ok(grants.length > 0, "No authenticated/public function grants were inspected.");

console.log(
  "PFMS function grant smoke tests passed: " +
  definitions.size +
  " declared signatures, " +
  grants.length +
  " EXECUTE grants, " +
  securityDefinerSignatures.size +
  " SECURITY DEFINER signatures."
);
