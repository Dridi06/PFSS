import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const migrationDirectory = resolve(process.cwd(), "supabase/migrations");
const migrationFiles = [
  "20261121_pfms_legacy_team_management.sql",
  "20261121_pfms_legacy_org_membership_management.sql",
  "20261211_pfms_legacy_team_membership_scope.sql",
  "20261212_pfms_legacy_team_task_assignee_membership.sql",
  "20261215_pfms_team_permission_membership_gate.sql"
];
const migrations = await Promise.all(
  migrationFiles.map((file) => readFile(resolve(migrationDirectory, file), "utf8"))
);
const sql = migrations.join("\n");

function latestFunctionBody(name) {
  const pattern = new RegExp(
    "create\\s+(?:or\\s+replace\\s+)?function\\s+public\\." +
      name +
      "\\s*\\([\\s\\S]*?\\bas\\s+\\$\\$([\\s\\S]*?)\\$\\$;",
    "gi"
  );
  const matches = [...sql.matchAll(pattern)];
  assert.ok(matches.length, "Missing SQL function: " + name);
  return matches.at(-1)[1].replace(/\s+/g, " ").toLowerCase();
}

function assertHas(body, pattern, message) {
  assert.match(body, pattern, message);
}

const teamAccess = latestFunctionBody("pfms_can_access_legacy_team");
assertHas(teamAccess, /auth\.uid\(\)\s+is\s+not\s+null/i, "Team access must require an authenticated user.");
assertHas(teamAccess, /public\.is_admin\(\)/, "Platform administrators must retain the explicit global access path.");
assertHas(teamAccess, /join public\.organizations o on o\.id = t\.organization_id/, "Team access must resolve the owning organization.");
assertHas(teamAccess, /o\.status in \('approved', 'active'\)/, "Suspended or pending organizations must not grant team access.");
assertHas(teamAccess, /s\.status = 'active'/, "Team access must require an active staff assignment.");
assertHas(teamAccess, /m\.status = 'active'/, "Team access must require active organization membership.");
assertHas(teamAccess, /m\.role = s\.role/, "The current organization role must match the team staff assignment.");

const teamManage = latestFunctionBody("pfms_can_manage_legacy_team");
assertHas(teamManage, /public\.can_manage_org\(o\.id\)/, "Organization managers must be authorized through the owning organization.");
assertHas(teamManage, /s\.role = 'trainer'/, "Team-level management must be restricted to assigned trainers.");
assertHas(teamManage, /m\.role = 'trainer'/, "Trainer management must also match the current organization role.");
assertHas(teamManage, /m\.status = 'active'/, "Trainer management must require active organization membership.");
assertHas(teamManage, /o\.status in \('approved', 'active'\)/, "Trainer management must stop when the organization is not active.");

const permissionHelper = latestFunctionBody("pfms_has_legacy_team_permission");
assertHas(permissionHelper, /public\.pfms_can_access_legacy_team\(p_team_id\)/, "Module rights must be subordinate to current tenant/team access.");
assertHas(permissionHelper, /p_module_key in/, "Module permission helper must use an explicit module allowlist.");
assertHas(permissionHelper, /p_action in \('view', 'edit'\)/, "Module permission helper must use an explicit action allowlist.");

const staffCandidates = latestFunctionBody("pfms_list_legacy_team_staff_candidates");
assertHas(staffCandidates, /public\.pfms_can_manage_legacy_team\(p_team_id\)/, "Only team managers may enumerate staff candidates.");
assertHas(staffCandidates, /m\.organization_id = v_organization_id/, "Staff candidates must be limited to the team's organization.");
assertHas(staffCandidates, /m\.status = 'active'/, "Staff candidates must have active organization membership.");
assertHas(staffCandidates, /m\.role in \('trainer', 'co_trainer', 'betreuer'\)/, "Only operational staff roles may be assigned.");

const assignStaff = latestFunctionBody("pfms_assign_legacy_team_staff");
assertHas(assignStaff, /public\.pfms_can_manage_legacy_team\(p_team_id\)/, "Staff assignment must require team management authority.");
assertHas(assignStaff, /p_role not in \('trainer', 'co_trainer', 'betreuer'\)/, "Staff assignment must reject leadership and unrelated roles.");
assertHas(assignStaff, /m\.organization_id = v_organization_id/, "Staff assignment must use the team's organization, not a caller-supplied organization.");
assertHas(assignStaff, /m\.user_id = p_user_id/, "Staff assignment must bind the selected user.");
assertHas(assignStaff, /m\.status = 'active'/, "Staff assignment must require active membership.");
assertHas(assignStaff, /m\.role = p_role/, "Staff assignment must require exact role equality.");

const removeStaff = latestFunctionBody("pfms_remove_legacy_team_staff");
assertHas(removeStaff, /public\.pfms_can_manage_legacy_team\(v_team_id\)/, "Removing staff must require authority over the assignment's actual team.");

const updateMembership = latestFunctionBody("pfms_update_legacy_org_membership_for_manager");
assertHas(updateMembership, /public\.is_admin\(\) or public\.can_manage_org\(v_organization_id\)/, "Membership changes must be scoped to platform admins or managers of the owning organization.");
assertHas(updateMembership, /p_role not in \('scout','trainer','co_trainer','betreuer','member'\)/, "Organization managers must not promote users into leadership roles.");
assertHas(updateMembership, /v_current_role in \('owner','club_admin','agency_admin'\)/, "Leadership memberships must remain protected from organization-manager changes.");
assertHas(updateMembership, /v_user_id = auth\.uid\(\) and p_status = 'suspended'/, "Self-suspension through the manager RPC must remain blocked.");

const teamManagementMigration = migrations[0].toLowerCase();
assertHas(teamManagementMigration, /revoke all on table public\.pfms_legacy_team_staff from public, anon, authenticated/, "Browser roles must not write team staff directly.");
assertHas(teamManagementMigration, /grant select on table public\.pfms_legacy_team_staff to authenticated/, "Authenticated staff access must be read-only at the table layer.");
for (const signature of [
  "pfms_list_legacy_team_staff_candidates(uuid)",
  "pfms_assign_legacy_team_staff(uuid,uuid,text)",
  "pfms_remove_legacy_team_staff(uuid)"
]) {
  const escapedSignature = signature.replace(/[.()]/g, "\\$&");
  assertHas(
    teamManagementMigration,
    new RegExp("grant execute on function public\\." + escapedSignature + " to authenticated"),
    "Authenticated EXECUTE grant missing for " + signature
  );
}
assertHas(
  teamManagementMigration,
  /revoke all on function public\.pfms_assign_legacy_team_staff\(uuid,uuid,text\) from public, anon/,
  "Anonymous and PUBLIC callers must not execute staff assignment."
);

console.log(
  "PFMS tenant/role isolation tests passed: active organization membership, role matching, trainer authority, staff assignment scope, leadership protection and RPC-only writes."
);
