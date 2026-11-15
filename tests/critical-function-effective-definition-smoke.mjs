import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve(process.cwd(), "supabase/migrations");
const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();

function closingParen(source, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === quote && source[i + 1] === quote) { i += 1; continue; }
      if (char === quote && source[i - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")" && --depth === 0) return i;
  }
  throw new Error("Unbalanced function signature at " + openIndex);
}

const contracts = {
  can_manage_org: {
    file: "20261222_pfms_legacy_org_manager_active_org_gate.sql",
    checks: [
      /security\s+definer/i, /set\s+search_path\s*=\s*''/i,
      /o\.status\s+in\s*\('approved',\s*'active'\)/i,
      /m\.user_id\s*=\s*auth\.uid\(\)/i, /m\.status\s*=\s*'active'/i,
      /m\.role\s+in\s*\('owner',\s*'club_admin',\s*'agency_admin'\)/i
    ]
  },
  pfms_can_access_legacy_team: {
    file: "20261227_pfms_legacy_team_access_null_guard.sql",
    checks: [
      /security\s+definer/i, /set\s+search_path\s*=\s*''/i,
      /p_team_id\s+is\s+not\s+null/i, /where\s+t\.id\s*=\s*p_team_id/i,
      /o\.status\s+in\s*\('approved',\s*'active'\)/i,
      /m\.status\s*=\s*'active'/i
    ]
  },
  pfms_can_manage_legacy_team: {
    file: "20261227_pfms_legacy_team_access_null_guard.sql",
    checks: [
      /security\s+definer/i, /set\s+search_path\s*=\s*''/i,
      /p_team_id\s+is\s+not\s+null/i, /where\s+t\.id\s*=\s*p_team_id/i,
      /s\.role\s*=\s*'trainer'/i, /m\.role\s*=\s*'trainer'/i,
      /m\.status\s*=\s*'active'/i
    ]
  }
};

const latest = new Map();
for (const file of files) {
  const source = await readFile(resolve(directory, file), "utf8");
  for (const match of source.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi)) {
    const name = match[1].toLowerCase();
    if (!contracts[name]) continue;
    const open = match.index + match[0].lastIndexOf("(");
    const close = closingParen(source, open);
    const tail = source.slice(close + 1);
    const bodyStart = tail.search(/\bas\s+(?:\$\$|\$[a-z_][a-z0-9_]*\$)/i);
    assert.notEqual(bodyStart, -1, "Missing body delimiter for " + name);
    const header = source.slice(match.index, close + 1) + tail.slice(0, bodyStart);
    const tag = tail.slice(bodyStart).match(/\bas\s+(\$\$|\$[a-z_][a-z0-9_]*\$)/i)[1];
    const bodyOffset = bodyStart + tail.slice(bodyStart).indexOf(tag) + tag.length;
    const bodyEnd = tail.indexOf(tag, bodyOffset);
    assert.notEqual(bodyEnd, -1, "Unterminated body for " + name);
    latest.set(name, { file, sql: header + "\n" + tail.slice(bodyOffset, bodyEnd) });
  }
}

for (const [name, contract] of Object.entries(contracts)) {
  const actual = latest.get(name);
  assert.ok(actual, "No definition found for " + name);
  assert.equal(actual.file, contract.file, "Unexpected last definition file for " + name);
  assert.match(actual.sql, /returns\s+boolean/i, name + " must return boolean");
  for (const check of contract.checks) {
    assert.match(actual.sql, check, "Final definition of " + name + " lacks " + check);
  }
}
console.log("PFSS effective critical-function definitions passed for " +
  Object.keys(contracts).join(", ") + " across " + files.length + " migrations.");
