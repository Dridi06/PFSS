import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const migrationDirectory = resolve(process.cwd(), "supabase/migrations");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const migrationSources = await Promise.all(
  migrationFiles.map((file) => readFile(resolve(migrationDirectory, file), "utf8"))
);
const sql = migrationSources.join("\n");

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
  throw new Error("Unbalanced SQL function signature at offset " + openIndex);
}

function splitTopLevel(value) {
  const parts = [];
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
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (value.slice(start).trim()) parts.push(value.slice(start).trim());
  return parts;
}

function normalizeArguments(value, declaration) {
  if (!value.trim()) return "";
  return splitTopLevel(value).map((argument) => {
    let item = argument.trim();
    if (declaration) {
      let depth = 0;
      let quote = null;
      for (let i = 0; i < item.length; i += 1) {
        const char = item[i];
        if (quote) {
          if (char === quote && item[i + 1] === quote) {
            i += 1;
            continue;
          }
          if (char === quote && item[i - 1] !== "\\") quote = null;
          continue;
        }
        if (char === "'" || char === '"') quote = char;
        else if (char === "(") depth += 1;
        else if (char === ")") depth -= 1;
        else if (depth === 0 && /^\s*(?:default|=)\s/i.test(item.slice(i))) {
          item = item.slice(0, i).trim();
          break;
        }
      }
      item = item.replace(/^\s*(?:inout|in|out|variadic)\s+/i, "");
      const named = item.match(/^"?[a-z_][a-z0-9_]*"?\s+(.+)$/i);
      if (named) item = named[1];
    }
    return item.replace(/\s+/g, " ").trim().toLowerCase().replace(/\bpg_catalog\./g, "");
  }).join(",");
}

const securityDefinerSignatures = new Set();
for (const match of sql.matchAll(
  /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi
)) {
  const open = match.index + match[0].lastIndexOf("(");
  const close = closingParen(sql, open);
  const tail = sql.slice(close + 1);
  if (!/^\s*returns\b/i.test(tail)) continue;
  const signature = match[1].toLowerCase() + "(" +
    normalizeArguments(sql.slice(open + 1, close), true) + ")";
  const bodyStart = tail.search(/\bas\s+(?:\$\$|\$[a-z_][a-z0-9_]*\$)/i);
  assert.notEqual(bodyStart, -1, "Function body delimiter missing: " + signature);
  const header = sql.slice(match.index, close + 1) + tail.slice(0, bodyStart);
  if (/\bsecurity\s+definer\b/i.test(header)) {
    securityDefinerSignatures.add(signature);
  }
}

assert.ok(securityDefinerSignatures.size > 0, "No SECURITY DEFINER signatures were discovered.");

// PostgreSQL grants EXECUTE to PUBLIC by default. Model the final ACL state
// in migration order so a later GRANT cannot silently undo an earlier REVOKE.
const aclState = new Map();
for (const signature of securityDefinerSignatures) {
  aclState.set(signature, { public: true, anon: false, history: [] });
}

const aclPattern = /\b(grant|revoke)\s+(all(?:\s+privileges)?|execute)\s+on\s+function\s+public\.([a-z0-9_]+)\s*\(/gi;
for (const match of sql.matchAll(aclPattern)) {
  const open = match.index + match[0].lastIndexOf("(");
  const close = closingParen(sql, open);
  const signature = match[3].toLowerCase() + "(" +
    normalizeArguments(sql.slice(open + 1, close), false) + ")";
  const state = aclState.get(signature);
  if (!state) continue;

  const tail = sql.slice(close + 1).match(/^\s*(to|from)\s+([^;]+);/i);
  assert.ok(tail, "Malformed function ACL statement for " + signature);
  const direction = tail[1].toLowerCase();
  const roles = splitTopLevel(tail[2])
    .map((role) => role.replace(/\b(?:cascade|restrict|with\s+grant\s+option)\b/gi, "").trim().replace(/^"|"$/g, "").toLowerCase());

  for (const role of roles) {
    if (role === "public") state.public = direction === "to";
    if (role === "anon") state.anon = direction === "to";
  }
  state.history.push(match[0] + tail[0]);
}

for (const [signature, state] of aclState) {
  assert.equal(
    state.public,
    false,
    "SECURITY DEFINER function remains executable by PUBLIC (including inherited public grants): " + signature +
      "\nACL history: " + state.history.join(" | ")
  );
  assert.equal(
    state.anon,
    false,
    "SECURITY DEFINER function remains directly executable by anon: " + signature +
      "\nACL history: " + state.history.join(" | ")
  );
}

// Broad grants and default privileges can re-open access independently of
// individual function ACL statements, so they are forbidden for browser roles.
assert.doesNotMatch(
  sql,
  /\bgrant\s+(?:all(?:\s+privileges)?|execute)\s+on\s+all\s+functions\s+in\s+schema\s+public\s+to\s+[^;]*\b(?:public|anon)\b/i,
  "A broad schema-level function grant must not expose SECURITY DEFINER RPCs."
);
for (const statement of sql.matchAll(/\balter\s+default\s+privileges\b[^;]*;/gi)) {
  assert.doesNotMatch(
    statement[0],
    /\bgrant\s+(?:all(?:\s+privileges)?|execute)\s+on\s+functions\s+to\s+[^;]*\b(?:public|anon)\b/i,
    "Default privileges must not grant future functions to PUBLIC or anon."
  );
}

console.log(
  "PFSS effective SECURITY DEFINER ACL audit passed: " +
  securityDefinerSignatures.size + " function signatures across " +
  migrationFiles.length + " ordered migrations; PUBLIC and anon EXECUTE denied."
);
