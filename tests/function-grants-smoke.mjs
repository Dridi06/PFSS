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

  // SECURITY DEFINER appears after RETURNS in PostgreSQL declarations.
  // Inspect the full declaration up to AS $ (or a named dollar-quote body).
  const bodyStart = tail.search(/\bas\s+(?:\$\$|\$[a-z_][a-z0-9_]*\$)/i);
  assert.notEqual(bodyStart, -1, "Function body delimiter not found for " + signature);
  const header = sql.slice(match.index, close + 1) + tail.slice(0, bodyStart);
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

// Protect the legacy organization-manager authorization from privilege broadening.
const managerGuard = await readFile(
  resolve(directory, "20261118_pfms_legacy_org_manager_guard.sql"),
  "utf8"
);
const normalizedManagerGuard = managerGuard.replace(/\s+/g, " ").toLowerCase();
assert.match(
  normalizedManagerGuard,
  /create or replace function public\.can_manage_org\s*\(p_organization_id uuid\)/
);
assert.match(normalizedManagerGuard, /security definer set search_path = ''/);
assert.match(normalizedManagerGuard, /auth\.uid\(\) is not null/);
assert.match(normalizedManagerGuard, /m\.user_id = auth\.uid\(\)/);
assert.match(normalizedManagerGuard, /m\.status = 'active'/);
assert.match(
  normalizedManagerGuard,
  /m\.role in \('owner', 'club_admin', 'agency_admin'\)/
);
assert.match(
  normalizedManagerGuard,
  /revoke all on function public\.can_manage_org\(uuid\) from public, anon/
);
assert.match(
  normalizedManagerGuard,
  /grant execute on function public\.can_manage_org\(uuid\) to authenticated/
);

const invitationMigration = (
  await readFile(resolve(directory, "20261111_fix_invitation_admin_access.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(
  invitationMigration,
  /public\.is_admin\(\) or public\.can_manage_org\(p_organization_id\)/
);

const stagingAcceptance = (
  await readFile(resolve(process.cwd(), "supabase/STAGING_ACCEPTANCE_READ_ONLY.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(stagingAcceptance, /'legacy_org_manager_guard'/);
assert.match(stagingAcceptance, /'legacy_invitation_manager_authorization'/);
assert.match(stagingAcceptance, /pg_catalog\.aclexplode\(/);
assert.match(stagingAcceptance, /a\.grantee = 0 and a\.privilege_type = 'execute'/);
assert.match(stagingAcceptance, /has_function_privilege\('authenticated'/);
assert.match(stagingAcceptance, /has_function_privilege\('anon'/);

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



// Protect the legacy team boundary and role-based operational permissions.
const legacyTeamManagement = (
  await readFile(
    resolve(directory, "20261121_pfms_legacy_team_management.sql"),
    "utf8"
  )
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyTeamManagement, /create or replace function public\.pfms_can_access_legacy_team\(p_team_id uuid\)/);
assert.match(legacyTeamManagement, /auth\.uid\(\) is not null/);
assert.match(legacyTeamManagement, /s\.user_id = auth\.uid\(\)/);
assert.match(legacyTeamManagement, /s\.status = 'active'/);
assert.match(legacyTeamManagement, /s\.role = 'trainer'/);
assert.match(legacyTeamManagement, /public\.can_manage_org\(t\.organization_id\)/);
assert.match(legacyTeamManagement, /v_org_type <> 'club'/);
assert.match(legacyTeamManagement, /v_org_status not in \('approved','active'\)/);
assert.match(legacyTeamManagement, /m\.status = 'active' and m\.role = p_role/);
assert.match(legacyTeamManagement, /revoke all on function public\.pfms_can_manage_legacy_team\(uuid\) from public, anon/);
assert.match(legacyTeamManagement, /grant execute on function public\.pfms_can_manage_legacy_team\(uuid\) to authenticated/);

const legacyTeamPermissions = (
  await readFile(
    resolve(directory, "20261122_pfms_legacy_team_permissions.sql"),
    "utf8"
  )
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyTeamPermissions, /create or replace function public\.pfms_save_legacy_team_permissions\s*\(\s*p_assignment_id uuid,\s*p_permissions jsonb\s*\)/);
assert.match(legacyTeamPermissions, /if not public\.pfms_can_manage_legacy_team\(v_team_id\) then/);
assert.match(legacyTeamPermissions, /jsonb_array_length\(p_permissions\) <> 8/);
assert.match(legacyTeamPermissions, /v_can_edit and not v_can_view/);
assert.match(legacyTeamPermissions, /p\.can_edit/);
assert.match(legacyTeamPermissions, /p_action in \('view','edit'\)/);


// Protect finance ledger access, validation and non-destructive correction.
const legacyTeamFinance = (
  await readFile(resolve(directory, "20261127_pfms_legacy_team_finance.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyTeamFinance, /enable row level security; alter table public\.pfms_legacy_team_finance_entries force row level security/);
assert.match(legacyTeamFinance, /pfms_has_legacy_team_permission\(team_id, 'finance', 'view'\)/);
assert.match(legacyTeamFinance, /pfms_has_legacy_team_permission\(p_team_id, 'finance', 'edit'\)/);
assert.match(legacyTeamFinance, /amount > 0 and amount <= 1000000/);
assert.match(legacyTeamFinance, /status = 'voided'.*voided_by is not null/);
assert.match(legacyTeamFinance, /only posted finance entries can be voided/);
assert.match(legacyTeamFinance, /revoke all on table public\.pfms_legacy_team_finance_entries from public, anon, authenticated/);
assert.match(legacyTeamFinance, /grant select on table public\.pfms_legacy_team_finance_entries to authenticated/);
assert.doesNotMatch(legacyTeamFinance, /grant (?:insert|update|delete|all) on table public\.pfms_legacy_team_finance_entries to authenticated/);

// Protect the ninth team permission module and same-team task assignment boundary.
const legacyTeamTasks = (
  await readFile(resolve(directory, "20261206_pfms_legacy_team_tasks.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyTeamTasks, /'analysis','tasks'/);
assert.match(legacyTeamTasks, /jsonb_array_length\(p_permissions\) <> 9/);
assert.match(legacyTeamTasks, /'tasks'\s*\)\s*and p_action in \('view','edit'\)/);
assert.match(legacyTeamTasks, /foreign key \(team_id, assigned_to\) references public\.pfms_legacy_team_staff\(team_id, user_id\)/);
assert.match(legacyTeamTasks, /s\.team_id = p_team_id and s\.user_id = p_assigned_to and s\.status = 'active'/);
assert.match(legacyTeamTasks, /pfms_has_legacy_team_permission\(p_team_id, 'tasks', 'view'\)/);
assert.match(legacyTeamTasks, /pfms_has_legacy_team_permission\(v_team_id, 'tasks', 'edit'\)/);
assert.match(legacyTeamTasks, /alter table public\.pfms_legacy_team_tasks force row level security/);
assert.match(legacyTeamTasks, /revoke all on table public\.pfms_legacy_team_tasks from public, anon, authenticated/);
assert.match(legacyTeamTasks, /grant select on table public\.pfms_legacy_team_tasks to authenticated/);

// Event participation must remain scoped to both the event's team and its roster.
const legacyTeamEventParticipants = (
  await readFile(resolve(directory, "20261204_pfms_legacy_team_event_participants.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyTeamEventParticipants, /foreign key \(event_id, team_id\) references public\.pfms_legacy_team_calendar_events\(id, team_id\)/);
assert.match(legacyTeamEventParticipants, /foreign key \(team_player_assignment_id, team_id\) references public\.pfms_legacy_team_players\(id, team_id\)/);
assert.match(legacyTeamEventParticipants, /pfms_has_legacy_team_permission\(v_team_id, 'events', 'edit'\)/);
assert.match(legacyTeamEventParticipants, /selected player is not an active member of this team/);
assert.match(legacyTeamEventParticipants, /alter table public\.pfms_legacy_team_event_participants force row level security/);
