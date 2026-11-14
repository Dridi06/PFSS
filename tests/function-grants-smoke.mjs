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


// Notifications remain private to each recipient and browser updates are read-only.
const teamTaskNotifications = (
  await readFile(resolve(directory, "20261207_pfms_in_app_notifications.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(teamTaskNotifications, /recipient_id = auth\.uid\(\)/);
assert.match(teamTaskNotifications, /grant update \(is_read\) on table public\.pfms_notifications to authenticated/);
assert.match(teamTaskNotifications, /security definer set search_path = ''/);
assert.match(teamTaskNotifications, /after insert or update of assigned_to, status on public\.pfms_legacy_team_tasks/);
assert.match(teamTaskNotifications, /new\.assigned_to is distinct from v_actor_id/);
assert.match(teamTaskNotifications, /new\.status = 'done' and old\.status is distinct from 'done'/);
assert.match(teamTaskNotifications, /revoke all on function public\.pfms_notify_legacy_team_task_changes\(\) from public, anon, authenticated/);
assert.doesNotMatch(teamTaskNotifications, /grant (?:insert|delete|all) on table public\.pfms_notifications to authenticated/);

const supportNotifications = (
  await readFile(resolve(directory, "20261208_pfms_support_ticket_notifications.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(supportNotifications, /new\.owner_id is not null and new\.owner_id is distinct from v_actor_id/);
assert.match(supportNotifications, /new\.admin_response is distinct from old\.admin_response/);
assert.match(supportNotifications, /new\.status = 'resolved' and old\.status is distinct from 'resolved'/);
assert.match(supportNotifications, /after update of admin_response, status on public\.pfms_support_tickets/);
assert.match(supportNotifications, /revoke all on function public\.pfms_notify_support_ticket_changes\(\) from public, anon, authenticated/);


// Protect training, attendance, matchday lineups and tactical analysis boundaries.
const legacyTeamTraining = (
  await readFile(resolve(directory, "20261123_pfms_legacy_team_training.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyTeamTraining, /pfms_has_legacy_team_permission\(p_team_id, 'training', 'view'\)/);
assert.match(legacyTeamTraining, /pfms_has_legacy_team_permission\(p_team_id, 'training', 'edit'\)/);
assert.match(legacyTeamTraining, /pfms_has_legacy_team_permission\(v_team_id, 'attendance', 'edit'\)/);
assert.match(legacyTeamTraining, /v_assignment_team_id <> v_team_id/);
assert.match(legacyTeamTraining, /p_attendance_status not in \('pending','present','absent','excused','injured','late'\)/);
assert.match(legacyTeamTraining, /if p_attendance_status = 'pending' then delete from public\.pfms_legacy_training_attendance/);
assert.match(legacyTeamTraining, /force row level security/);
assert.doesNotMatch(legacyTeamTraining, /grant (?:insert|update|delete|all) on table public\.pfms_legacy_training_attendance to authenticated/);

const legacyTeamMatches = (
  await readFile(resolve(directory, "20261125_pfms_legacy_team_matches.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyTeamMatches, /pfms_has_legacy_team_permission\(p_team_id, 'matches', 'edit'\)/);
assert.match(legacyTeamMatches, /pfms_has_legacy_team_permission\(v_team_id, 'matches', 'edit'\)/);
assert.match(legacyTeamMatches, /pfms_has_legacy_team_permission\(v_team_id, 'matches', 'view'\)/);
assert.match(legacyTeamMatches, /tp\.team_id = v_team_id/);
assert.match(legacyTeamMatches, /tp\.squad_status in \('active','injured','loaned'\)/);
assert.match(legacyTeamMatches, /v_starters > 11 or v_captains > 1/);
assert.match(legacyTeamMatches, /duplicate player assignments are not allowed/);
assert.match(legacyTeamMatches, /every lineup player must belong to the selected team/);
assert.match(legacyTeamMatches, /force row level security/);
assert.doesNotMatch(legacyTeamMatches, /grant (?:insert|update|delete|all) on table public\.pfms_legacy_team_match_lineup to authenticated/);

const legacyTeamAnalysis = (
  await readFile(resolve(directory, "20261202_pfms_legacy_team_analysis.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyTeamAnalysis, /foreign key \(match_id, team_id\) references public\.pfms_legacy_team_matches\(id, team_id\)/);
assert.match(legacyTeamAnalysis, /m\.id = p_match_id and m\.team_id = p_team_id/);
assert.match(legacyTeamAnalysis, /pfms_has_legacy_team_permission\(p_team_id, 'analysis', 'view'\)/);
assert.match(legacyTeamAnalysis, /pfms_has_legacy_team_permission\(p_team_id, 'analysis', 'edit'\)/);
assert.match(legacyTeamAnalysis, /pfms_has_legacy_team_permission\(v_team_id, 'analysis', 'edit'\)/);
assert.match(legacyTeamAnalysis, /force row level security/);
assert.doesNotMatch(legacyTeamAnalysis, /grant (?:insert|update|delete|all) on table public\.pfms_legacy_team_analysis to authenticated/);

// Ensure the existing application calls the secured RPCs rather than requiring
// direct client-side writes to these operational tables.
const applicationSource = await readFile(resolve(process.cwd(), "app.js"), "utf8");
for (const rpc of [
  "pfms_list_legacy_team_training",
  "pfms_create_legacy_team_training",
  "pfms_update_legacy_team_training",
  "pfms_list_legacy_training_attendance",
  "pfms_mark_legacy_training_attendance",
  "pfms_list_legacy_team_matches",
  "pfms_create_legacy_team_match",
  "pfms_update_legacy_team_match",
  "pfms_list_legacy_team_match_lineup",
  "pfms_list_legacy_team_match_candidates",
  "pfms_save_legacy_team_match_lineup",
  "pfms_list_legacy_team_analysis",
  "pfms_create_legacy_team_analysis",
  "pfms_update_legacy_team_analysis",
  "pfms_delete_legacy_team_analysis"
]) {
  assert.ok(applicationSource.includes(rpc), "Application is missing secured RPC integration: " + rpc);
}


// Protect team events, participants, event logistics and transport planning.
const legacyTeamEvents = (
  await readFile(resolve(directory, "20261203_pfms_legacy_team_events.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyTeamEvents, /pfms_has_legacy_team_permission\(p_team_id, 'events', 'view'\)/);
assert.match(legacyTeamEvents, /pfms_has_legacy_team_permission\(p_team_id, 'events', 'edit'\)/);
assert.match(legacyTeamEvents, /p_event_type not in \('tournament','event'\)/);
assert.match(legacyTeamEvents, /delete from public\.pfms_legacy_team_calendar_events/);
assert.match(legacyTeamEvents, /event_type in \('tournament','event'\)/);

const legacyEventParticipants = (
  await readFile(resolve(directory, "20261204_pfms_legacy_team_event_participants.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyEventParticipants, /foreign key \(event_id, team_id\) references public\.pfms_legacy_team_calendar_events\(id, team_id\)/);
assert.match(legacyEventParticipants, /foreign key \(team_player_assignment_id, team_id\) references public\.pfms_legacy_team_players\(id, team_id\)/);
assert.match(legacyEventParticipants, /pfms_has_legacy_team_permission\(v_team_id, 'events', 'edit'\)/);
assert.match(legacyEventParticipants, /selected player is not an active member of this team/);
assert.match(legacyEventParticipants, /status not in \('invited','confirmed','declined','attended','absent'\)/);
assert.match(legacyEventParticipants, /force row level security/);

const legacyEventLogistics = (
  await readFile(resolve(directory, "20261205_pfms_legacy_team_event_logistics.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyEventLogistics, /foreign key \(event_id, team_id\) references public\.pfms_legacy_team_calendar_events\(id, team_id\)/);
assert.match(legacyEventLogistics, /pfms_has_legacy_team_permission\(p_team_id, 'events', 'view'\)/);
assert.match(legacyEventLogistics, /pfms_has_legacy_team_permission\(p_team_id, 'events', 'edit'\)/);
assert.match(legacyEventLogistics, /capacity cannot be lower than the current registered participant count/);
assert.match(legacyEventLogistics, /fee_per_person/);
assert.match(legacyEventLogistics, /force row level security/);
assert.doesNotMatch(legacyEventLogistics, /grant (?:insert|update|delete|all) on table public\.pfms_legacy_team_event_logistics to authenticated/);

const legacyEventTravel = (
  await readFile(resolve(directory, "20261205_pfms_legacy_team_event_travel_plans.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyEventTravel, /foreign key \(event_id, team_id\) references public\.pfms_legacy_team_calendar_events\(id, team_id\)/);
assert.match(legacyEventTravel, /pfms_has_legacy_team_permission\(v_team_id, 'events', 'edit'\)/);
assert.match(legacyEventTravel, /seat capacity cannot be lower than the current active participant count/);
assert.match(legacyEventTravel, /transport vehicle is at seat capacity/);
assert.match(legacyEventTravel, /on conflict \(event_id\) do update/);
assert.match(legacyEventTravel, /force row level security/);
assert.doesNotMatch(legacyEventTravel, /grant (?:insert|update|delete|all) on table public\.pfms_legacy_team_event_travel_plans to authenticated/);

// The UI must use the permission-checked RPC interface for event operations.
for (const rpc of [
  "pfms_list_legacy_team_events_with_logistics",
  "pfms_create_legacy_team_calendar_event",
  "pfms_update_legacy_team_calendar_event",
  "pfms_delete_legacy_team_event",
  "pfms_list_legacy_team_event_participants",
  "pfms_list_legacy_team_event_player_options",
  "pfms_add_legacy_team_event_participant",
  "pfms_update_legacy_team_event_participant",
  "pfms_remove_legacy_team_event_participant",
  "pfms_list_legacy_team_events_with_logistics",
  "pfms_save_legacy_team_event",
  "pfms_list_legacy_team_event_travel_plans",
  "pfms_save_legacy_team_event_travel_plan",
  "pfms_delete_legacy_team_event_travel_plan"
]) {
  assert.ok(applicationSource.includes(rpc), "Application is missing secured event RPC integration: " + rpc);
}


// Protect training-cycle planning, week/session assignment and exercise plans.
const legacyTrainingCycles = (
  await readFile(resolve(directory, "20261201_pfms_legacy_training_cycles.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyTrainingCycles, /pfms_has_legacy_team_permission\(p_team_id, 'training', 'view'\)/);
assert.match(legacyTrainingCycles, /pfms_has_legacy_team_permission\(p_team_id, 'training', 'edit'\)/);
assert.match(legacyTrainingCycles, /p_end_date > p_start_date \+ 363/);
assert.match(legacyTrainingCycles, /v_week_team_id <> v_team_id/);
assert.match(legacyTrainingCycles, /v_session_date < v_week_start or v_session_date > v_week_end/);
assert.match(legacyTrainingCycles, /force row level security/);
assert.doesNotMatch(legacyTrainingCycles, /grant (?:insert|update|delete|all) on table public\.pfms_legacy_training_cycles to authenticated/);

const legacyTrainingExercises = (
  await readFile(resolve(directory, "20261126_pfms_legacy_training_exercises.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(legacyTrainingExercises, /pfms_has_legacy_team_permission\(p_team_id, 'training', 'view'\)/);
assert.match(legacyTrainingExercises, /pfms_has_legacy_team_permission\(p_team_id, 'training', 'edit'\)/);
assert.match(legacyTrainingExercises, /p_category not in \('warmup','technical','tactical','physical','finishing','cooldown','other'\)/);
assert.match(legacyTrainingExercises, /exercise is used in a training plan and cannot be deleted/);
assert.match(legacyTrainingExercises, /jsonb_array_length\(p_items\) > 30/);
assert.match(legacyTrainingExercises, /force row level security/);
assert.doesNotMatch(legacyTrainingExercises, /grant (?:insert|update|delete|all) on table public\.pfms_legacy_team_training_exercises to authenticated/);

for (const rpc of [
  "pfms_list_legacy_training_cycles",
  "pfms_create_legacy_training_cycle",
  "pfms_update_legacy_training_cycle_week",
  "pfms_update_legacy_training_cycle_status",
  "pfms_assign_legacy_training_session_cycle_week",
  "pfms_list_legacy_team_training_exercises",
  "pfms_create_legacy_team_training_exercise",
  "pfms_update_legacy_team_training_exercise",
  "pfms_delete_legacy_team_training_exercise",
  "pfms_list_legacy_training_session_exercises",
  "pfms_save_legacy_training_session_exercises"
]) {
  assert.ok(applicationSource.includes(rpc), "Application is missing secured training RPC integration: " + rpc);
}


// Private scout workspaces must enforce RLS and keep media attached to the
// authenticated scout's own player records and storage folder.
const scoutWorkspaceHardening = (
  await readFile(
    resolve(directory, "20261209_pfss_scout_workspace_isolation_hardening.sql"),
    "utf8"
  )
).replace(/\s+/g, " ").toLowerCase();
assert.match(scoutWorkspaceHardening, /alter table public\.pfss_scout_players force row level security/);
assert.match(scoutWorkspaceHardening, /alter table public\.pfss_scout_reports force row level security/);
assert.match(scoutWorkspaceHardening, /alter table public\.pfss_scout_media force row level security/);
assert.match(scoutWorkspaceHardening, /owner_id = auth\.uid\(\)/);
assert.match(scoutWorkspaceHardening, /storage_path ~ \('\^' \|\| auth\.uid\(\)::text \|\| '\/\[\^\/\]\+\$'\)/);
assert.match(scoutWorkspaceHardening, /p\.id = player_id and p\.owner_id = auth\.uid\(\)/);
assert.match(scoutWorkspaceHardening, /pfss_scout_media_mime_type_allowlist/);
assert.match(scoutWorkspaceHardening, /'image\/jpeg'.*'video\/webm'/);


// Authentication lifecycle: signup provisioning, invitation redemption and
// first-owner bootstrap must remain server-triggered and privilege-restricted.
const usernameRegistration = (
  await readFile(resolve(directory, "20261110_username_registration.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(usernameRegistration, /create trigger pfss_sync_signup_username after insert on auth\.users/);
assert.match(usernameRegistration, /requested_username !~ '\^\[a-za-z0-9_\.-\]\{3,20\}\$'/);
assert.match(usernameRegistration, /on conflict \(id\) do update set username = excluded\.username/);
assert.doesNotMatch(usernameRegistration, /set username = excluded\.username,\s*role\s*=|set username = excluded\.username,\s*status\s*=/);

const ownerBootstrapGuard = (
  await readFile(resolve(directory, "20261116_pfms_owner_bootstrap_registration_guard.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(ownerBootstrapGuard, /create trigger pfms_register_owner_bootstrap_request after insert on auth\.users/);
assert.match(ownerBootstrapGuard, /revoke all on table public\.pfms_owner_bootstrap_requests from public, anon, authenticated/);
assert.match(ownerBootstrapGuard, /coalesce\(auth\.role\(\), ''\) <> 'service_role'/);
assert.match(ownerBootstrapGuard, /grant execute on function public\.pfms_claim_initial_owner\(uuid\) to service_role/);
assert.match(ownerBootstrapGuard, /for update/);
assert.match(ownerBootstrapGuard, /claimed_at is null/);

const authTriggerHardening = (
  await readFile(resolve(directory, "20261130_pfms_auth_trigger_hardening.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(authTriggerHardening, /security definer set search_path = ''/);
assert.match(authTriggerHardening, /revoke all on function public\.pfss_sync_signup_username\(\) from public, anon, authenticated/);
assert.match(authTriggerHardening, /revoke all on function public\.pfms_provision_new_account\(\) from public, anon, authenticated/);
assert.match(authTriggerHardening, /v_type in \('club','agency'\)/);
assert.match(authTriggerHardening, /elsif v_type='scout'/);

const invitationStatusGuard = (
  await readFile(resolve(directory, "20261131_pfms_legacy_invitation_status_guard.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(invitationStatusGuard, /registration_type', ''\)\) <> 'user'/);
assert.match(invitationStatusGuard, /i\.redeemed_at is null/);
assert.match(invitationStatusGuard, /i\.revoked_at is null/);
assert.match(invitationStatusGuard, /i\.expires_at > pg_catalog\.now\(\)/);
assert.match(invitationStatusGuard, /for update/);
assert.match(invitationStatusGuard, /for share/);
assert.match(invitationStatusGuard, /v_org_status not in \('approved','active'\)/);
assert.match(invitationStatusGuard, /membership already exists/);
assert.match(invitationStatusGuard, /revoke all on function public\.pfms_apply_legacy_invitation\(\) from public, anon, authenticated/);

const usernameLogin = await readFile(
  resolve(process.cwd(), "supabase/functions/username-login/index.ts"),
  "utf8"
);
assert.match(usernameLogin, /rawBody\.length > 8192/);
assert.match(usernameLogin, /suppliedPassword\.length > 1024/);
assert.match(usernameLogin, /cors\.allowed/);
assert.match(usernameLogin, /Cache-Control.*no-store/);
assert.match(usernameLogin, /select\("id"\)/);
assert.match(usernameLogin, /auth\.signInWithPassword/);
assert.doesNotMatch(usernameLogin, /console\.log\([^\n]*(?:password|access_token|refresh_token)/i);

const ownerBootstrapFunction = await readFile(
  resolve(process.cwd(), "supabase/functions/pfms-owner-bootstrap/index.ts"),
  "utf8"
);
assert.match(ownerBootstrapFunction, /constantTimeEqual/);
assert.match(ownerBootstrapFunction, /email_confirmed_at/);
assert.match(ownerBootstrapFunction, /user_metadata\?\.registration_type !== "owner_bootstrap"/);
assert.match(ownerBootstrapFunction, /auth\.getUser\(\)/);
assert.match(ownerBootstrapFunction, /pfms_claim_initial_owner/);
assert.doesNotMatch(ownerBootstrapFunction, /payload[^\n]*user_id/);


// Username login must return only the session material consumed by the browser.
// In particular, do not expose Supabase's user object (which includes the email).
assert.match(usernameLogin, /access_token: sessionData\.session\.access_token/);
assert.match(usernameLogin, /refresh_token: sessionData\.session\.refresh_token/);
assert.doesNotMatch(usernameLogin, /user:\s*sessionData\.user/);
assert.match(usernameLogin, /Ratelimit\.slidingWindow\(5, "15 m"\)/);
assert.match(usernameLogin, /limiter\.getRemaining\(rateLimitIdentifier\)/);
assert.match(usernameLogin, /const invalidCredentials = async/);
assert.match(usernameLogin, /return await invalidCredentials\(\)/);
assert.match(usernameLogin, /UPSTASH_REDIS_REST_URL/);
assert.match(usernameLogin, /UPSTASH_REDIS_REST_TOKEN/);
assert.match(usernameLogin, /PFMS_RATE_LIMIT_HMAC_KEY/);
assert.match(usernameLogin, /crypto\.subtle\.sign\([\s\S]*?"HMAC"/);
assert.match(usernameLogin, /\},\s*429,\s*\{/);
assert.match(usernameLogin, /"Retry-After"/);
assert.match(usernameLogin, /Login service temporarily unavailable/);
assert.doesNotMatch(usernameLogin, /x-forwarded-for|cf-connecting-ip|x-real-ip/i);

// Protect personal notification privacy and the narrow read-state-only update grant.
const notifications = (
  await readFile(resolve(directory, "20261207_pfms_in_app_notifications.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(notifications, /alter table public\.pfms_notifications enable row level security/);
assert.match(notifications, /alter table public\.pfms_notifications force row level security/);
assert.match(notifications, /recipient_id = auth\.uid\(\)/);
assert.match(notifications, /grant select on public\.pfms_notifications to authenticated/);
assert.match(notifications, /grant update \(is_read\) on public\.pfms_notifications to authenticated/);
assert.doesNotMatch(notifications, /grant (?:insert|delete|update) on public\.pfms_notifications to authenticated/);
assert.match(notifications, /revoke all on table public\.pfms_notifications from public, anon, authenticated/);
assert.match(notifications, /revoke all on function public\.pfms_notify_legacy_team_task_changes\(\) from public, anon, authenticated/);

// Support tickets are owner-scoped, throttled transactionally, and admin-managed.
const supportTickets = (
  await readFile(resolve(directory, "20261129_pfms_support_tickets.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(supportTickets, /pg_advisory_xact_lock/);
assert.match(supportTickets, /v_recent_count >= 10/);
assert.match(supportTickets, /interval '24 hours'/);
assert.match(supportTickets, /owner_id = auth\.uid\(\)/);
assert.match(supportTickets, /or public\.pfms_is_admin\(\)/);
assert.match(supportTickets, /grant update \(status, admin_response\) on public\.pfms_support_tickets to authenticated/);

// Private scout media must remain tied to the authenticated owner and their own player.
const scoutIsolation = (
  await readFile(resolve(directory, "20261209_pfss_scout_workspace_isolation_hardening.sql"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(scoutIsolation, /alter table public\.pfss_scout_media force row level security/);
assert.match(scoutIsolation, /owner_id = auth\.uid\(\)/);
assert.match(scoutIsolation, /split_part\(storage_path, '\/', 1\) = auth\.uid\(\)::text/);
assert.match(scoutIsolation, /p\.owner_id = auth\.uid\(\)/);

// Privileged R2 connectivity checks require both a verified JWT and server-side admin status.
const r2Check = (
  await readFile(resolve(process.cwd(), "supabase/functions/r2-connection-check/index.ts"), "utf8")
).replace(/\s+/g, " ").toLowerCase();
assert.match(r2Check, /auth\.getuser\(\)/);
assert.match(r2Check, /rpc\("pfms_is_admin"\)/);
assert.match(r2Check, /adminerror \|\| isadmin !== true/);
assert.match(
  (await readFile(resolve(process.cwd(), "supabase/config.toml"), "utf8"))
    .replace(/\s+/g, " ").toLowerCase(),
  /\[functions\.r2-connection-check\] verify_jwt = true/
);

