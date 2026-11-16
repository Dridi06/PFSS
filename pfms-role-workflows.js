(function attachPFMSRoleWorkflows(root) {
  "use strict";

  const ALL_VIEWS = Object.freeze([
    "dashboard", "players", "clubs", "club-members", "club-admin", "club-scouting",
    "teams", "staff", "scouts", "team-workspace", "reports", "media", "tasks",
    "admin", "agencies", "admin-members", "admin-errors", "notifications",
    "support", "admin-inbox", "admin-payments", "backup", "scout-workspace"
  ]);
  const SHARED_VIEWS = Object.freeze(["dashboard", "media", "tasks", "notifications", "support"]);
  const MANAGER_ROLES = new Set(["owner", "club_admin", "agency_admin"]);
  const TEAM_ROLE_HINTS = new Set(["trainer", "coach", "co_trainer", "cotrainer", "betreuer"]);
  const ACTIVE_ORG_STATUSES = new Set(["approved", "active"]);

  function normalizeRole(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s-]+/g, "_");
  }

  function isActiveMembership(organization) {
    const membershipStatus = organization?.membership_status;
    const organizationStatus = organization?.organization_status ?? organization?.status;
    return (!membershipStatus || normalizeRole(membershipStatus) === "active") &&
      (!organizationStatus || ACTIVE_ORG_STATUSES.has(normalizeRole(organizationStatus)));
  }

  function membershipRole(organization) {
    return normalizeRole(organization?.member_role ?? organization?.role);
  }

  function canManageOrganization(organization) {
    return organization?.can_manage_organization === true ||
      MANAGER_ROLES.has(membershipRole(organization));
  }

  function roleForMembership(organization) {
    const type = normalizeRole(organization?.organization_type ?? organization?.type);
    const role = membershipRole(organization);
    if (canManageOrganization(organization) && type === "club") return "verein";
    if (canManageOrganization(organization) && type === "agency") return "agentur";
    if (role === "scout" && type === "club") return "scout";
    if (role === "scout" && type === "agency") return "agenturscout";
    if (["trainer", "coach"].includes(role)) return "trainer";
    if (["co_trainer", "cotrainer"].includes(role)) return "co_trainer";
    if (role === "betreuer") return "betreuer";
    if (["member", "player", "spieler"].includes(role)) return "spieler";
    return null;
  }

  function resolveContext(input = {}) {
    const profileRole = normalizeRole(input.profileRole);
    const isPlatformAdmin = ["admin", "administrator"].includes(profileRole);
    const organizations = Array.isArray(input.organizations) ? input.organizations : [];
    const teams = Array.isArray(input.teams) ? input.teams : [];
    const teamAssignments = Array.isArray(input.teamAssignments) ? input.teamAssignments : [];

    const activeOrganizations = organizations.filter(isActiveMembership);
    const manageableOrganizations = activeOrganizations.filter(organization => {
      const type = normalizeRole(organization?.organization_type ?? organization?.type);
      return ["club", "agency"].includes(type) && canManageOrganization(organization);
    });
    const clubOrganizations = manageableOrganizations.filter(
      organization => normalizeRole(organization?.organization_type ?? organization?.type) === "club"
    );
    const agencyOrganizations = manageableOrganizations.filter(
      organization => normalizeRole(organization?.organization_type ?? organization?.type) === "agency"
    );
    const canManageClub = clubOrganizations.length > 0;
    const canManageAgency = agencyOrganizations.length > 0;

    const activeMemberRoles = activeOrganizations.map(membershipRole);
    const mappedMembershipRoles = activeOrganizations.map(roleForMembership).filter(Boolean);
    const declaredRoles = new Set(
      (Array.isArray(input.roles) ? input.roles : []).map(normalizeRole)
    );
    const hasAgencyScoutMembership = activeOrganizations.some(organization =>
      normalizeRole(organization?.organization_type ?? organization?.type) === "agency" &&
      membershipRole(organization) === "scout"
    );
    const hasClubScoutMembership = activeOrganizations.some(organization =>
      normalizeRole(organization?.organization_type ?? organization?.type) === "club" &&
      membershipRole(organization) === "scout"
    );
    const isAgencyScout = profileRole === "agenturscout" ||
      declaredRoles.has("agenturscout") || mappedMembershipRoles.includes("agenturscout") ||
      hasAgencyScoutMembership;
    const isScout = profileRole.includes("scout") ||
      declaredRoles.has("scout") || declaredRoles.has("agenturscout") ||
      mappedMembershipRoles.includes("scout") || mappedMembershipRoles.includes("agenturscout") ||
      activeMemberRoles.includes("scout") ||
      hasAgencyScoutMembership || hasClubScoutMembership;
    const isPlayer = ["player", "spieler"].includes(profileRole) ||
      declaredRoles.has("spieler") || mappedMembershipRoles.includes("spieler") ||
      activeMemberRoles.includes("member");

    const activeTeamAssignments = teamAssignments.filter(assignment => {
      const assignmentStatus = normalizeRole(assignment?.assignment_status ?? assignment?.status);
      const teamStatus = normalizeRole(assignment?.team_status);
      return (!assignmentStatus || assignmentStatus === "active") &&
        (!teamStatus || teamStatus === "active");
    });
    const teamMembershipRoles = mappedMembershipRoles.filter(role => TEAM_ROLE_HINTS.has(role));
    const assignedTeamRoles = activeTeamAssignments
      .map(assignment => normalizeRole(assignment?.team_role ?? assignment?.role))
      .filter(role => TEAM_ROLE_HINTS.has(role));
    const declaredTeamRoles = [...declaredRoles].filter(role => TEAM_ROLE_HINTS.has(role));
    const effectiveTeamRoles = [...new Set([...teamMembershipRoles, ...assignedTeamRoles, ...declaredTeamRoles])];
    const hasTeamRoleHint = TEAM_ROLE_HINTS.has(profileRole) || effectiveTeamRoles.length > 0;
    const hasTeamAccess = teams.length > 0 || activeTeamAssignments.length > 0;

    const allowedViews = new Set(SHARED_VIEWS);
    if (isPlatformAdmin) {
      ALL_VIEWS.forEach(view => allowedViews.add(view));
    } else {
      if (canManageClub) {
        ["clubs", "club-members", "club-admin", "club-scouting", "teams", "staff",
          "team-workspace", "scouts"].forEach(view => allowedViews.add(view));
      }
      if (canManageAgency) {
        ["agencies", "club-members", "club-scouting", "scouts"].forEach(view => allowedViews.add(view));
      }
      if (isScout) ["scouts", "scout-workspace"].forEach(view => allowedViews.add(view));
      if (hasTeamAccess) allowedViews.add("team-workspace");
    }

    let startView = "dashboard";
    if (isPlatformAdmin) startView = "admin";
    else if (canManageClub) startView = "clubs";
    else if (canManageAgency) startView = "agencies";
    else if (isScout) startView = "scouts";
    else if (hasTeamAccess) startView = "team-workspace";

    const primaryTeamRole = effectiveTeamRoles[0] || null;
    let roleLabel = "Mitglied";
    if (isPlatformAdmin) roleLabel = "Administrator";
    else if (canManageClub && canManageAgency) roleLabel = "Verein & Agentur";
    else if (canManageClub) roleLabel = "Vereinsverwaltung";
    else if (canManageAgency) roleLabel = "Agenturverwaltung";
    else if (isAgencyScout) roleLabel = "Agenturscout";
    else if (isScout) roleLabel = "Scout";
    else if (primaryTeamRole === "trainer" || profileRole === "trainer" || profileRole === "coach") roleLabel = "Trainer";
    else if (primaryTeamRole === "co_trainer" || ["co_trainer", "cotrainer"].includes(profileRole)) roleLabel = "Co-Trainer";
    else if (primaryTeamRole === "betreuer" || profileRole === "betreuer") roleLabel = "Betreuer";
    else if (isPlayer) roleLabel = "Spieler";
    else if (hasTeamAccess || hasTeamRoleHint) roleLabel = "Trainerteam";

    return Object.freeze({
      profileRole,
      isPlatformAdmin,
      isScout,
      isAgencyScout,
      isPlayer,
      hasTeamRoleHint,
      hasTeamAccess,
      canManageClub,
      canManageAgency,
      hasManagementWorkspace: isPlatformAdmin || canManageClub || canManageAgency,
      clubOrganizationCount: clubOrganizations.length,
      agencyOrganizationCount: agencyOrganizations.length,
      manageableOrganizations: manageableOrganizations.slice(),
      activeOrganizations: activeOrganizations.slice(),
      activeTeamAssignments: activeTeamAssignments.slice(),
      activeMemberRoles: Object.freeze([...new Set(activeMemberRoles)]),
      allowedViews,
      startView,
      roleLabel
    });
  }

  function canAccessView(context, view) {
    if (!context || !ALL_VIEWS.includes(view)) return false;
    return context.isPlatformAdmin === true || context.allowedViews.has(view);
  }

  function getStartView(context) {
    return context && canAccessView(context, context.startView) ? context.startView : "dashboard";
  }

  function getAllViews() {
    return ALL_VIEWS.slice();
  }

  root.PFMSRoleWorkflows = Object.freeze({
    normalizeRole,
    canManageOrganization,
    roleForMembership,
    resolveContext,
    canAccessView,
    getStartView,
    getAllViews
  });
})(typeof window !== "undefined" ? window : globalThis);
