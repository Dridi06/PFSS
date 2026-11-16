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
  assert.equal(workflows.canAccessView(membershipOnly, "team-workspace"), false,
    "A staff membership alone is not a team assignment.");

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
