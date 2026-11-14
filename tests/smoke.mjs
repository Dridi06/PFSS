import fs from "node:fs/promises";
import assert from "node:assert/strict";

const read = (path) => fs.readFile(path, "utf8");

const [
  html,
  legalPage,
  app,
  scout,
  cors,
  usernameLogin,
  r2Check,
  ownerBootstrap,
  ownerMigration,
  ownerGuardMigration,
  stagingAudit,
  ownerGuide,
  adminMembersMigration,
  legacyOrgAdminMigration,
  legacyAdminCompatMigration,
  supabaseConfigText,
  globalCatalogueMigration,
  scoutIntegrityMigration,
  systemEventsMigration,
  systemEventsHardeningMigration,
  mainMediaMigration,
  legacyOrgManagerMigration,
  legacyInvitationWorkspaceMigration,
  legacyOrgMembershipManagementMigration,
  legacyTeamManagementMigration,
  legacyTeamRosterMigration,
  teamPermissionsMigration,
  legacyTeamTrainingMigration,
  legacyTeamCalendarMigration,
  legacyTeamMatchesMigration,
  legacyTeamTrainingExercisesMigration,
  legacyTeamFinanceMigration,
  personalTasksMigration,
  supportTicketsMigration
] = await Promise.all([
  read("index.html"),
  read("rechtliches.html"),
  read("app.js"),
  read("scout-workspace.js"),
  read("supabase/functions/_shared/cors.ts"),
  read("supabase/functions/username-login/index.ts"),
  read("supabase/functions/r2-connection-check/index.ts"),
  read("supabase/functions/pfms-owner-bootstrap/index.ts"),
  read("supabase/migrations/20261115_pfms_platform_owner_bootstrap.sql"),
  read("supabase/migrations/20261116_pfms_owner_bootstrap_registration_guard.sql"),
  read("supabase/STAGING_READ_ONLY_AUDIT.sql"),
  read("docs/OWNER_BOOTSTRAP.md"),
  read("supabase/migrations/20261115_admin_global_member_directory.sql"),
  read("supabase/migrations/20261111_admin_legacy_organization_management.sql"),
  read("supabase/migrations/20261116_pfms_legacy_admin_compat.sql"),
  read("supabase/config.toml"),
  read("supabase/migrations/20261115_pfms_global_player_catalogue.sql"),
  read("supabase/migrations/20261114_scout_workspace_integrity.sql"),
  read("supabase/migrations/20261116_pfms_system_event_monitoring.sql"),
  read("supabase/migrations/20261117_pfms_system_event_hardening.sql"),
  read("supabase/migrations/20261117_pfms_main_media_library.sql"),
  read("supabase/migrations/20261118_pfms_legacy_org_manager_guard.sql"),
  read("supabase/migrations/20261120_pfms_legacy_invitation_workspace_hardening.sql"),
  read("supabase/migrations/20261121_pfms_legacy_org_membership_management.sql"),
  read("supabase/migrations/20261121_pfms_legacy_team_management.sql"),
  read("supabase/migrations/20261122_pfms_legacy_team_roster.sql"),
  read("supabase/migrations/20261122_pfms_legacy_team_permissions.sql"),
  read("supabase/migrations/20261123_pfms_legacy_team_training.sql"),
  read("supabase/migrations/20261124_pfms_legacy_team_calendar.sql"),
  read("supabase/migrations/20261125_pfms_legacy_team_matches.sql"),
  read("supabase/migrations/20261126_pfms_legacy_training_exercises.sql"),
  read("supabase/migrations/20261127_pfms_legacy_team_finance.sql"),
  read("supabase/migrations/20261128_pfms_personal_tasks.sql"),
  read("supabase/migrations/20261129_pfms_support_tickets.sql")
]);

const requiredFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "scout-workspace.js",
  "scout-workspace.css",
  "pfms-logo.svg",
  "rechtliches.html",
  "package.json",
  "deno.json",
  "docs/PROJECT_STATUS.md",
  "docs/STAGING_DEPLOYMENT.md",
  "docs/OWNER_BOOTSTRAP.md",
  "SECURITY.md",
  ".github/dependabot.yml",
  "render.yaml",
  "scripts/build-static.mjs",
  "scripts/build-ci.mjs",
  "pfms-config.js",
  "tests/build-smoke.mjs",
  "tests/build-config-smoke.mjs",
  "tests/accessibility-smoke.mjs",
  "tests/migration-syntax-smoke.mjs",
  "supabase/STAGING_READ_ONLY_AUDIT.sql",
  "supabase/migrations/20261115_pfms_platform_owner_bootstrap.sql",
  "supabase/migrations/20261116_pfms_owner_bootstrap_registration_guard.sql",
  "supabase/migrations/20261115_pfms_global_player_catalogue.sql",
  "supabase/migrations/20261115_admin_global_member_directory.sql",
  "supabase/migrations/20261116_pfms_system_event_monitoring.sql",
  "supabase/migrations/20261117_pfms_system_event_hardening.sql",
  "supabase/migrations/20261117_pfms_main_media_library.sql",
  "supabase/migrations/20261128_pfms_personal_tasks.sql",
  "supabase/migrations/20261129_pfms_support_tickets.sql",
  "supabase/migrations/20261118_pfms_legacy_org_manager_guard.sql",
  "supabase/migrations/20261119_pfms_legacy_invitation_workspace.sql",
  "supabase/migrations/20261120_pfms_legacy_invitation_workspace_hardening.sql",
  "supabase/migrations/20261121_pfms_legacy_org_membership_management.sql",
  "supabase/migrations/20261121_pfms_legacy_team_management.sql",
  "supabase/migrations/20261122_pfms_legacy_team_roster.sql",
  "supabase/functions/pfms-owner-bootstrap/index.ts"
];

for (const path of requiredFiles) {
  await fs.access(path);
}

// All static navigation items must resolve to a corresponding view section.
const idSet = new Set(
  [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1])
);
const navViews = new Set(
  [...html.matchAll(/data-view=["']([^"']+)["']/g)].map((match) => match[1])
);
for (const view of navViews) {
  assert.ok(idSet.has("view-" + view), "Navigation target has no view section: " + view);
}

// Every local script/style/document reference must resolve to a repository file.
for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
  const value = match[1];
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("#")) continue;
  const localPath = decodeURIComponent(value.split("?")[0].split("#")[0]).replace(/^\.\//, "");
  if (localPath) await fs.access(localPath);
}

assert.ok(!html.includes("\\n  "), "index.html contains literal escaped line breaks");
assert.ok(!html.includes("PROFESSIONAL FOOTBALL"), "Old public-facing product spelling remains");
assert.ok(html.includes("PFMS – Professionell Football Management System"), "PFMS brand is missing");
assert.match(app, /window\.PFMS_CONFIG/, "Frontend must read generated environment configuration");
assert.ok(!app.includes("nkkajhjdvfjzrvxkbokg") && !app.includes("sb_publishable_0FH-h-DJDhEnF4TKzTUiBg_7hDljTHi"), "Frontend must not hard-code a Supabase project URL or key");
assert.ok(html.indexOf('src="pfms-config.js"') < html.indexOf('src="app.js'), "Generated Supabase config must load before the application");
assert.match(app, /persistSession:\s*true/, "Supabase session persistence must stay enabled");
assert.match(app, /shouldShowWelcome\s*=\s*showIntro\s*\|\|\s*showReturningGreeting/, "Welcome animation must be conditional");
assert.match(app, /finishAuthentication\(\);/, "Authentication must complete after the reload path");
assert.match(app, /async function showAuthenticatedApp\(user, profile\)/, "Authenticated app initialization must wait for cloud data");
assert.ok(app.includes("await loadPfmsMainData()"), "Main cloud data must be loaded after authentication");
assert.ok(app.includes("function resetPfmsAuthenticatedState()") && app.includes("window.pfmsResetScoutWorkspace?.()"), "Logout must clear user-bound application data");
assert.ok(app.includes("pfmsAuthGeneration") && app.includes("requestGeneration !== pfmsAuthGeneration"), "Stale main data requests must not overwrite a new user's session");
assert.ok(app.includes("pfmsMainMediaOwnerId !== requestUserId") && app.includes("pfmsMainMediaRequestId"), "Private media cache must be isolated between accounts");
assert.ok(scout.includes("window.pfmsResetScoutWorkspace = function") && scout.includes("state.generation += 1"), "Scout private data must reset across account changes");
assert.ok(scout.includes("requestUserId !== window.pfssCurrentUserId") && scout.includes("requestGeneration !== state.generation"), "Stale Scout requests must not repopulate another user's workspace");


// Runtime and Edge Function configuration.
const denoConfig = JSON.parse(await read("deno.json"));
assert.equal(denoConfig.nodeModulesDir, "auto", "Deno npm dependency resolution must be enabled");
assert.ok(cors.includes("PFMS_ALLOWED_ORIGINS") && cors.includes("DEFAULT_ALLOWED_ORIGINS"), "CORS allowlist configuration is missing");
assert.ok(!cors.includes("https://pfss-scouting.onrender.com"), "Production origin must not be allowed by the Edge Function fallback");
assert.ok(supabaseConfigText.includes('project_id = "pfms-local"'), "Supabase CLI local project name must not impersonate a hosted project reference");

assert.ok(usernameLogin.includes("corsForRequest") && r2Check.includes("corsForRequest"), "Edge Functions must use shared CORS policy");
assert.ok(!usernameLogin.includes('"Access-Control-Allow-Origin": "*"'), "Username login must not allow wildcard CORS");
assert.ok(!r2Check.includes('"Access-Control-Allow-Origin": "*"'), "R2 check must not allow wildcard CORS");
assert.ok(r2Check.includes("auth.getUser()") && r2Check.includes('rpc("pfms_is_admin")'), "R2 connection checks must require a verified administrator session");
assert.ok(supabaseConfigText.includes("[functions.r2-connection-check]") && supabaseConfigText.includes("verify_jwt = true"), "R2 connection check must require JWT verification");
assert.ok(usernameLogin.includes('"Cache-Control": "no-store"'), "Username login token responses must not be cached");

// One-time owner setup: original registration evidence, confirmed email, JWT identity and server-side claim.
assert.ok(html.includes('data-registration-choice="owner_bootstrap"'), "Owner bootstrap registration choice is missing");
assert.ok(html.includes('id="ownerBootstrapForm"') && html.includes('id="ownerBootstrapToken"'), "Owner activation form is missing");
assert.ok(app.includes("pfms_owner_setup_available") && app.includes("pfms-owner-bootstrap"), "Owner availability/activation wiring is missing");
assert.ok(ownerBootstrap.includes("auth.getUser()") && ownerBootstrap.includes("email_confirmed_at"), "Owner bootstrap must verify the authenticated email");
assert.ok(ownerBootstrap.includes("PFMS_OWNER_BOOTSTRAP_TOKEN") && ownerBootstrap.includes("constantTimeEqual"), "Owner bootstrap secret comparison is missing");
assert.ok(ownerBootstrap.includes("pfms_claim_initial_owner"), "Owner bootstrap must use the privileged claim RPC");
assert.ok(ownerBootstrap.includes("userData.user.id") && !/payload[^;]*p_user_id/s.test(ownerBootstrap), "Owner identity must come from the verified JWT");
assert.ok(ownerMigration.includes("singleton boolean primary key") && ownerMigration.includes("'service_role'"), "Owner table must enforce a service-role-only singleton");
assert.ok(ownerMigration.includes("An approved administrator already exists"), "Owner claim must refuse a second root administrator");
assert.ok(ownerGuardMigration.includes("after insert on auth.users") && ownerGuardMigration.includes("claimed_at is null"), "Owner eligibility must be recorded at initial account creation and claimed once");
assert.ok(ownerGuardMigration.includes("revoke all on table public.pfms_owner_bootstrap_requests"), "Owner registration evidence must not be user-readable or writable");
assert.ok(supabaseConfigText.includes("[functions.pfms-owner-bootstrap]") && supabaseConfigText.includes("verify_jwt = true"), "Owner function must require JWT verification");
assert.ok(ownerGuide.includes("PFMS_OWNER_BOOTSTRAP_TOKEN") && ownerGuide.includes("Staging"), "Staging owner setup guide is incomplete");
assert.ok(stagingAudit.includes("'pfms_platform_owner'") && stagingAudit.includes("'pfms_owner_bootstrap_requests'"), "Read-only audit must inspect owner bootstrap tables");

// Admin member directory uses the dedicated PFMS admin helper and legacy compatibility bridge.
assert.ok(html.includes('id="pfmsAdminMembersFilterForm"') && html.includes('id="pfmsAdminMembersResults"'), "Admin member directory UI is missing");
assert.ok(app.includes("function loadPfmsAdminMembers()") && app.includes("pfms_admin_list_legacy_members"), "Admin member directory is not connected to its RPC");
assert.ok(app.includes("pfms_admin_update_legacy_membership"), "Admin member role/status updates are not connected");
assert.ok(adminMembersMigration.includes("security definer") && adminMembersMigration.includes("public.pfms_is_admin()"), "Global membership directory must require PFMS administrator authorization");
assert.ok(adminMembersMigration.includes("revoke all on function public.pfms_admin_list_legacy_members") && adminMembersMigration.includes("grant execute on function public.pfms_admin_list_legacy_members"), "Admin member RPC grants are incomplete");
assert.ok(legacyOrgAdminMigration.includes("pfms_admin_update_legacy_membership"), "Legacy organization membership update RPC is missing");
assert.ok(legacyAdminCompatMigration.includes("create or replace function public.is_admin()") && legacyAdminCompatMigration.includes("select public.pfms_is_admin()"), "Legacy admin compatibility bridge is missing");

// Main global catalogue and scouting report persistence.
assert.ok(app.includes("pfms_global_players") && app.includes("pfms_main_scouting_reports"), "Main catalogue/reports must use Supabase");
assert.ok(app.includes("data-global-player-edit") && app.includes("data-global-player-delete"), "Global player edit/delete controls are missing");
assert.ok(app.includes("editingGlobalPlayerId") && app.includes("query.update(row)"), "Global player updates must persist to Supabase");
assert.ok(app.includes("editingMainReportId") && app.includes("data-main-report-edit") && app.includes("data-main-report-delete"), "Main report edit/delete controls are missing");
assert.ok(app.includes("query.update(payload)") && app.includes("query.insert(payload)"), "Main report create/update must use Supabase");
assert.ok(globalCatalogueMigration.includes("public.pfms_global_players") && globalCatalogueMigration.includes("public.pfms_main_scouting_reports"), "Global catalogue migration is incomplete");
assert.ok(globalCatalogueMigration.includes("public.pfms_is_admin()") && globalCatalogueMigration.includes("pfms_current_user_is_approved"), "Global catalogue RLS must enforce approved reads and administrator writes");
assert.ok(globalCatalogueMigration.includes("author_id = auth.uid() or public.pfms_is_admin()"), "Report access must be author-scoped or administrator-scoped");
assert.ok(globalCatalogueMigration.includes("on delete restrict"), "Player deletion must preserve report history");
assert.ok(globalCatalogueMigration.includes("pfms_import_legacy_catalogue") && globalCatalogueMigration.includes("jsonb_array_length"), "Legacy import must be bounded and transactional");
assert.ok(app.includes("pfms_import_legacy_catalogue") && app.includes("importLegacyLocalData"), "Legacy browser data must have an explicit safe cloud import path");
assert.ok(stagingAudit.includes("'pfms_global_players'") && stagingAudit.includes("'pfms_main_scouting_reports'"), "Read-only audit must include the main catalogue tables");


assert.ok(legacyInvitationWorkspaceMigration.includes("pfms_list_my_manageable_legacy_organizations()"), "Managed organization list RPC is missing");
assert.ok(legacyInvitationWorkspaceMigration.includes("coalesce(m.role, 'platform_admin')") && legacyInvitationWorkspaceMigration.includes("public.is_admin()"), "Platform administrators must be able to administer legacy invitations");
assert.ok(html.includes('id="pfmsLegacyInvitationForm"') && html.includes('id="pfmsLegacyInvitationUrl"'), "Invitation workspace UI is missing");

assert.ok(html.includes('id="pfmsClubOrganizationsGrid"') && html.includes('id="pfmsClubWorkspaceStatus"'), "Live club workspace container is missing");
assert.ok(html.includes('data-view="admin-members"') && app.includes("if (view === 'admin-members') loadPfmsAdminMembers()"), "Administrator navigation must open the live member directory");
const agencyViewHtml = html.slice(html.indexOf('id="view-agencies"'), html.indexOf('id="view-admin-members"'));
assert.ok(html.includes("Keine Abbuchungen aktiv") && html.includes("signierte Webhooks") && html.includes("Live-Abrechnung"), "Billing administration must disclose disabled payments and activation requirements");
assert.ok(agencyViewHtml.includes("Agenturen und Mitgliedschaften verwalten") && !agencyViewHtml.includes("Die Live-Suche wird nach Anbindung der Organisationsdatenbank aktiviert."), "Agency administration must route to live member directory");

assert.ok(app.includes("function renderPfmsClubWorkspace()") && app.includes("pfms_list_my_manageable_legacy_organizations"), "Club workspace must load the caller's manageable organizations");
assert.ok(html.includes('id="view-tasks"') && html.includes('id="pfmsPersonalTaskForm"') && html.includes('id="pfmsPersonalTaskList"'), "Personal task center UI is incomplete");
assert.ok(app.includes("async function loadPfmsPersonalTasks()") && app.includes("async function savePfmsPersonalTask(event)") && app.includes("async function updatePfmsPersonalTaskStatus") && app.includes("async function deletePfmsPersonalTask"), "Personal task CRUD is incomplete");
assert.ok(html.includes('id="view-support"') && html.includes('id="pfmsSupportTicketForm"') && html.includes('id="view-admin-inbox"'), "User support and admin inbox UI is incomplete");
assert.ok(legalPage.includes("Hilfe & Support") && !legalPage.includes("Kontaktformular / Ticketversand: noch nicht"), "Legal help page must point to the authenticated PFMS support ticket workflow");
assert.ok(app.includes("async function createPfmsSupportTicket") && app.includes("async function loadPfmsAdminSupportTickets") && app.includes("async function savePfmsAdminSupportTicket"), "Support ticket submission and admin workflow are incomplete");
assert.ok(supportTicketsMigration.includes("force row level security") && supportTicketsMigration.includes("owner_id = auth.uid()") && supportTicketsMigration.includes("public.pfms_is_admin()"), "Support inbox must use private owner/admin ticket policies");
assert.ok(supportTicketsMigration.includes("grant update (status, admin_response)") && supportTicketsMigration.includes("pfms_support_tickets_insert_own"), "Support tickets must restrict users to submission and admins to response/status updates");
assert.ok(supportTicketsMigration.includes("pfms_enforce_support_ticket_rate_limit") && supportTicketsMigration.includes("v_recent_count >= 10"), "Support ticket submissions must be rate-limited per account");
assert.ok(app.includes("document.getElementById('pfmsSupportTicketForm')?.reset()") && app.includes("document.getElementById('pfmsPersonalTaskForm')?.reset()"), "Support drafts must clear on account changes");
assert.ok(stagingAudit.includes("'pfms_support_tickets'"), "Staging audit must include support tickets");

assert.ok(personalTasksMigration.includes("force row level security") && personalTasksMigration.includes("owner_id = auth.uid()") && personalTasksMigration.includes("pfms_current_user_is_approved()"), "Personal tasks must enforce approved owner-only access");
assert.ok(stagingAudit.includes("'pfms_personal_tasks'"), "Staging schema audit must inspect personal task data");
assert.ok(app.includes(".eq('owner_id', requestUserId)") && app.includes("pfmsPersonalTasks = [];"), "Personal task reads and mutations must remain account-scoped");

assert.ok(app.includes("data-pfms-club-nav") && app.includes("data-pfms-open-invitation"), "Club workspace navigation and invite actions are not wired");
assert.ok(html.includes('id="pfmsClubScoutingOrganization"') && html.includes('id="pfmsClubScoutingResults"'), "Club scouting roster UI is missing");
assert.ok(html.includes('id="view-scouts"') && html.includes('data-view="admin-members"') && html.includes('data-view="club-scouting"'), "Scout network page must route to live membership and organization workflows");
assert.ok(html.includes('data-view="club-members"') && html.includes('data-view="team-workspace"') && html.includes('Organisationsweite frei definierbare Rollen- und Rechteprofile'), "Club administration must link to connected management workflows and disclose remaining scope");

assert.ok(app.includes("async function loadPfmsClubScouts()") && app.includes("p_role: 'scout'") && app.includes("p_status: 'active'"), "Club scouting must list active scouts from the organization");
assert.ok(app.includes("pfmsClubInviteScoutButton") && app.includes("roleSelect.value = 'scout'"), "Club scouting must provide a working scout invitation path");
assert.ok(app.includes("pfmsLegacyInvitationOrganizations = [];") && app.includes("clubScoutingResults.replaceChildren()"), "Organization data must be cleared on account reset");


assert.ok(html.includes('id="pfmsLegacyMembersFilterForm"') && html.includes('id="pfmsLegacyMemberResults"'), "Organization membership directory UI is missing");
assert.ok(app.includes("pfms_list_legacy_org_members_for_manager") && app.includes("pfms_update_legacy_org_membership_for_manager"), "Organization membership directory is not connected to its secure RPCs");
assert.ok(legacyOrgMembershipManagementMigration.includes("public.can_manage_org(p_organization_id)") && legacyOrgMembershipManagementMigration.includes("public.can_manage_org(v_organization_id)"), "Organization membership RPCs must verify manager scope server-side");
assert.ok(legacyOrgMembershipManagementMigration.includes("'scout','trainer','co_trainer','betreuer','member'"), "Organization managers must not assign leadership roles");
assert.ok(legacyOrgMembershipManagementMigration.includes("v_current_role in ('owner','club_admin','agency_admin')"), "Leadership memberships must be protected from organization managers");
assert.ok(legacyOrgMembershipManagementMigration.includes("You cannot suspend your own organization membership"), "Organization managers must not suspend their own membership");

assert.ok(app.includes("pfms_list_my_manageable_legacy_organizations") && app.includes("pfms_create_legacy_invitation"), "Invitation workspace must call both secure backend RPCs");

assert.ok(legacyInvitationWorkspaceMigration.includes("public.can_manage_org(o.id)") && legacyInvitationWorkspaceMigration.includes("m.status = 'active'"), "Managed organization list must be owner-scoped");
assert.ok(legacyInvitationWorkspaceMigration.includes("public.is_admin()"), "Platform administrators must be able to manage invitations");
assert.ok(legacyInvitationWorkspaceMigration.includes("v_org_status not in ('approved','active')"), "Invitation creation must accept only approved/active organizations");
assert.ok(legacyInvitationWorkspaceMigration.includes("p_expires_in_days > 30") && legacyInvitationWorkspaceMigration.includes("code_hash"), "Invitation expiry or hashed-code storage guard is missing");
assert.ok(html.includes('id="pfmsLegacyInvitationForm"') && html.includes('id="pfmsLegacyInvitationOrganization"'), "Organization invitation UI is missing");
assert.ok(app.includes("pfms_list_my_manageable_legacy_organizations") && app.includes("pfms_create_legacy_invitation"), "Organization invitation UI is not connected to secure RPCs");
assert.ok(app.includes("new URL(window.location.origin + window.location.pathname)") && app.includes("searchParams.set('invite', code)"), "Invitation result must generate a registration URL");
assert.ok(app.includes("pfmsLegacyInvitationBound") && app.includes("pfmsAuthGeneration"), "Invitation handlers must be bound once and guarded against account changes");


assert.ok(legacyTeamManagementMigration.includes("public.pfms_legacy_teams") && legacyTeamManagementMigration.includes("public.pfms_legacy_team_staff"), "Legacy team and staff tables are missing");
assert.ok(legacyTeamManagementMigration.includes("public.pfms_can_access_legacy_team") && legacyTeamManagementMigration.includes("public.pfms_can_manage_legacy_team"), "Legacy team access and management authorization helpers are missing");
assert.ok(legacyTeamManagementMigration.includes("alter table public.pfms_legacy_teams force row level security") && legacyTeamManagementMigration.includes("alter table public.pfms_legacy_team_staff force row level security"), "Legacy team tables must enforce row-level security");
assert.ok(legacyTeamManagementMigration.includes("pfms_create_legacy_team") && legacyTeamManagementMigration.includes("pfms_update_legacy_team") && legacyTeamManagementMigration.includes("pfms_assign_legacy_team_staff") && legacyTeamManagementMigration.includes("pfms_remove_legacy_team_staff"), "Legacy team CRUD or staff assignment RPCs are missing");
assert.ok(app.includes("async function loadPfmsLegacyTeams") && app.includes("setupPfmsLegacyTeamWorkspace") && app.includes("pfms_list_legacy_team_staff_candidates"), "Legacy team workspace frontend is not connected to its RPCs");
assert.ok(html.includes('id="pfmsTeamGrid"') && html.includes('id="pfmsMyTeamsGrid"') && html.includes('id="pfmsSelectedTeamPanel"'), "Club and personal team workspace UI is missing");
assert.ok(stagingAudit.includes("'pfms_legacy_teams'") && stagingAudit.includes("'pfms_legacy_team_staff'"), "Staging audit must inspect team and staff data");
assert.ok(legacyTeamRosterMigration.includes("public.pfms_legacy_team_players") && legacyTeamRosterMigration.includes("references public.pfms_global_players(id) on delete restrict"), "Team roster must link to global players without deleting their shared profile");
assert.ok(legacyTeamRosterMigration.includes("alter table public.pfms_legacy_team_players force row level security"), "Team roster must enforce row-level security");
assert.ok(legacyTeamRosterMigration.includes("pfms_list_legacy_team_players") && legacyTeamRosterMigration.includes("pfms_search_global_players_for_team"), "Team roster listing and global player search RPCs are missing");
assert.ok(legacyTeamRosterMigration.includes("pfms_add_legacy_team_player") && legacyTeamRosterMigration.includes("pfms_update_legacy_team_player") && legacyTeamRosterMigration.includes("pfms_remove_legacy_team_player"), "Team roster CRUD RPCs are incomplete");
assert.ok(legacyTeamRosterMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'squad', 'view')"), "Team roster reading must require the explicit squad view permission");
assert.ok(legacyTeamRosterMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'squad', 'edit')"), "Team roster mutations and player search must require squad edit permission");
assert.ok(legacyTeamRosterMigration.includes("position_override text") && legacyTeamRosterMigration.includes("coalesce(tp.position_override, p.position)"), "Team position overrides must remain separate from global player positions");
assert.ok(app.includes("pfms_get_my_legacy_team_permissions") && app.includes("applyPfmsLegacyTeamModulePermissions"), "Team module visibility must be driven by server-resolved per-user permissions");
assert.ok(
  app.includes("const canViewSquad = squadPermission.can_view === true;") &&
  app.includes("const canEditSquad = squadPermission.can_edit === true;") &&
  app.includes("rosterPanel.hidden = !canViewSquad") &&
  app.includes("form.hidden = !canEditSquad") &&
  app.includes("searchForm.hidden = !canEditSquad"),
  "Roster view/edit controls must respect separate team permissions"
);
assert.ok(app.includes("pfmsSelectedTeamPermissions = new Map()") && app.includes("pfmsTeamPermissionsDialog") && app.includes("requestGeneration !== pfmsAuthGeneration"), "Team permission UI must clear state and reject stale account responses");

assert.ok(app.includes("loadPfmsLegacyTeamRoster") && app.includes("pfms_add_legacy_team_player") && app.includes("pfms_update_legacy_team_player") && app.includes("pfms_remove_legacy_team_player"), "Team roster UI is not connected to the roster RPCs");
assert.ok(html.includes('id="pfmsTeamRosterPanel"') && html.includes('id="pfmsTeamRosterForm"') && html.includes('id="pfmsTeamRosterList"'), "Team roster UI is incomplete");
assert.ok(stagingAudit.includes("'pfms_legacy_team_players'"), "Staging audit must inspect team roster assignments");

assert.ok(html.includes('id="pfmsTeamPermissionsForm"') && html.includes('id="pfmsTeamPermissionsList"'), "Per-team permission editor UI is missing");
assert.ok(app.includes("pfms_list_legacy_team_permissions") && app.includes("pfms_save_legacy_team_permissions"), "Team permission editor is not connected to Supabase");
assert.ok(app.includes("data-pfms-team-permissions") && app.includes("PFMS_TEAM_PERMISSION_MODULES"), "Team staff cards must expose the per-module permission editor");
assert.ok(teamPermissionsMigration.includes("public.pfms_legacy_team_permissions") && teamPermissionsMigration.includes("force row level security"), "Per-team module permissions must be stored separately with forced RLS");
assert.ok(teamPermissionsMigration.includes("pfms_has_legacy_team_permission") && teamPermissionsMigration.includes("pfms_get_my_legacy_team_permissions"), "Team module permissions must expose server-side effective authorization");
assert.ok(teamPermissionsMigration.includes("pfms_save_legacy_team_permissions") && teamPermissionsMigration.includes("can_edit and not v_can_view"), "Team permission saving must validate edit/view consistency");
assert.ok(teamPermissionsMigration.includes("Exactly eight module permission entries are required"), "All team modules must be explicitly configured");
assert.ok(
  legacyTeamTrainingMigration.includes("public.pfms_legacy_training_sessions") &&
  legacyTeamTrainingMigration.includes("public.pfms_legacy_training_attendance"),
  "Training and attendance tables are missing"
);
assert.ok(
  legacyTeamTrainingMigration.includes("pfms_list_legacy_team_training") &&
  legacyTeamTrainingMigration.includes("pfms_create_legacy_team_training") &&
  legacyTeamTrainingMigration.includes("pfms_update_legacy_team_training") &&
  legacyTeamTrainingMigration.includes("pfms_list_legacy_training_attendance") &&
  legacyTeamTrainingMigration.includes("pfms_mark_legacy_training_attendance"),
  "Training and attendance RPCs are incomplete"
);
assert.ok(
  legacyTeamTrainingMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'training', 'view')") &&
  legacyTeamTrainingMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'training', 'edit')") &&
  legacyTeamTrainingMigration.includes("pfms_has_legacy_team_permission(v_team_id, 'attendance', 'view')") &&
  legacyTeamTrainingMigration.includes("pfms_has_legacy_team_permission(v_team_id, 'attendance', 'edit')"),
  "Training and attendance RPCs must enforce separate module permissions"
);
assert.ok(
  legacyTeamTrainingMigration.includes("v_assignment_team_id <> v_team_id") &&
  legacyTeamTrainingMigration.includes("Player is not assigned to this team"),
  "Attendance writes must not cross team boundaries"
);
assert.ok(
  legacyTeamTrainingMigration.includes("force row level security") &&
  legacyTeamTrainingMigration.includes("revoke all on table public.pfms_legacy_training_sessions") &&
  legacyTeamTrainingMigration.includes("revoke all on table public.pfms_legacy_training_attendance"),
  "Training and attendance tables must remain RPC-only behind forced RLS"
);
assert.ok(
  app.includes("async function savePfmsLegacyTeamTraining") &&
  app.includes("async function updatePfmsLegacyTrainingStatus") &&
  app.includes("async function openPfmsLegacyTrainingAttendance") &&
  app.includes("async function savePfmsLegacyTrainingAttendance") &&
  app.includes("setupPfmsLegacyTeamWorkspace"),
  "Training and attendance frontend handlers are incomplete"
);
assert.ok(
  html.includes('id="pfmsTeamTrainingPanel"') &&
  html.includes('id="pfmsTeamTrainingForm"') &&
  html.includes('id="pfmsTeamAttendancePanel"') &&
  html.includes('id="pfmsTeamAttendanceList"'),
  "Training and attendance UI panels/forms are incomplete"
);
assert.ok(
  app.includes("async function loadPfmsLegacyTeamTraining") &&
  app.includes("async function savePfmsLegacyTeamTraining") &&
  app.includes("async function openPfmsLegacyTrainingAttendance") &&
  app.includes("async function savePfmsLegacyTrainingAttendance") &&
  app.includes("data-pfms-open-attendance") &&
  app.includes("data-pfms-training-status"),
  "Training and attendance views are not connected to all expected UI actions"
);
assert.ok(
  stagingAudit.includes("'pfms_legacy_training_sessions'") &&
  stagingAudit.includes("'pfms_legacy_training_attendance'"),
  "Staging audit must inspect training and attendance data"
);

assert.ok(
  app.includes("savePfmsLegacyTeamTraining") &&
  app.includes("[data-pfms-open-attendance]") &&
  app.includes("[data-pfms-save-attendance]"),
  "Training and attendance controls are not wired to their handlers"
);
assert.ok(
  html.includes('id="pfmsTeamTrainingForm"') &&
  html.includes('id="pfmsTeamTrainingList"') &&
  html.includes('id="pfmsTeamAttendancePanel"') &&
  html.includes('id="pfmsTeamAttendanceList"'),
  "Team training and attendance UI is incomplete"
);
assert.ok(
  app.includes("pfmsLegacyTrainingSessions = []") &&
  app.includes("pfmsSelectedTrainingSession = null") &&
  app.includes("requestGeneration !== pfmsAuthGeneration"),
  "Training state must be cleared and asynchronous responses guarded on account changes"
);
assert.ok(
  legacyTeamCalendarMigration.includes("public.pfms_legacy_team_calendar_events"),
  "Team calendar table is missing"
);
assert.ok(
  legacyTeamCalendarMigration.includes("pfms_list_legacy_team_calendar") &&
  legacyTeamCalendarMigration.includes("pfms_create_legacy_team_calendar_event") &&
  legacyTeamCalendarMigration.includes("pfms_update_legacy_team_calendar_event"),
  "Team calendar RPCs are incomplete"
);
assert.ok(
  legacyTeamCalendarMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'calendar', 'view')") &&
  legacyTeamCalendarMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'calendar', 'edit')"),
  "Calendar RPCs must enforce calendar-specific permissions"
);
assert.ok(
  legacyTeamCalendarMigration.includes("force row level security") &&
  legacyTeamCalendarMigration.includes("revoke all on table public.pfms_legacy_team_calendar_events"),
  "Calendar table must use forced RLS and deny direct client writes"
);
assert.ok(
  html.includes('id="pfmsTeamCalendarPanel"') &&
  html.includes('id="pfmsTeamCalendarForm"') &&
  html.includes('id="pfmsTeamCalendarList"') &&
  html.includes("data-pfms-show-calendar"),
  "Team calendar interface is incomplete"
);
assert.ok(
  app.includes("async function loadPfmsLegacyTeamCalendar") &&
  app.includes("async function savePfmsLegacyCalendarEvent") &&
  app.includes("async function updatePfmsLegacyCalendarEventStatus") &&
  app.includes("setupPfmsLegacyTeamWorkspace"),
  "Team calendar frontend handlers are incomplete"
);
assert.ok(
  app.includes("pfmsSelectedTeamPermissions.get('calendar')?.can_edit !== true") &&
  app.includes("pfmsSelectedTeamPermissions.get('calendar')?.can_edit === true") &&
  app.includes("requestGeneration !== pfmsAuthGeneration"),
  "Calendar operations must respect per-team permissions and account-switch guards"
);
assert.ok(
  app.includes("pfmsLegacyCalendarEvents = []") &&
  app.includes("pfmsEditingCalendarEventId = null"),
  "Calendar data and edit state must be cleared on team/account changes"
);
assert.ok(
  legacyTeamMatchesMigration.includes("public.pfms_legacy_team_matches") &&
  legacyTeamMatchesMigration.includes("public.pfms_legacy_team_match_lineup"),
  "Team match and lineup tables are missing"
);
assert.ok(
  legacyTeamMatchesMigration.includes("pfms_list_legacy_team_matches") &&
  legacyTeamMatchesMigration.includes("pfms_create_legacy_team_match") &&
  legacyTeamMatchesMigration.includes("pfms_update_legacy_team_match") &&
  legacyTeamMatchesMigration.includes("pfms_list_legacy_team_match_lineup") &&
  legacyTeamMatchesMigration.includes("pfms_save_legacy_team_match_lineup") &&
  legacyTeamMatchesMigration.includes("pfms_list_legacy_team_match_candidates"),
  "Team match and lineup RPCs are incomplete"
);
assert.ok(
  legacyTeamMatchesMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'matches', 'view')") &&
  legacyTeamMatchesMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'matches', 'edit')"),
  "Match operations must enforce matches-specific permissions"
);
assert.ok(
  legacyTeamMatchesMigration.includes("Every lineup player must belong to the selected team") &&
  legacyTeamMatchesMigration.includes("v_starters > 11") &&
  legacyTeamMatchesMigration.includes("v_captains > 1"),
  "Match lineup must reject players outside the team, more than 11 starters or multiple captains"
);
assert.ok(
  legacyTeamMatchesMigration.includes("force row level security") &&
  legacyTeamMatchesMigration.includes("revoke all on table public.pfms_legacy_team_matches") &&
  legacyTeamMatchesMigration.includes("revoke all on table public.pfms_legacy_team_match_lineup"),
  "Match and lineup tables must use forced RLS and deny direct client writes"
);
assert.ok(
  legacyTeamMatchesMigration.includes("grant execute on function public.pfms_create_legacy_team_match(uuid,text,text,text,date,time,text,text,text,smallint,smallint) to authenticated") &&
  !legacyTeamMatchesMigration.includes("grant execute on function public.pfms_create_legacy_team_match(uuid,text,text,text,date,time,text,text) to authenticated"),
  "Create-match RPC execute grant must match the current function signature"
);
assert.ok(
  legacyTeamMatchesMigration.includes("unique (match_id, sort_order)") &&
  legacyTeamMatchesMigration.includes("where is_captain") &&
  legacyTeamMatchesMigration.includes("jsonb_typeof(p_lineup) is distinct from 'array'"),
  "Match lineup must enforce unique ordering, one captain and safe array validation"
);

assert.ok(
  legacyTeamTrainingExercisesMigration.includes("public.pfms_legacy_team_training_exercises") &&
  legacyTeamTrainingExercisesMigration.includes("public.pfms_legacy_training_session_exercises"),
  "Team exercise library and session plan tables are missing"
);
assert.ok(
  legacyTeamTrainingExercisesMigration.includes("pfms_list_legacy_team_training_exercises") &&
  legacyTeamTrainingExercisesMigration.includes("pfms_create_legacy_team_training_exercise") &&
  legacyTeamTrainingExercisesMigration.includes("pfms_update_legacy_team_training_exercise") &&
  legacyTeamTrainingExercisesMigration.includes("pfms_delete_legacy_team_training_exercise") &&
  legacyTeamTrainingExercisesMigration.includes("pfms_list_legacy_training_session_exercises") &&
  legacyTeamTrainingExercisesMigration.includes("pfms_save_legacy_training_session_exercises"),
  "Team exercise CRUD and session plan RPCs are incomplete"
);
assert.ok(
  legacyTeamTrainingExercisesMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'training', 'view')") &&
  legacyTeamTrainingExercisesMigration.includes("pfms_has_legacy_team_permission(v_team_id, 'training', 'edit')") &&
  legacyTeamTrainingExercisesMigration.includes("Every exercise must belong to the selected team"),
  "Training exercise operations must enforce training permissions and team isolation"
);
assert.ok(
  legacyTeamTrainingExercisesMigration.includes("foreign key (session_id, team_id)") &&
  legacyTeamTrainingExercisesMigration.includes("foreign key (exercise_id, team_id)") &&
  legacyTeamTrainingExercisesMigration.includes("v_total_duration > 480") &&
  legacyTeamTrainingExercisesMigration.includes("jsonb_array_length(p_items) > 30"),
  "Training plan must enforce composite team links and bounded duration/entry counts"
);
assert.ok(
  legacyTeamTrainingExercisesMigration.includes("'^[0-9]+$'") &&
  legacyTeamTrainingExercisesMigration.includes("planned_duration_minutes"),
  "Training plan must validate integer order and duration fields"
);
assert.ok(
  legacyTeamTrainingExercisesMigration.includes("force row level security") &&
  legacyTeamTrainingExercisesMigration.includes("revoke all on table public.pfms_legacy_team_training_exercises") &&
  legacyTeamTrainingExercisesMigration.includes("revoke all on table public.pfms_legacy_training_session_exercises"),
  "Training exercise tables must deny direct client writes and enforce RLS"
);assert.ok(
  legacyTeamFinanceMigration.includes("public.pfms_legacy_team_finance_entries"),
  "Team finance ledger table is missing"
);
assert.ok(
  legacyTeamFinanceMigration.includes("pfms_list_legacy_team_finance") &&
  legacyTeamFinanceMigration.includes("pfms_get_legacy_team_finance_summary") &&
  legacyTeamFinanceMigration.includes("pfms_create_legacy_team_finance_entry") &&
  legacyTeamFinanceMigration.includes("pfms_void_legacy_team_finance_entry"),
  "Team cashbox read, summary, create and void RPCs are incomplete"
);
assert.ok(
  legacyTeamFinanceMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'finance', 'view')") &&
  legacyTeamFinanceMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'finance', 'edit')"),
  "Team cashbox RPCs must enforce finance.view and finance.edit"
);
assert.ok(
  legacyTeamFinanceMigration.includes("on delete restrict") &&
  legacyTeamFinanceMigration.includes("p_entry_type = 'income' and p_category not in") &&
  legacyTeamFinanceMigration.includes("p_entry_type = 'expense' and p_category not in"),
  "Team cashbox must preserve team history and validate transaction categories"
);
assert.ok(
  legacyTeamFinanceMigration.includes("force row level security") &&
  legacyTeamFinanceMigration.includes("revoke all on table public.pfms_legacy_team_finance_entries") &&
  !legacyTeamFinanceMigration.includes("grant insert on table public.pfms_legacy_team_finance_entries") &&
  legacyTeamFinanceMigration.includes("status = 'voided'") &&
  legacyTeamFinanceMigration.includes("void_reason"),
  "Team cashbox must enforce RLS and preserve voided ledger history"
);
assert.ok(
  html.includes('id="pfmsTeamFinancePanel"') &&
  html.includes('id="pfmsTeamFinanceForm"') &&
  html.includes('id="pfmsTeamFinanceList"') &&
  html.includes('data-pfms-show-finance'),
  "Team cashbox UI is incomplete"
);
assert.ok(
  app.includes("async function loadPfmsLegacyTeamFinance") &&
  app.includes("async function savePfmsLegacyTeamFinanceEntry") &&
  app.includes("async function voidPfmsLegacyTeamFinanceEntry") &&
  app.includes("data-pfms-finance-void"),
  "Team cashbox frontend handlers are incomplete"
);
assert.ok(
  app.includes("pfms_get_legacy_team_finance_summary") &&
  app.includes("pfms_create_legacy_team_finance_entry") &&
  app.includes("pfms_void_legacy_team_finance_entry") &&
  app.includes("pfmsLegacyTeamFinanceEntries = []"),
  "Team cashbox must load summary, write/void entries and clear account/team state"
);
assert.ok(
  stagingAudit.includes("'pfms_legacy_team_finance_entries'"),
  "Read-only staging audit must inspect team finance ledger"
);
assert.ok(
  html.includes('id="pfmsTeamExerciseLibraryPanel"') &&
  html.includes('id="pfmsTeamExerciseForm"') &&
  html.includes('id="pfmsTeamSessionPlanPanel"') &&
  html.includes('id="pfmsTeamSessionPlanExercises"'),
  "Team exercise library and session plan UI is incomplete"
);
assert.ok(
  app.includes("async function loadPfmsLegacyTeamExercises") &&
  app.includes("async function savePfmsLegacyTeamExercise") &&
  app.includes("async function openPfmsLegacyTrainingPlan") &&
  app.includes("async function savePfmsLegacyTrainingSessionPlan"),
  "Team exercise library and session planner frontend handlers are incomplete"
);
assert.ok(
  app.includes("pfms_list_legacy_team_training_exercises") &&
  app.includes("pfms_save_legacy_training_session_exercises") &&
  app.includes("data-pfms-open-training-plan") &&
  app.includes("pfmsLegacyTeamExercises = []"),
  "Training plan UI must load team exercises and clear state on team/account changes"
);

assert.ok(
  html.includes('id="pfmsTeamMatchesPanel"') &&
  html.includes('id="pfmsTeamMatchForm"') &&
  html.includes('id="pfmsTeamMatchesList"') &&
  html.includes('id="pfmsTeamMatchLineupPanel"') &&
  html.includes('id="pfmsTeamMatchLineupList"') &&
  html.includes("data-pfms-show-matches"),
  "Team matches and lineup UI is incomplete"
);
assert.ok(
  app.includes("async function loadPfmsLegacyTeamMatches") &&
  app.includes("async function savePfmsLegacyTeamMatch") &&
  app.includes("async function openPfmsLegacyTeamMatchLineup") &&
  app.includes("async function savePfmsLegacyTeamMatchLineup"),
  "Team matches and lineup frontend handlers are incomplete"
);
assert.ok(
  app.includes("pfms_list_legacy_team_match_candidates") &&
  app.includes("pfms_save_legacy_team_match_lineup") &&
  app.includes("pfmsSelectedTeamPermissions.get('matches')?.can_edit"),
  "Team match lineup must load candidates and save only with match edit access"
);
assert.ok(
  app.includes("pfmsLegacyMatches = []") &&
  app.includes("pfmsSelectedTeamMatch = null") &&
  app.includes("requestGeneration !== pfmsAuthGeneration"),
  "Match and lineup state must clear and reject stale team/account responses"
);





// Legacy organization invitation authorization must be available in the tracked migrations.
assert.ok(legacyOrgManagerMigration.includes("create or replace function public.can_manage_org(p_organization_id uuid)"), "Legacy organization manager helper is missing");
assert.ok(legacyOrgManagerMigration.includes("security definer") && legacyOrgManagerMigration.includes("set search_path = ''"), "Legacy manager helper must be protected by a fixed search path");
assert.ok(legacyOrgManagerMigration.includes("m.user_id = auth.uid()") && legacyOrgManagerMigration.includes("m.status = 'active'"), "Legacy manager helper must enforce the active caller membership");
assert.ok(legacyOrgManagerMigration.includes("'owner', 'club_admin', 'agency_admin'"), "Legacy manager helper role allowlist is incomplete");
assert.ok(legacyOrgManagerMigration.includes("revoke all on function public.can_manage_org(uuid) from public, anon"), "Legacy manager helper must not be executable by anonymous users");
assert.ok(
  (await read("supabase/migrations/20261111_fix_invitation_admin_access.sql")).includes("public.can_manage_org(p_organization_id)"),
  "Legacy invitation RPC is no longer wired to the organization manager authorization helper"
);

// Private main media library: private bucket, owner-only metadata and signed URL handling.
assert.ok(html.includes('id="mainMediaStatus"') && html.includes('id="mediaGrid"'), "Main media library UI is missing");
assert.ok(!html.includes("Cloud-Upload wird in einem späteren Schritt angebunden"), "Main media UI must not advertise local-only storage");
assert.ok(app.includes("function loadPfmsMainMedia") && app.includes("function renderPfmsMainMedia"), "Main media cloud load/render functions are missing");
assert.ok(app.includes("PFMS_MAIN_MEDIA_BUCKET") && app.includes(".upload(storagePath, file"), "Main media must upload to the private bucket");
assert.ok(app.includes("createSignedUrl") && app.includes("data-main-media-delete") && app.includes("deleteMainMedia"), "Main media must use signed URLs and support deletion");
assert.ok(app.includes("PFMS_MAIN_MEDIA_MAX_SIZE") && app.includes("PFMS_MAIN_MEDIA_ALLOWED_TYPES"), "Main media must enforce size and MIME allowlists");
assert.ok(mainMediaMigration.includes("force row level security") && mainMediaMigration.includes("owner_id = auth.uid()"), "Main media metadata must use forced owner-scoped RLS");
assert.ok(mainMediaMigration.includes("pfss-scout-private") && mainMediaMigration.includes("public = false"), "Main media must use the existing private bucket");
assert.ok(mainMediaMigration.includes("storage_path ~ ('^' || auth.uid()::text || '/main/[^/]+$')"), "Main media path must be restricted to the user's main folder");
assert.ok(stagingAudit.includes("'pfms_main_media'"), "Read-only audit must inspect main media metadata");
assert.ok(app.includes("const requestGeneration = pfmsAuthGeneration") && app.includes("const requestUserId = window.pfssCurrentUserId"), "Main media mutations must bind to the initiating account session");
assert.ok(app.includes("if (!isCurrentMediaSession()) return;") && app.includes("owner_id: requestUserId"), "Main media uploads must stop after an account switch and retain the initiating owner ID");
assert.ok(app.includes(".eq('owner_id', requestUserId)"), "Main media deletion must target only the initiating account");
assert.ok(app.includes("pfmsMainMediaRequestId += 1") && app.includes("pfmsMainMediaOwnerId = ''"), "Main media cache must be invalidated on account reset");
assert.ok(scout.includes("const isCurrentRequest = (generation, userId)") && scout.includes("requestGeneration !== state.generation"), "Scout async operations must use account generation guards");
assert.ok(scout.includes("window.pfmsResetScoutWorkspace = function resetScoutWorkspaceForAccountChange()") && scout.includes("state.generation += 1"), "Scout private state must reset on account changes");
assert.ok(scout.includes("if (!isCurrentRequest(requestGeneration, requestUserId)) return;"), "Scout mutations must not update the next account's UI");


// Private Scout CRUD, global search/copy and private media.
assert.ok(scout.includes("pfss_scout_players") && scout.includes("pfss_scout_reports") && scout.includes("pfss_scout_media"), "Scout workspace must use private Supabase tables");
assert.ok(scout.includes(".storage.from(BUCKET).upload") && scout.includes("createSignedUrl") && scout.includes(".storage.from(BUCKET).remove"), "Scout workspace media CRUD is incomplete");
assert.ok(scout.includes("data-scout-edit-player") && scout.includes("data-scout-delete-player") && scout.includes("data-scout-edit-report") && scout.includes("data-scout-delete-report"), "Scout CRUD controls are incomplete");
assert.ok(!/demoPlayers|demoReports|DESIGNVORSCHAU|TECHNISCHE ANBINDUNG FOLGT/i.test(scout), "Scout workspace must not ship preview data");
assert.ok(scout.includes("'global-search'") && scout.includes("pfms_global_players") && scout.includes("data-scout-copy-global") && scout.includes("source_global_player_id"), "Scout global search/copy workflow is missing");
assert.ok(globalCatalogueMigration.includes("source_global_player_id") && globalCatalogueMigration.includes("pfss_scout_players_owner_global_source_uidx"), "Private Scout copies must retain their global source link");
assert.ok(scoutIntegrityMigration.includes("pfss_scout_players_touch_updated_at") && scoutIntegrityMigration.includes("pfss_scout_reports_rating_range"), "Scout integrity migration is incomplete");
const scoutDeleteStart = scout.indexOf("async function deleteMedia(id)");
const scoutDeleteBody = scout.slice(scoutDeleteStart, scout.indexOf("\n  function bindEvents", scoutDeleteStart));
assert.ok(scoutDeleteStart >= 0 && scoutDeleteBody.indexOf(".from(TABLES.media).delete") > scoutDeleteBody.indexOf(".storage.from(BUCKET).remove"), "Scout media must remove the private object before the metadata row");

// Privacy-limited front-end error telemetry and administrator review.
assert.ok(html.includes('id="pfmsAdminErrorsFilterForm"') && html.includes('id="pfmsAdminErrorsResults"'), "Admin error log UI is missing");
assert.ok(app.includes("function pfmsSanitizeLogValue") && app.includes("function pfmsSanitizeLogPath"), "Error telemetry redaction helpers are missing");
assert.ok(app.includes("setupPfmsClientErrorLogging()") && app.includes("pfmsClientErrorCount >= 5"), "Error telemetry must be enabled and rate-limited");
assert.ok(app.includes("addEventListener('unhandledrejection'") && app.includes("addEventListener('error'"), "Frontend error handlers are missing");
assert.ok(app.includes(".from('pfms_system_events').insert") && app.includes("function setupPfmsAdminErrors()"), "Error event insertion and admin review are missing");
assert.ok(systemEventsMigration.includes("force row level security") && systemEventsMigration.includes("public.pfms_is_admin()"), "System event RLS policies must use the PFMS admin helper");
assert.ok(systemEventsMigration.includes("pfms_system_events_insert_own") && systemEventsMigration.includes("pfms_system_events_admin_select"), "System events must separate user insert from admin reads");
assert.ok(systemEventsHardeningMigration.includes("revoke update on table public.pfms_system_events") && systemEventsHardeningMigration.includes("grant update (status, resolved_at, resolved_by)"), "System event updates must be column-limited");
assert.ok(systemEventsHardeningMigration.includes("System event evidence is immutable") && systemEventsHardeningMigration.includes("Sensitive values are not allowed"), "System event data must be immutable and reject secrets");
assert.ok(app.includes(".update({ status })"), "Admin event updates must only change workflow status");
assert.ok(stagingAudit.includes("'pfms_system_events'"), "Read-only audit must inspect system event records");
assert.ok(stagingAudit.includes("ROW_ESTIMATES") && stagingAudit.includes("legacy_organizations_rows_estimate") && stagingAudit.includes("new_pfms_organizations_rows_estimate"), "Staging audit must compare both organization models and their estimated row counts");
assert.ok(stagingAudit.includes("last_autoanalyze") && stagingAudit.includes("not an exact row count"), "Staging audit must label table statistics as estimates");


assert.ok(
  legacyTeamTrainingExercisesMigration.includes("force row level security") &&
  legacyTeamTrainingExercisesMigration.includes("revoke all on table public.pfms_legacy_team_training_exercises") &&
  legacyTeamTrainingExercisesMigration.includes("revoke all on table public.pfms_legacy_training_session_exercises"),
  "Training exercise tables must deny direct client writes and enforce RLS"
);
assert.ok(
  html.includes('id="pfmsTeamExerciseLibraryPanel"') &&
  html.includes('id="pfmsTeamExerciseForm"') &&
  html.includes('id="pfmsTeamSessionPlanPanel"') &&
  html.includes('id="pfmsTeamSessionPlanExercises"'),
  "Team exercise library and session plan UI is incomplete"
);
assert.ok(
  app.includes("async function loadPfmsLegacyTeamExercises") &&
  app.includes("async function savePfmsLegacyTeamExercise") &&
  app.includes("async function openPfmsLegacyTrainingPlan") &&
  app.includes("async function savePfmsLegacyTrainingSessionPlan"),
  "Team exercise library and session planner frontend handlers are incomplete"
);
assert.ok(
  app.includes("pfms_list_legacy_team_training_exercises") &&
  app.includes("pfms_save_legacy_training_session_exercises") &&
  app.includes("data-pfms-open-training-plan") &&
  app.includes("pfmsLegacyTeamExercises = []"),
  "Training plan UI must load team exercises and clear state on team/account changes"
);

assert.ok(
  html.includes('id="pfmsTeamMatchesPanel"') &&
  html.includes('id="pfmsTeamMatchForm"') &&
  html.includes('id="pfmsTeamMatchesList"') &&
  html.includes('id="pfmsTeamMatchLineupPanel"') &&
  html.includes('id="pfmsTeamMatchLineupList"') &&
  html.includes("data-pfms-show-matches"),
  "Team matches and lineup UI is incomplete"
);
assert.ok(
  app.includes("async function loadPfmsLegacyTeamMatches") &&
  app.includes("async function savePfmsLegacyTeamMatch") &&
  app.includes("async function openPfmsLegacyTeamMatchLineup") &&
  app.includes("async function savePfmsLegacyTeamMatchLineup"),
  "Team matches and lineup frontend handlers are incomplete"
);
assert.ok(
  app.includes("pfms_list_legacy_team_match_candidates") &&
  app.includes("pfms_save_legacy_team_match_lineup") &&
  app.includes("pfmsSelectedTeamPermissions.get('matches')?.can_edit"),
  "Team match lineup must load candidates and save only with match edit access"
);
assert.ok(
  app.includes("pfmsLegacyMatches = []") &&
  app.includes("pfmsSelectedTeamMatch = null") &&
  app.includes("requestGeneration !== pfmsAuthGeneration"),
  "Match and lineup state must clear and reject stale team/account responses"
);





// Legacy organization invitation authorization must be available in the tracked migrations.
assert.ok(legacyOrgManagerMigration.includes("create or replace function public.can_manage_org(p_organization_id uuid)"), "Legacy organization manager helper is missing");
assert.ok(legacyOrgManagerMigration.includes("security definer") && legacyOrgManagerMigration.includes("set search_path = ''"), "Legacy manager helper must be protected by a fixed search path");
assert.ok(legacyOrgManagerMigration.includes("m.user_id = auth.uid()") && legacyOrgManagerMigration.includes("m.status = 'active'"), "Legacy manager helper must enforce the active caller membership");
assert.ok(legacyOrgManagerMigration.includes("'owner', 'club_admin', 'agency_admin'"), "Legacy manager helper role allowlist is incomplete");
assert.ok(legacyOrgManagerMigration.includes("revoke all on function public.can_manage_org(uuid) from public, anon"), "Legacy manager helper must not be executable by anonymous users");
assert.ok(
  (await read("supabase/migrations/20261111_fix_invitation_admin_access.sql")).includes("public.can_manage_org(p_organization_id)"),
  "Legacy invitation RPC is no longer wired to the organization manager authorization helper"
);

// Private main media library: private bucket, owner-only metadata and signed URL handling.
assert.ok(html.includes('id="mainMediaStatus"') && html.includes('id="mediaGrid"'), "Main media library UI is missing");
assert.ok(!html.includes("Cloud-Upload wird in einem späteren Schritt angebunden"), "Main media UI must not advertise local-only storage");
assert.ok(app.includes("function loadPfmsMainMedia") && app.includes("function renderPfmsMainMedia"), "Main media cloud load/render functions are missing");
assert.ok(app.includes("PFMS_MAIN_MEDIA_BUCKET") && app.includes(".upload(storagePath, file"), "Main media must upload to the private bucket");
assert.ok(app.includes("createSignedUrl") && app.includes("data-main-media-delete") && app.includes("deleteMainMedia"), "Main media must use signed URLs and support deletion");
assert.ok(app.includes("PFMS_MAIN_MEDIA_MAX_SIZE") && app.includes("PFMS_MAIN_MEDIA_ALLOWED_TYPES"), "Main media must enforce size and MIME allowlists");
assert.ok(mainMediaMigration.includes("force row level security") && mainMediaMigration.includes("owner_id = auth.uid()"), "Main media metadata must use forced owner-scoped RLS");
assert.ok(mainMediaMigration.includes("pfss-scout-private") && mainMediaMigration.includes("public = false"), "Main media must use the existing private bucket");
assert.ok(mainMediaMigration.includes("storage_path ~ ('^' || auth.uid()::text || '/main/[^/]+$')"), "Main media path must be restricted to the user's main folder");
assert.ok(stagingAudit.includes("'pfms_main_media'"), "Read-only audit must inspect main media metadata");
assert.ok(app.includes("const requestGeneration = pfmsAuthGeneration") && app.includes("const requestUserId = window.pfssCurrentUserId"), "Main media mutations must bind to the initiating account session");
assert.ok(app.includes("if (!isCurrentMediaSession()) return;") && app.includes("owner_id: requestUserId"), "Main media uploads must stop after an account switch and retain the initiating owner ID");
assert.ok(app.includes(".eq('owner_id', requestUserId)"), "Main media deletion must target only the initiating account");
assert.ok(app.includes("pfmsMainMediaRequestId += 1") && app.includes("pfmsMainMediaOwnerId = ''"), "Main media cache must be invalidated on account reset");
assert.ok(scout.includes("const isCurrentRequest = (generation, userId)") && scout.includes("requestGeneration !== state.generation"), "Scout async operations must use account generation guards");
assert.ok(scout.includes("window.pfmsResetScoutWorkspace = function resetScoutWorkspaceForAccountChange()") && scout.includes("state.generation += 1"), "Scout private state must reset on account changes");
assert.ok(scout.includes("if (!isCurrentRequest(requestGeneration, requestUserId)) return;"), "Scout mutations must not update the next account's UI");


// Private Scout CRUD, global search/copy and private media.
assert.ok(scout.includes("pfss_scout_players") && scout.includes("pfss_scout_reports") && scout.includes("pfss_scout_media"), "Scout workspace must use private Supabase tables");
assert.ok(scout.includes(".storage.from(BUCKET).upload") && scout.includes("createSignedUrl") && scout.includes(".storage.from(BUCKET).remove"), "Scout workspace media CRUD is incomplete");
assert.ok(scout.includes("data-scout-edit-player") && scout.includes("data-scout-delete-player") && scout.includes("data-scout-edit-report") && scout.includes("data-scout-delete-report"), "Scout CRUD controls are incomplete");
assert.ok(!/demoPlayers|demoReports|DESIGNVORSCHAU|TECHNISCHE ANBINDUNG FOLGT/i.test(scout), "Scout workspace must not ship preview data");
assert.ok(scout.includes("'global-search'") && scout.includes("pfms_global_players") && scout.includes("data-scout-copy-global") && scout.includes("source_global_player_id"), "Scout global search/copy workflow is missing");
assert.ok(globalCatalogueMigration.includes("source_global_player_id") && globalCatalogueMigration.includes("pfss_scout_players_owner_global_source_uidx"), "Private Scout copies must retain their global source link");
assert.ok(scoutIntegrityMigration.includes("pfss_scout_players_touch_updated_at") && scoutIntegrityMigration.includes("pfss_scout_reports_rating_range"), "Scout integrity migration is incomplete");


// Privacy-limited front-end error telemetry and administrator review.
assert.ok(html.includes('id="pfmsAdminErrorsFilterForm"') && html.includes('id="pfmsAdminErrorsResults"'), "Admin error log UI is missing");
assert.ok(app.includes("function pfmsSanitizeLogValue") && app.includes("function pfmsSanitizeLogPath"), "Error telemetry redaction helpers are missing");
assert.ok(app.includes("setupPfmsClientErrorLogging()") && app.includes("pfmsClientErrorCount >= 5"), "Error telemetry must be enabled and rate-limited");
assert.ok(app.includes("addEventListener('unhandledrejection'") && app.includes("addEventListener('error'"), "Frontend error handlers are missing");
assert.ok(app.includes(".from('pfms_system_events').insert") && app.includes("function setupPfmsAdminErrors()"), "Error event insertion and admin review are missing");
assert.ok(systemEventsMigration.includes("force row level security") && systemEventsMigration.includes("public.pfms_is_admin()"), "System event RLS policies must use the PFMS admin helper");
assert.ok(systemEventsMigration.includes("pfms_system_events_insert_own") && systemEventsMigration.includes("pfms_system_events_admin_select"), "System events must separate user insert from admin reads");
assert.ok(systemEventsHardeningMigration.includes("revoke update on table public.pfms_system_events") && systemEventsHardeningMigration.includes("grant update (status, resolved_at, resolved_by)"), "System event updates must be column-limited");
assert.ok(systemEventsHardeningMigration.includes("System event evidence is immutable") && systemEventsHardeningMigration.includes("Sensitive values are not allowed"), "System event data must be immutable and reject secrets");
assert.ok(app.includes(".update({ status })"), "Admin event updates must only change workflow status");
assert.ok(stagingAudit.includes("'pfms_system_events'"), "Read-only audit must inspect system event records");
assert.ok(stagingAudit.includes("ROW_ESTIMATES") && stagingAudit.includes("legacy_organizations_rows_estimate") && stagingAudit.includes("new_pfms_organizations_rows_estimate"), "Staging audit must compare both organization models and their estimated row counts");
assert.ok(stagingAudit.includes("last_autoanalyze") && stagingAudit.includes("not an exact row count"), "Staging audit must label table statistics as estimates");


// All current navigation targets and all critical modules are represented once.
const knownGaps = [];
if (/Platzhalter|Funktionen folgen/i.test(html)) knownGaps.push("Einige Vereins-/Mannschafts- und Betriebsbereiche sind noch Platzhalter.");
if (/kein Zahlungsanbieter|noch keine Zahlung/i.test(html)) knownGaps.push("Echte Zahlungsabwicklung ist noch nicht eingerichtet.");
if (/Kontaktformular \/ Ticketversand: noch nicht/i.test(html)) knownGaps.push("Kontakt-/Supportfunktion ist noch nicht angebunden.");
console.log("PFMS smoke tests passed. " + navViews.size + " navigation targets verified.");
if (knownGaps.length) {
  console.log("\nKnown unfinished areas (tracked, not hidden):");
  for (const gap of knownGaps) console.log("- " + gap);
}
assert.ok(
  legacyTeamTrainingExercisesMigration.includes("sort_order") &&
  legacyTeamTrainingExercisesMigration.includes("planned_duration_minutes") &&
  legacyTeamTrainingExercisesMigration.includes("!~"),
  "Training plan RPC must reject fractional or malformed order and duration values"
);
assert.ok(
  legacyTeamTrainingExercisesMigration.includes("jsonb_typeof(v_item -> 'notes') not in ('string','null')"),
  "Training plan RPC must reject malformed note types"
);
assert.ok(
  legacyTeamTrainingExercisesMigration.indexOf("delete from public.pfms_legacy_training_session_exercises") >
    legacyTeamTrainingExercisesMigration.indexOf("-- Validate every submitted row before deleting the existing plan."),
  "Existing training plans must not be deleted before entry validation"
);
assert.equal(
  (legacyTeamTrainingExercisesMigration.match(/create or replace function public\.pfms_save_legacy_training_session_exercises/g) || []).length,
  1,
  "Training plan save RPC must be declared once"
);
assert.equal(
  (legacyTeamTrainingExercisesMigration.match(/grant execute on function public\.pfms_save_legacy_training_session_exercises\(uuid,jsonb\) to authenticated;/g) || []).length,
  1,
  "Training plan save RPC must have one matching authenticated grant"
);
assert.equal(
  (legacyTeamTrainingExercisesMigration.match(/\$\$/g) || []).length % 2,
  0,
  "Training exercise migration must have balanced function bodies"
);
assert.ok(
  !legacyTeamTrainingExercisesMigration.includes("!~ '^[0-9]+\\n") &&
  !legacyTeamTrainingExercisesMigration.includes("prevent cross-team plans.';\\n\\n       or (v_item"),
  "Training exercise migration must not contain truncated or duplicated SQL fragments"
);

assert.ok(
  legacyTeamTrainingExercisesMigration.includes("force row level security") &&
  legacyTeamTrainingExercisesMigration.includes("revoke all on table public.pfms_legacy_team_training_exercises") &&
  legacyTeamTrainingExercisesMigration.includes("revoke all on table public.pfms_legacy_training_session_exercises"),
  "Training exercise tables must deny direct client writes and enforce RLS"
);
assert.ok(
  html.includes('id="pfmsTeamExerciseLibraryPanel"') &&
  html.includes('id="pfmsTeamExerciseForm"') &&
  html.includes('id="pfmsTeamSessionPlanPanel"') &&
  html.includes('id="pfmsTeamSessionPlanExercises"'),
  "Team exercise library and session plan UI is incomplete"
);
assert.ok(
  app.includes("async function loadPfmsLegacyTeamExercises") &&
  app.includes("async function savePfmsLegacyTeamExercise") &&
  app.includes("async function openPfmsLegacyTrainingPlan") &&
  app.includes("async function savePfmsLegacyTrainingSessionPlan"),
  "Team exercise library and session planner frontend handlers are incomplete"
);
assert.ok(
  app.includes("pfms_list_legacy_team_training_exercises") &&
  app.includes("pfms_save_legacy_training_session_exercises") &&
  app.includes("data-pfms-open-training-plan") &&
  app.includes("pfmsLegacyTeamExercises = []"),
  "Training plan UI must load team exercises and clear state on team/account changes"
);

assert.ok(
  html.includes('id="pfmsTeamMatchesPanel"') &&
  html.includes('id="pfmsTeamMatchForm"') &&
  html.includes('id="pfmsTeamMatchesList"') &&
  html.includes('id="pfmsTeamMatchLineupPanel"') &&
  html.includes('id="pfmsTeamMatchLineupList"') &&
  html.includes("data-pfms-show-matches"),
  "Team matches and lineup UI is incomplete"
);
assert.ok(
  app.includes("async function loadPfmsLegacyTeamMatches") &&
  app.includes("async function savePfmsLegacyTeamMatch") &&
  app.includes("async function openPfmsLegacyTeamMatchLineup") &&
  app.includes("async function savePfmsLegacyTeamMatchLineup"),
  "Team matches and lineup frontend handlers are incomplete"
);
assert.ok(
  app.includes("pfms_list_legacy_team_match_candidates") &&
  app.includes("pfms_save_legacy_team_match_lineup") &&
  app.includes("pfmsSelectedTeamPermissions.get('matches')?.can_edit"),
  "Team match lineup must load candidates and save only with match edit access"
);
assert.ok(
  app.includes("pfmsLegacyMatches = []") &&
  app.includes("pfmsSelectedTeamMatch = null") &&
  app.includes("requestGeneration !== pfmsAuthGeneration"),
  "Match and lineup state must clear and reject stale team/account responses"
);





// Legacy organization invitation authorization must be available in the tracked migrations.
assert.ok(legacyOrgManagerMigration.includes("create or replace function public.can_manage_org(p_organization_id uuid)"), "Legacy organization manager helper is missing");
assert.ok(legacyOrgManagerMigration.includes("security definer") && legacyOrgManagerMigration.includes("set search_path = ''"), "Legacy manager helper must be protected by a fixed search path");
assert.ok(legacyOrgManagerMigration.includes("m.user_id = auth.uid()") && legacyOrgManagerMigration.includes("m.status = 'active'"), "Legacy manager helper must enforce the active caller membership");
assert.ok(legacyOrgManagerMigration.includes("'owner', 'club_admin', 'agency_admin'"), "Legacy manager helper role allowlist is incomplete");
assert.ok(legacyOrgManagerMigration.includes("revoke all on function public.can_manage_org(uuid) from public, anon"), "Legacy manager helper must not be executable by anonymous users");
assert.ok(
  (await read("supabase/migrations/20261111_fix_invitation_admin_access.sql")).includes("public.can_manage_org(p_organization_id)"),
  "Legacy invitation RPC is no longer wired to the organization manager authorization helper"
);

// Private main media library: private bucket, owner-only metadata and signed URL handling.
assert.ok(html.includes('id="mainMediaStatus"') && html.includes('id="mediaGrid"'), "Main media library UI is missing");
assert.ok(!html.includes("Cloud-Upload wird in einem späteren Schritt angebunden"), "Main media UI must not advertise local-only storage");
assert.ok(app.includes("function loadPfmsMainMedia") && app.includes("function renderPfmsMainMedia"), "Main media cloud load/render functions are missing");
assert.ok(app.includes("PFMS_MAIN_MEDIA_BUCKET") && app.includes(".upload(storagePath, file"), "Main media must upload to the private bucket");
assert.ok(app.includes("createSignedUrl") && app.includes("data-main-media-delete") && app.includes("deleteMainMedia"), "Main media must use signed URLs and support deletion");
assert.ok(app.includes("PFMS_MAIN_MEDIA_MAX_SIZE") && app.includes("PFMS_MAIN_MEDIA_ALLOWED_TYPES"), "Main media must enforce size and MIME allowlists");
assert.ok(mainMediaMigration.includes("force row level security") && mainMediaMigration.includes("owner_id = auth.uid()"), "Main media metadata must use forced owner-scoped RLS");
assert.ok(mainMediaMigration.includes("pfss-scout-private") && mainMediaMigration.includes("public = false"), "Main media must use the existing private bucket");
assert.ok(mainMediaMigration.includes("storage_path ~ ('^' || auth.uid()::text || '/main/[^/]+$')"), "Main media path must be restricted to the user's main folder");
assert.ok(stagingAudit.includes("'pfms_main_media'"), "Read-only audit must inspect main media metadata");
assert.ok(app.includes("const requestGeneration = pfmsAuthGeneration") && app.includes("const requestUserId = window.pfssCurrentUserId"), "Main media mutations must bind to the initiating account session");
assert.ok(app.includes("if (!isCurrentMediaSession()) return;") && app.includes("owner_id: requestUserId"), "Main media uploads must stop after an account switch and retain the initiating owner ID");
assert.ok(app.includes(".eq('owner_id', requestUserId)"), "Main media deletion must target only the initiating account");
assert.ok(app.includes("pfmsMainMediaRequestId += 1") && app.includes("pfmsMainMediaOwnerId = ''"), "Main media cache must be invalidated on account reset");
assert.ok(scout.includes("const isCurrentRequest = (generation, userId)") && scout.includes("requestGeneration !== state.generation"), "Scout async operations must use account generation guards");
assert.ok(scout.includes("window.pfmsResetScoutWorkspace = function resetScoutWorkspaceForAccountChange()") && scout.includes("state.generation += 1"), "Scout private state must reset on account changes");
assert.ok(scout.includes("if (!isCurrentRequest(requestGeneration, requestUserId)) return;"), "Scout mutations must not update the next account's UI");


// Private Scout CRUD, global search/copy and private media.
assert.ok(scout.includes("pfss_scout_players") && scout.includes("pfss_scout_reports") && scout.includes("pfss_scout_media"), "Scout workspace must use private Supabase tables");
assert.ok(scout.includes(".storage.from(BUCKET).upload") && scout.includes("createSignedUrl") && scout.includes(".storage.from(BUCKET).remove"), "Scout workspace media CRUD is incomplete");
assert.ok(scout.includes("data-scout-edit-player") && scout.includes("data-scout-delete-player") && scout.includes("data-scout-edit-report") && scout.includes("data-scout-delete-report"), "Scout CRUD controls are incomplete");
assert.ok(!/demoPlayers|demoReports|DESIGNVORSCHAU|TECHNISCHE ANBINDUNG FOLGT/i.test(scout), "Scout workspace must not ship preview data");
assert.ok(scout.includes("'global-search'") && scout.includes("pfms_global_players") && scout.includes("data-scout-copy-global") && scout.includes("source_global_player_id"), "Scout global search/copy workflow is missing");
assert.ok(globalCatalogueMigration.includes("source_global_player_id") && globalCatalogueMigration.includes("pfss_scout_players_owner_global_source_uidx"), "Private Scout copies must retain their global source link");
assert.ok(scoutIntegrityMigration.includes("pfss_scout_players_touch_updated_at") && scoutIntegrityMigration.includes("pfss_scout_reports_rating_range"), "Scout integrity migration is incomplete");


// Privacy-limited front-end error telemetry and administrator review.
assert.ok(html.includes('id="pfmsAdminErrorsFilterForm"') && html.includes('id="pfmsAdminErrorsResults"'), "Admin error log UI is missing");
assert.ok(app.includes("function pfmsSanitizeLogValue") && app.includes("function pfmsSanitizeLogPath"), "Error telemetry redaction helpers are missing");
assert.ok(app.includes("setupPfmsClientErrorLogging()") && app.includes("pfmsClientErrorCount >= 5"), "Error telemetry must be enabled and rate-limited");
assert.ok(app.includes("addEventListener('unhandledrejection'") && app.includes("addEventListener('error'"), "Frontend error handlers are missing");
assert.ok(app.includes(".from('pfms_system_events').insert") && app.includes("function setupPfmsAdminErrors()"), "Error event insertion and admin review are missing");
assert.ok(systemEventsMigration.includes("force row level security") && systemEventsMigration.includes("public.pfms_is_admin()"), "System event RLS policies must use the PFMS admin helper");
assert.ok(systemEventsMigration.includes("pfms_system_events_insert_own") && systemEventsMigration.includes("pfms_system_events_admin_select"), "System events must separate user insert from admin reads");
assert.ok(systemEventsHardeningMigration.includes("revoke update on table public.pfms_system_events") && systemEventsHardeningMigration.includes("grant update (status, resolved_at, resolved_by)"), "System event updates must be column-limited");
assert.ok(systemEventsHardeningMigration.includes("System event evidence is immutable") && systemEventsHardeningMigration.includes("Sensitive values are not allowed"), "System event data must be immutable and reject secrets");
assert.ok(app.includes(".update({ status })"), "Admin event updates must only change workflow status");
assert.ok(stagingAudit.includes("'pfms_system_events'"), "Read-only audit must inspect system event records");
assert.ok(stagingAudit.includes("ROW_ESTIMATES") && stagingAudit.includes("legacy_organizations_rows_estimate") && stagingAudit.includes("new_pfms_organizations_rows_estimate"), "Staging audit must compare both organization models and their estimated row counts");
assert.ok(stagingAudit.includes("last_autoanalyze") && stagingAudit.includes("not an exact row count"), "Staging audit must label table statistics as estimates");

