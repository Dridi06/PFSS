import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../pfms-role-workflows.js", import.meta.url), "utf8");
const testWindow = {};
runInNewContext(source, { window: testWindow });
const workflows = testWindow.PFMSRoleWorkflows;
assert.ok(workflows, "Role resolver is attached.");

const club = workflows.resolveContext({
  profileRole: "user",
  organizations: [{
    organization_type: "club",
    organization_status: "approved",
    membership_status: "active",
    member_role: "club_admin"
  }]
});
assert.equal(club.canManageClub, true);
assert.equal(workflows.getStartView(club), "clubs");
for (const view of ["clubs", "club-members", "club-admin", "club-scouting", "teams", "staff", "team-workspace"]) {
  assert.equal(workflows.canAccessView(club, view), true, "Club manager must access " + view);
}
assert.equal(workflows.canAccessView(club, "admin-members"), false);

const agency = workflows.resolveContext({
  profileRole: "user",
  organizations: [{
    organization_type: "agency",
    organization_status: "active",
    membership_status: "active",
    member_role: "agency_admin"
  }]
});
assert.equal(agency.canManageAgency, true);
assert.equal(workflows.getStartView(agency), "agencies");
for (const view of ["agencies", "club-members", "club-scouting", "scouts"]) {
  assert.equal(workflows.canAccessView(agency, view), true, "Agency manager must access " + view);
}
assert.equal(workflows.canAccessView(agency, "clubs"), false);
assert.equal(workflows.canAccessView(agency, "teams"), false);
assert.equal(workflows.canAccessView(agency, "admin"), false);

const agencyScout = workflows.resolveContext({
  profileRole: "user",
  organizations: [{
    organization_type: "agency",
    organization_status: "approved",
    membership_status: "active",
    member_role: "scout"
  }]
});
assert.equal(agencyScout.isScout, true);
assert.equal(agencyScout.isAgencyScout, true);
assert.equal(agencyScout.roleLabel, "Agenturscout");
assert.equal(workflows.canAccessView(agencyScout, "scout-workspace"), true);
assert.equal(workflows.canAccessView(agencyScout, "club-members"), false);

const clubScout = workflows.resolveContext({
  profileRole: "scout",
  organizations: [{
    organization_type: "club",
    organization_status: "approved",
    membership_status: "active",
    member_role: "scout"
  }]
});
assert.equal(clubScout.isScout, true);
assert.equal(clubScout.isAgencyScout, false);
assert.equal(clubScout.roleLabel, "Scout");
assert.equal(workflows.canAccessView(clubScout, "scout-workspace"), true);

for (const [role, label] of [
  ["trainer", "Trainer"],
  ["co_trainer", "Co-Trainer"],
  ["betreuer", "Betreuer"]
]) {
  const membershipOnly = workflows.resolveContext({
    profileRole: "user",
    organizations: [{
      organization_type: "club",
      organization_status: "active",
      membership_status: "active",
      member_role: role
    }]
  });
  assert.equal(membershipOnly.roleLabel, label);
  assert.equal(membershipOnly.hasTeamAccess, false,
    "A staff membership alone must not be represented as an active team assignment.");
  assert.equal(workflows.canAccessView(membershipOnly, "team-workspace"), true,
    "An approved trainer, co-trainer or staff role should reach the assignment-onboarding workspace.");
  assert.equal(workflows.getStartView(membershipOnly), "team-workspace");

  const assigned = workflows.resolveContext({
    profileRole: "user",
    teamAssignments: [{
      team_id: "team-1",
      team_role: role,
      assignment_status: "active",
      team_status: "active"
    }]
  });
  assert.equal(assigned.hasTeamAccess, true);
  assert.equal(assigned.roleLabel, label);
  assert.equal(workflows.getStartView(assigned), "team-workspace");
  assert.equal(workflows.canAccessView(assigned, "team-workspace"), true);
}

const player = workflows.resolveContext({
  profileRole: "user",
  organizations: [{
    organization_type: "club",
    organization_status: "approved",
    membership_status: "active",
    member_role: "member"
  }]
});
assert.equal(player.isPlayer, true);
assert.equal(player.roleLabel, "Spieler");
assert.equal(workflows.canAccessView(player, "dashboard"), true);
assert.equal(workflows.canAccessView(player, "team-workspace"), false);
assert.equal(workflows.canAccessView(player, "scout-workspace"), false);
assert.equal(workflows.canAccessView(player, "admin"), false);

const suspendedMembership = workflows.resolveContext({
  profileRole: "user",
  organizations: [{
    organization_type: "club",
    organization_status: "approved",
    membership_status: "suspended",
    member_role: "owner"
  }]
});
assert.equal(suspendedMembership.canManageClub, false);
assert.equal(workflows.canAccessView(suspendedMembership, "club-admin"), false);

const suspendedOrganization = workflows.resolveContext({
  profileRole: "user",
  organizations: [{
    organization_type: "club",
    organization_status: "suspended",
    membership_status: "active",
    member_role: "owner"
  }]
});
assert.equal(suspendedOrganization.canManageClub, false);

const broadLegacyManager = workflows.resolveContext({
  profileRole: "user",
  organizations: [{
    organization_type: "club",
    organization_status: "active",
    membership_status: "active",
    member_role: "manager"
  }]
});
assert.equal(broadLegacyManager.canManageClub, false,
  "Frontend role matrix must not grant leadership beyond the server can_manage_org contract.");

const canonicalClubAdminWithPermission = workflows.resolveContext({
  profileRole: "user",
  organizations: [{
    organization_type: "club",
    organization_status: "active",
    membership_status: "active",
    member_role: "club_admin",
    source_member_role: "manager",
    can_manage_organization: true
  }]
});
assert.equal(canonicalClubAdminWithPermission.canManageClub, true);
assert.equal(workflows.canAccessView(canonicalClubAdminWithPermission, "club-members"), true);

const canonicalAgencyAdminWithPermission = workflows.resolveContext({
  profileRole: "user",
  organizations: [{
    organization_type: "agency",
    organization_status: "active",
    membership_status: "active",
    member_role: "agency_admin",
    source_member_role: "admin",
    can_manage_organization: true
  }]
});
assert.equal(canonicalAgencyAdminWithPermission.canManageAgency, true);
assert.equal(workflows.getStartView(canonicalAgencyAdminWithPermission), "agencies");

const declaredAgencyScout = workflows.resolveContext({
  profileRole: "user",
  roles: ["agenturscout"]
});
assert.equal(declaredAgencyScout.isScout, true);
assert.equal(declaredAgencyScout.isAgencyScout, true);
assert.equal(declaredAgencyScout.roleLabel, "Agenturscout");
assert.equal(workflows.canAccessView(declaredAgencyScout, "scout-workspace"), true);

const declaredPlayer = workflows.resolveContext({
  profileRole: "user",
  roles: ["spieler"]
});
assert.equal(declaredPlayer.isPlayer, true);
assert.equal(declaredPlayer.roleLabel, "Spieler");
assert.equal(workflows.canAccessView(declaredPlayer, "admin"), false);

const declaredTrainer = workflows.resolveContext({
  profileRole: "user",
  roles: ["trainer"]
});
assert.equal(declaredTrainer.roleLabel, "Trainer");
assert.equal(declaredTrainer.hasTeamAccess, false);
assert.equal(workflows.canAccessView(declaredTrainer, "team-workspace"), true,
  "A declared trainer role may enter the assignment-onboarding view without seeing team data.");
assert.equal(workflows.getStartView(declaredTrainer), "team-workspace");

const multi = workflows.resolveContext({
  profileRole: "user",
  organizations: [
    { organization_type: "club", organization_status: "active", membership_status: "active", member_role: "owner" },
    { organization_type: "agency", organization_status: "approved", membership_status: "active", member_role: "agency_admin" }
  ]
});
assert.equal(multi.canManageClub, true);
assert.equal(multi.canManageAgency, true);
assert.equal(multi.clubOrganizationCount, 1);
assert.equal(multi.agencyOrganizationCount, 1);
assert.equal(workflows.getStartView(multi), "clubs");

const canonicalClubManager = workflows.resolveContext({
  profileRole: "user",
  organizations: [{
    organization_type: "club",
    organization_status: "active",
    membership_status: "active",
    member_role: "club_admin",
    source_member_role: "manager",
    can_manage_organization: true
  }]
});
assert.equal(canonicalClubManager.canManageClub, true);
assert.equal(workflows.canAccessView(canonicalClubManager, "club-members"), true);

const canonicalAgencyManager = workflows.resolveContext({
  profileRole: "user",
  organizations: [{
    organization_type: "agency",
    organization_status: "active",
    membership_status: "active",
    member_role: "agency_admin",
    source_member_role: "admin",
    can_manage_organization: true
  }]
});
assert.equal(canonicalAgencyManager.canManageAgency, true);
assert.equal(workflows.getStartView(canonicalAgencyManager), "agencies");

const agencyScoutProfile = workflows.resolveContext({
  profileRole: "user",
  roles: ["agenturscout"]
});
assert.equal(agencyScoutProfile.isScout, true);
assert.equal(agencyScoutProfile.isAgencyScout, true);
assert.equal(agencyScoutProfile.roleLabel, "Agenturscout");
assert.equal(workflows.canAccessView(agencyScoutProfile, "scout-workspace"), true);

const playerMembershipRole = workflows.resolveContext({
  profileRole: "user",
  roles: ["spieler"]
});
assert.equal(playerMembershipRole.isPlayer, true);
assert.equal(playerMembershipRole.roleLabel, "Spieler");
assert.equal(workflows.canAccessView(playerMembershipRole, "admin"), false);

const admin = workflows.resolveContext({ profileRole: "administrator" });
assert.equal(admin.isPlatformAdmin, true);
assert.equal(workflows.getStartView(admin), "admin");
for (const view of workflows.getAllViews()) {
  assert.equal(workflows.canAccessView(admin, view), true, "Admin route: " + view);
}
assert.equal(workflows.canAccessView(club, "not-a-real-view"), false);
assert.equal(workflows.canAccessView(null, "dashboard"), false);

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
assert.match(app, /function applyPfmsRoleNavigation\([\s\S]*?workflows\.canAccessView\(context, item\.dataset\.view\)/);
assert.match(app, /async function updatePfmsRoleContext\([\s\S]*?pfms_get_my_role_context[\s\S]*?workflows\.resolveContext/);
assert.match(app, /workflows\.canAccessView\(roleContext,view\)/);
assert.match(app, /pfmsAgencyOrganizationsGrid[\s\S]*?pfmsAgencyWorkspacePanel/);

console.log("PFMS role workflow tests passed: club/agency leadership, scouts/agency scouts, trainer/co-trainer/betreuer, players, suspended membership, least-privilege manager roles, multiple organizations, admin and app integration.");
