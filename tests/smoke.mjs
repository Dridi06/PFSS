import fs from "node:fs/promises";
import assert from "node:assert/strict";

const read = (path) => fs.readFile(path, "utf8");
const mainStyles = await read("styles.css");
const workspaceStyles = await read("scout-workspace.css");
const scoutForceRlsMigration = await read("supabase/migrations/20261118_pfms_scout_force_rls.sql");
const scoutWorkspaceBaseMigration = await read("supabase/migrations/20261112_private_scout_workspaces.sql");

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
  supportTicketsMigration,
  teamTasksMigration,
  backupWorkflow,
  backupRunbook,
  backupHmacHelper
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
  read("supabase/migrations/20261129_pfms_support_tickets.sql"),
  read("supabase/migrations/20261206_pfms_legacy_team_tasks.sql"),
  read(".github/workflows/pfss-database-backup.yml"),
  read("docs/BACKUP_RESTORE.md"),
  read("scripts/backup-hmac.py")
]);

const authTriggerHardeningMigration = await read("supabase/migrations/20261130_pfms_auth_trigger_hardening.sql");
const legacyInvitationLifecycleHardeningMigration = await read("supabase/migrations/20261131_pfms_legacy_invitation_status_guard.sql");
const trainingCyclesMigration = await read("supabase/migrations/20261201_pfms_legacy_training_cycles.sql");
const teamAnalysisMigration = await read("supabase/migrations/20261202_pfms_legacy_team_analysis.sql");
const teamEventsMigration = await read("supabase/migrations/20261203_pfms_legacy_team_events.sql");
const teamEventParticipantsMigration = await read("supabase/migrations/20261204_pfms_legacy_team_event_participants.sql");
const teamEventLogisticsMigration = await read("supabase/migrations/20261205_pfms_legacy_team_event_logistics.sql");
const teamEventTravelMigration = await read("supabase/migrations/20261205_pfms_legacy_team_event_travel_plans.sql");
const inAppNotificationsMigration = await read("supabase/migrations/20261207_pfms_in_app_notifications.sql");
const supportNotificationsMigration = await read("supabase/migrations/20261208_pfms_support_ticket_notifications.sql");
const stagingAcceptanceSql = await read("supabase/STAGING_ACCEPTANCE_READ_ONLY.sql");
const edgeFunctionGuide = await read("docs/EDGE_FUNCTION_CONFIGURATION.md");
assert.ok(
  !/PFMS_ALLOWED_ORIGINS="[^"]*pfss-scouting\.onrender\.com/i.test(edgeFunctionGuide),
  "Staging Edge Function examples must not allow the production Render origin"
);
assert.ok(
  edgeFunctionGuide.includes('PFMS_ALLOWED_ORIGINS="https://<tatsaechliche-staging-domain>"'),
  "Staging Edge Function example must use only the dedicated staging origin"
);



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
  "docs/BACKUP_RESTORE.md",
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
  "tests/function-grants-smoke.mjs",
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
  "supabase/migrations/20261206_pfms_legacy_team_tasks.sql",
  "supabase/migrations/20261207_pfms_in_app_notifications.sql",
  "supabase/migrations/20261130_pfms_auth_trigger_hardening.sql",
  "supabase/migrations/20261131_pfms_legacy_invitation_status_guard.sql",
  "supabase/migrations/20261201_pfms_legacy_training_cycles.sql",
  "supabase/migrations/20261202_pfms_legacy_team_analysis.sql",
  "supabase/migrations/20261203_pfms_legacy_team_events.sql",
  "supabase/migrations/20261204_pfms_legacy_team_event_participants.sql",
  "supabase/migrations/20261205_pfms_legacy_team_event_logistics.sql",
  "supabase/migrations/20261205_pfms_legacy_team_event_travel_plans.sql",
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
assert.ok(backupWorkflow.includes('pg_restore --list "backup/$FILE"') && backupWorkflow.includes('pg_restore --list "$VERIFY_FILE"'), "Backup workflow must validate the archive before and after encryption");
assert.ok(backupWorkflow.includes("openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000"), "Backup workflow must verify decryption using the configured KDF parameters");
assert.ok(backupWorkflow.includes("aws s3api head-object"), "Backup workflow must verify the uploaded encrypted object");
assert.ok(backupRunbook.includes("neue, isolierte Testdatenbank") && backupRunbook.includes("RESTORE_DATABASE_URL"), "Backup restore documentation must limit restore to an isolated test database");
assert.ok(backupRunbook.includes("pg_restore --list") && backupRunbook.includes("Storage-Objekte"), "Backup restore runbook must include archive validation and explain separate Storage recovery");
assert.ok(
  backupWorkflow.includes("python3 scripts/backup-hmac.py create")
    && backupWorkflow.includes("python3 scripts/backup-hmac.py verify")
    && backupWorkflow.includes("BACKUP_FILE.hmac")
    && backupHmacHelper.includes("hmac.compare_digest(actual, expected)")
    && backupHmacHelper.includes("Backup HMAC verification failed; refusing to decrypt."),
  "Database backups must authenticate the encrypted archive and refuse tampered ciphertext"
);
assert.ok(
  backupWorkflow.indexOf("backup-hmac.py verify") < backupWorkflow.indexOf("openssl enc -d")
    && backupRunbook.indexOf("backup-hmac.py verify") < backupRunbook.indexOf("openssl enc -d"),
  "Backup HMAC must be verified before decryption in both CI and the restore runbook"
);
assert.ok(
  backupHmacHelper.includes('hashlib.pbkdf2_hmac(')
    && backupHmacHelper.includes('DOMAIN = b"PFSS-R2-BACKUP-HMAC-v1"')
    && backupHmacHelper.includes("ITERATIONS = 600_000")
    && backupRunbook.includes("PFSS_BACKUP_ENCRYPTION_PASSPHRASE"),
  "Backup creation and restore must use the shared domain-separated HMAC key derivation"
);
assert.ok(
  backupWorkflow.includes('test -n "$PFSS_BACKUP_ENCRYPTION_PASSPHRASE"')
    && backupWorkflow.includes("-pass env:PFSS_BACKUP_ENCRYPTION_PASSPHRASE"),
  "Backup encryption and verification must use the same configured passphrase"
);

assert.ok(teamTasksMigration.includes("public.pfms_legacy_team_tasks") && teamTasksMigration.includes("force row level security"), "Team task table must enforce RLS");
assert.ok(teamTasksMigration.includes("public.pfms_has_legacy_team_permission") && teamTasksMigration.includes("'tasks', 'edit'"), "Team task writes must require team-scoped task edit permission");
assert.ok(teamTasksMigration.includes("references public.pfms_legacy_team_staff(team_id, user_id)"), "Team task assignees must belong to the same team");
assert.ok(teamTasksMigration.includes("p_status text default 'open'") && teamTasksMigration.includes("completed_at"), "Team task creation must persist an initial status and completion timestamp");
assert.ok(teamTasksMigration.includes("grant execute on function public.pfms_create_legacy_team_task(uuid, text, text, uuid, date, text, text) to authenticated"), "Team task create grant must match the seven-argument function signature");
assert.ok(!/grant execute on function public\.pfms_create_legacy_team_task\(uuid, text, text, uuid, date, text\)\s+to authenticated/i.test(teamTasksMigration), "Legacy six-argument task creation grant must not remain");
assert.ok(app.includes("async function savePfmsLegacyTeamTask") && app.includes("p_status: args.p_status"), "Team task form must send the selected initial status to Supabase");
assert.ok(app.includes("pfms_update_legacy_team_task") && app.includes("pfms_delete_legacy_team_task") && app.includes("loadPfmsLegacyTeamTasks"), "Team task update, delete and reload workflows must be connected");
assert.ok(html.includes('id="pfmsTeamTasksPanel"') && html.includes('id="pfmsTeamTaskForm"') && html.includes('id="pfmsTeamTasksList"'), "Team task UI must be present in the team workspace");

assert.ok(
  inAppNotificationsMigration.includes("public.pfms_notifications")
    && inAppNotificationsMigration.includes("enable row level security")
    && inAppNotificationsMigration.includes("force row level security")
    && inAppNotificationsMigration.includes("recipient_id = auth.uid()")
    && inAppNotificationsMigration.includes("grant select on table public.pfms_notifications to authenticated")
    && inAppNotificationsMigration.includes("grant update (is_read) on table public.pfms_notifications to authenticated")
    && !inAppNotificationsMigration.includes("grant insert on table public.pfms_notifications")
    && !inAppNotificationsMigration.includes("grant all on table public.pfms_notifications"),
  "Notifications must be recipient-private and browser accounts may only read or mark their own rows as read"
);
assert.ok(
  inAppNotificationsMigration.includes("security definer")
    && inAppNotificationsMigration.includes("set search_path = ''")
    && inAppNotificationsMigration.includes("revoke all on function public.pfms_notify_legacy_team_task_changes()")
    && inAppNotificationsMigration.includes("after insert or update of assigned_to, status"),
  "Team-task notifications must be created only by a restricted database trigger"
);
assert.ok(
  inAppNotificationsMigration.includes("'team_task_assigned'")
    && inAppNotificationsMigration.includes("'team_task_completed'")
    && inAppNotificationsMigration.includes("new.assigned_to is distinct from v_actor_id")
    && inAppNotificationsMigration.includes("old.status is distinct from 'done'"),
  "In-app notifications must be generated for new assignees and task completion without self-notification"
);
assert.ok(
  app.includes("async function loadPfmsNotifications")
    && app.includes("async function markPfmsNotificationRead")
    && app.includes("async function markAllPfmsNotificationsRead")
    && app.includes("setupPfmsNotifications()")
    && app.includes("resetPfmsAuthenticatedState()"),
  "In-app notification loading, recipient-owned read state and account reset must be wired"
);
assert.ok(
  app.includes(".from('pfms_notifications')")
    && app.includes(".eq('recipient_id', requestUserId)")
    && app.includes(".update({ is_read: true })")
    && app.includes("pfmsNotifications = [];")
    && app.includes("void loadPfmsNotifications();"),
  "Notification reads must be scoped to the signed-in recipient, unread state must load after login and local data must clear on reset"
);
assert.ok(
  app.includes("data-pfms-notification-read")
    && app.includes("data-pfms-notification-count")
    && app.includes("loadPfmsNotifications()"),
  "Notification inbox actions and unread badges must be wired"
);
assert.ok(
  supportNotificationsMigration.includes("support_ticket_replied")
    && supportNotificationsMigration.includes("support_ticket_resolved")
    && supportNotificationsMigration.includes("pfms_support_tickets_notify_changes")
    && supportNotificationsMigration.includes("new.owner_id is distinct from v_actor_id")
    && supportNotificationsMigration.includes("revoke all on function public.pfms_notify_support_ticket_changes()"),
  "Support replies and resolutions must notify only the ticket owner through a restricted database trigger"
);
assert.ok(
  supportNotificationsMigration.includes("references public.pfms_support_tickets(id) on delete set null")
    && app.includes("support_ticket_id")
    && app.includes("data-pfms-notification-support")
    && app.includes("data-pfms-support-ticket"),
  "Support notifications must deep-link only into the signed-in owner's ticket"
);
assert.ok(
  stagingAcceptanceSql.includes("support_ticket_notification_trigger")
    && stagingAcceptanceSql.includes("support_notification_trigger_function"),
  "Read-only Staging acceptance must verify the support notification trigger and its security context"
);
assert.ok(
  app.includes("neun getrennte Modulrechte") || html.includes("neun getrennte Rechtebereiche"),
  "The club administration interface must describe all nine team permission modules"
);


assert.ok(
  html.includes('id="view-notifications"')
    && html.includes('id="pfmsNotificationsList"')
    && html.includes('id="pfmsNotificationsMarkAllRead"')
    && html.includes('data-pfms-notification-count'),
  "In-app notification inbox and unread counters must be present in the workspace"
);
assert.ok(
  workspaceStyles.includes(".pfms-notifications-list")
    && workspaceStyles.includes(".pfms-notification-card")
    && workspaceStyles.includes(".pfms-notification-count"),
  "Notification inbox cards and unread counters require workspace styling"
);
assert.ok(
  stagingAudit.includes("'pfms_notifications'"),
  "Staging audit must inventory the private notification table"
);
assert.ok(
  stagingAcceptanceSql.includes("select check_name, passed, details")
    && stagingAcceptanceSql.includes("team_tasks_rls")
    && stagingAcceptanceSql.includes("notifications_browser_privileges")
    && stagingAcceptanceSql.includes("task_same_team_assignee_fk")
    && stagingAcceptanceSql.includes("notification_own_row_policies")
    && stagingAcceptanceSql.includes("personal_tasks_owner_rls")
    && stagingAcceptanceSql.includes("support_tickets_owner_admin_rls")
    && stagingAcceptanceSql.includes("support_tickets_column_grants")
    && stagingAcceptanceSql.includes("main_media_private_bucket")
    && stagingAcceptanceSql.includes("main_media_storage_owner_path")
    && stagingAcceptanceSql.includes("main_media_metadata_rls"),
  "Read-only Staging acceptance script must verify task, permission and notification security"
);
const acceptanceExecutableLines = stagingAcceptanceSql
  .split(/\r?\n/)
  .map(line => line.replace(/--.*$/, "").trim())
  .filter(Boolean);
assert.ok(
  !acceptanceExecutableLines.some(line => /^(insert|update|delete|alter|create|drop|truncate)\b/i.test(line)),
  "Staging acceptance SQL must not contain data/schema mutation statements"
);


assert.ok(!backupRunbook.includes("--clean") || backupRunbook.includes("Kein `--clean`"), "Restore guide must prohibit destructive clean restore flags");

assert.ok(html.includes("PFMS – Professionell Football Management System"), "PFMS brand is missing");
assert.equal((html.match(/class="registration-choice-card pricing-card/g) || []).length, 5, "Five PFMS registration choices must remain available");
assert.equal((html.match(/data-registration-choice="(?:user|club|agency|scout)"/g) || []).length, 4, "Four public PFMS access packages must remain available separately from owner bootstrap");
assert.ok(
  html.includes("Tarifvorschau") && html.includes("noch nicht buchbar")
    && html.includes("Kein Checkout verfügbar")
    && html.includes("Es wird kein Vertrag abgeschlossen")
    && html.includes("Keine Abbuchung"),
  "Paid plans must be presented only as non-binding, unavailable tariff previews"
);
assert.ok(
  !html.includes("30 Tage kostenlos testen")
    && !html.includes("30 TAGE KOSTENLOS TESTEN")
    && !html.includes("30 Tage kostenlos starten")
    && !html.includes("Während der 30-tägigen Testphase"),
  "A non-existent payment provider must not be presented as an active free trial"
);
const paidPlanGuard = app.indexOf("if (['club','agency','scout'].includes(type))");
const authSignupCall = app.indexOf("pfssSupabase.auth.signUp(");
assert.ok(
  paidPlanGuard >= 0 && authSignupCall > paidPlanGuard
    && app.includes("keine Testphase gestartet")
    && !app.includes("trial_days")
    && !app.includes("billing_cycle:"),
  "Paid plans must stop before account creation and must not write phantom trial or billing metadata"
);
assert.ok(
  html.includes('id="view-admin-payments"')
    && html.includes("Keine Abbuchungen aktiv")
    && html.includes("Es ist noch kein Zahlungsanbieter verbunden"),
  "Admin billing page must disclose the inactive provider and payment status"
);


assert.ok(html.includes('aria-pressed="true"') && html.includes('aria-pressed="false"') && app.includes("setAttribute('aria-pressed'"), "Billing cycle controls must expose their selected state accessibly");

const localBuildConfig = await read("pfms-config.js");
assert.ok(localBuildConfig.includes('buildTarget: "unconfigured"') && localBuildConfig.includes('supabaseUrl: ""') && localBuildConfig.includes('supabaseKey: ""'), "Unbuilt local frontend must fail closed without a Supabase target");
assert.match(app, /window\.PFMS_CONFIG/, "Frontend must read generated environment configuration");
assert.ok(!app.includes("nkkajhjdvfjzrvxkbokg") && !app.includes("sb_publishable_0FH-h-DJDhEnF4TKzTUiBg_7hDljTHi"), "Frontend must not hard-code a Supabase project URL or key");
assert.ok(html.indexOf('src="pfms-config.js"') < html.indexOf('src="app.js'), "Generated Supabase config must load before the application");
assert.match(app, /persistSession:\s*true/, "Supabase session persistence must stay enabled");
assert.ok(app.includes("function resetPfmsAuthenticatedState()") && app.includes("window.pfmsResetScoutWorkspace?.()"), "Account changes must clear private workspace state");
assert.ok(app.includes("pfmsMainMediaRequestId") && app.includes("pfmsMainMediaOwnerId"), "Main media cache must be isolated across accounts");
assert.ok(
  (app.match(/const isCurrentRequest = \(\) => requestGeneration === pfmsAuthGeneration/g) || []).length >= 4,
  "Player and scouting mutations must ignore stale responses after account changes"
);
assert.ok(scout.includes("state.generation") && scout.includes("window.pfmsResetScoutWorkspace"), "Scout workspace must invalidate stale requests on account changes");

assert.match(app, /shouldShowWelcome\s*=\s*showIntro\s*\|\|\s*showReturningGreeting/, "Welcome animation must be conditional");
assert.match(app, /finishAuthentication\(\);/, "Authentication must complete after the reload path");
assert.match(app, /async function showAuthenticatedApp\(user, profile\)/, "Authenticated app initialization must wait for cloud data");
assert.ok(app.includes("await loadPfmsMainData()"), "Main cloud data must be loaded after authentication");
const authenticatedInit = app.slice(
  app.indexOf("async function showAuthenticatedApp(user, profile)"),
  app.indexOf("async function loadAdminUsers")
);
assert.ok(
  authenticatedInit.includes("const requestedUserId = user.id;") &&
  authenticatedInit.indexOf("resetPfmsAuthenticatedState();") < authenticatedInit.indexOf("await pfssSupabase.rpc('pfms_list_my_legacy_teams')") &&
  authenticatedInit.includes("authGeneration !== pfmsAuthGeneration"),
  "Authentication must invalidate an older account before awaiting role and workspace data"
);

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
assert.ok(authTriggerHardeningMigration.includes("set search_path = ''") && authTriggerHardeningMigration.includes("revoke all on function public.pfss_sync_signup_username()") && authTriggerHardeningMigration.includes("revoke all on function public.pfms_provision_new_account()"), "Signup trigger functions must use a fixed search path and non-public execution");
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
assert.ok(globalCatalogueMigration.includes("alter table public.pfms_global_players force row level security") && globalCatalogueMigration.includes("alter table public.pfms_main_scouting_reports force row level security"), "Global player and report tables must force row-level security");
assert.ok(stagingAcceptanceSql.includes("'global_player_catalogue_rls'") && stagingAcceptanceSql.includes("'main_scouting_reports_rls'") && stagingAcceptanceSql.includes("'main_media_owner_rls'"), "Staging acceptance audit must verify main catalogue and media RLS");
assert.ok(stagingAcceptanceSql.includes("'global_catalogue_policy_scope'") && stagingAcceptanceSql.includes("'main_scouting_report_policy_scope'"), "Staging acceptance audit must verify the actual catalogue and report policy scopes");


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
assert.ok(html.includes('id="pfmsStaffDirectory"') && html.includes('id="pfmsStaffRefreshButton"'), "Trainer and Betreuer live directory UI is missing");
assert.ok(!html.includes("data-skeleton-action") && !app.includes("data-skeleton-action"), "No interactive module placeholder handlers may remain in the application");

assert.ok(!html.includes('data-skeleton-action="Mitarbeiter"'), "Trainer and Betreuer page must not retain the static skeleton action");
assert.ok(app.includes("async function loadPfmsStaffDirectory()") && app.includes("pfms_list_legacy_team_staff"), "Trainer and Betreuer page must load live staff through the protected team RPC");
assert.ok(app.includes("data-pfms-team-staff") && app.includes("data-pfms-open-team"), "Staff directory must link to existing team-scoped staff management and workspace");
assert.ok(app.includes("function pfmsTeamStaffStatusLabel") && app.includes("member.assignment_status === 'inactive'"), "Staff directory must distinguish active and inactive assignments");
assert.ok(app.includes("staff.filter(member => member.assignment_status === 'active').length"), "Staff directory must count only active assignments as active");

assert.ok(app.includes("requestGeneration !== pfmsAuthGeneration") && app.includes("pfmsStaffDirectoryRequestId"), "Staff directory requests must be guarded against account changes and stale navigation");

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
  trainingCyclesMigration.includes("pfms_legacy_training_cycles")
    && trainingCyclesMigration.includes("pfms_legacy_training_cycle_weeks")
    && trainingCyclesMigration.includes("unique (id, team_id)")
    && trainingCyclesMigration.includes("cycle_week_id, team_id"),
  "Training cycles must be team-scoped and prevent cross-team week assignments"
);
assert.ok(
  trainingCyclesMigration.includes("pfms_create_legacy_training_cycle")
    && trainingCyclesMigration.includes("pfms_update_legacy_training_cycle_week")
    && trainingCyclesMigration.includes("pfms_update_legacy_training_cycle_status")
    && trainingCyclesMigration.includes("pfms_assign_legacy_training_session_cycle_week"),
  "Training cycle and weekly planning RPCs are incomplete"
);
assert.ok(
  trainingCyclesMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'training', 'edit')")
    && trainingCyclesMigration.includes("pfms_has_legacy_team_permission(v_team_id, 'training', 'edit')")
    && trainingCyclesMigration.includes("force row level security"),
  "Training cycle writes must be permission-checked and tables must use forced RLS"
);
assert.ok(
  trainingCyclesMigration.includes("week_number between 1 and 52")
    && trainingCyclesMigration.includes("p_end_date > p_start_date + 363")
    && trainingCyclesMigration.includes("v_session_date < v_week_start or v_session_date > v_week_end"),
  "Training cycles must enforce bounded 52-week durations and session-to-week date boundaries"
);
assert.ok(
  app.includes("function resetPfmsLegacyTrainingCycleState()")
    && app.includes("pfmsTeamTrainingCyclesList")
    && app.includes("pfmsTeamTrainingCycleForm")
    && (app.match(/resetPfmsLegacyTrainingCycleState\(\);/g) || []).length >= 3,
  "Training cycle records, rendered details, creation form and week selection must clear on team, permission and account resets"
);
assert.ok(
  html.includes('id="pfmsTeamTrainingCyclesPanel"')
    && html.includes('id="pfmsTeamTrainingCycleForm"')
    && html.includes('id="pfmsTeamTrainingCycleWeek"'),
  "Training cycle and week-assignment forms are missing from the team workspace"
);
assert.ok(
  app.includes("async function loadPfmsLegacyTrainingCycles")
    && app.includes("async function savePfmsLegacyTrainingCycle")
    && app.includes("async function savePfmsLegacyTrainingCycleWeek")
    && app.includes("async function updatePfmsLegacyTrainingCycleStatus")
    && app.includes("async function assignPfmsLegacyTrainingSessionToWeek")
    && app.includes("addEventListener('submit', savePfmsLegacyTrainingCycle)"),
  "Training cycle UI actions are not fully connected"
);
assert.ok(
  app.includes("pfms_assign_legacy_training_session_cycle_week")
    && app.includes("p_session_id: sessionId")
    && app.includes("p_week_id: data.cycle_week_id"),
  "New training sessions must be assignable to a selected cycle week"
);
assert.ok(
  mainStyles.includes(".pfms-training-cycle-card")
    && mainStyles.includes(".pfms-cycle-week-form")
    && mainStyles.includes("@media(max-width:640px)"),
  "Training cycle cards and weekly forms need responsive styling"
);
assert.ok(
  stagingAudit.includes("'pfms_legacy_training_cycles'")
    && stagingAudit.includes("'pfms_legacy_training_cycle_weeks'"),
  "Staging audit must inventory both training cycle tables"
);
assert.ok(
  teamAnalysisMigration.includes("pfms_legacy_team_analysis")
    && teamAnalysisMigration.includes("force row level security")
    && teamAnalysisMigration.includes("foreign key (match_id, team_id)")
    && teamAnalysisMigration.includes("video_url ~ '^https://[[:alnum:]]")
    && (teamAnalysisMigration.split("p_video_url !~ '^https://[[:alnum:]]").length - 1) === 2,
  "Team analysis must be private, team-bound and reject empty-host or credential-bearing video references in both write RPCs"
);
assert.ok(
  teamAnalysisMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'analysis', 'edit')")
    && teamAnalysisMigration.includes("pfms_has_legacy_team_permission(v_team_id, 'analysis', 'edit')")
    && teamAnalysisMigration.includes("pfms_list_legacy_team_analysis_matches"),
  "Tactical/video analysis RPCs must enforce analysis module permissions"
);
assert.ok(
  teamAnalysisMigration.includes("p_status text default 'draft'")
    && teamAnalysisMigration.includes("status, created_by")
    && teamAnalysisMigration.includes("p_status, auth.uid()")
    && teamAnalysisMigration.includes("grant execute on function public.pfms_create_legacy_team_analysis(uuid, text, text, text, date, text, text, uuid, text, integer, text, text, text) to authenticated"),
  "Create analysis RPC must persist its status and grant exactly the declared signature to authenticated users"
);

assert.ok(
  stagingAudit.includes("'pfms_legacy_team_analysis'"),
  "Staging audit must inventory tactical and video analysis"
);
assert.ok(
  teamTasksMigration.includes("module_key in (")
    && teamTasksMigration.includes("'analysis'::text")
    && teamTasksMigration.includes("'tasks'::text")
    && teamTasksMigration.includes("jsonb_array_length(p_permissions) <> 9")
    && teamTasksMigration.includes("Exactly nine module permission entries"),
  "Team permission editor and RPC must support nine modules including tasks"
);
assert.ok(
  teamTasksMigration.includes("pfms_legacy_team_tasks")
    && teamTasksMigration.includes("force row level security")
    && teamTasksMigration.includes("pfms_has_legacy_team_permission(team_id, 'tasks', 'view')")
    && teamTasksMigration.includes("revoke all on table public.pfms_legacy_team_tasks"),
  "Shared team task table must enforce RLS, tasks.view and RPC-only writes"
);
assert.ok(
  teamTasksMigration.includes("foreign key (team_id, assigned_to)")
    && teamTasksMigration.includes("references public.pfms_legacy_team_staff(team_id, user_id)")
    && teamTasksMigration.includes("on delete set null (assigned_to)")
    && teamTasksMigration.includes("Task assignee must be active staff of this team"),
  "Team task assignees must belong to the same team; deleted staff must unassign rather than delete tasks"
);
assert.ok(
  teamTasksMigration.includes("pfms_list_legacy_team_tasks")
    && teamTasksMigration.includes("pfms_create_legacy_team_task")
    && teamTasksMigration.includes("pfms_update_legacy_team_task")
    && teamTasksMigration.includes("pfms_delete_legacy_team_task")
    && teamTasksMigration.includes("p_status,")
    && teamTasksMigration.includes("p_status text default 'open'"),
  "Team task CRUD RPCs must support listing, create, update, delete and initial status"
);
assert.ok(
  stagingAudit.includes("'pfms_legacy_team_tasks'"),
  "Staging audit must inventory shared team tasks"
);
assert.ok(
  app.includes("async function loadPfmsLegacyTeamTasks")
    && app.includes("async function savePfmsLegacyTeamTask")
    && app.includes("async function deletePfmsLegacyTeamTask")
    && app.includes("resetPfmsLegacyTeamTasksState()")
    && app.includes("data-pfms-show-tasks"),
  "Shared team tasks must be wired to the team workspace with scoped reset handlers"
);
assert.ok(
  html.includes('id="pfmsTeamTasksPanel"')
    && html.includes('id="pfmsTeamTaskForm"')
    && html.includes('id="pfmsTeamTasksList"')
    && html.includes('id="pfmsTeamTaskAssignee"'),
  "Shared team task UI must expose form, assignee selection and list"
);
assert.ok(
  workspaceStyles.includes(".pfms-team-task-card")
    && workspaceStyles.includes(".pfms-team-task-form-grid")
    && workspaceStyles.includes("@media(max-width:640px)"),
  "Shared team task cards and forms need responsive styling"
);
assert.ok(
  teamTasksMigration.includes("pfms_personal_tasks") === false,
  "Shared team tasks must remain distinct from private personal tasks"
);

assert.ok(
  teamEventsMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'events', 'view')")
    && teamEventsMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'events', 'edit')")
    && teamEventsMigration.includes("event_type in ('tournament','event')"),
  "Events-only permissions must expose and manage only event/tournament entries"
);
assert.ok(
  teamEventsMigration.includes("pfms_legacy_team_calendar_select")
    && teamEventsMigration.includes("calendar', 'view'")
    && teamEventsMigration.includes("events', 'view'")
    && teamEventsMigration.includes("pfms_delete_legacy_team_event"),
  "The event module must reuse the shared calendar while preserving independent permissions and guarded deletion"
);
assert.ok(
  app.includes("async function loadPfmsLegacyTeamEvents")
    && app.includes("async function savePfmsLegacyTeamEvent")
    && app.includes("async function deletePfmsLegacyTeamEvent")
    && app.includes("pfms_list_legacy_team_events_with_logistics")
    && app.includes("pfms_save_legacy_team_event")
    && app.includes("pfms_delete_legacy_team_event"),
  "Team event frontend must connect list, create, update and delete workflows"
);
assert.ok(
  app.includes("function resetPfmsLegacyTeamEventsState()")
    && app.includes("resetPfmsLegacyTeamEventsState();")
    && app.includes("savePfmsLegacyTeamEvent")
    && app.includes("resetPfmsLegacyTeamEventForm")
    && app.includes("data-pfms-event-edit")
    && app.includes("data-pfms-event-delete")
    && app.includes("data-pfms-show-events"),
  "Event UI must connect create, edit, delete, panel navigation and clear its state between teams or accounts"
);
assert.ok(
  teamEventsMigration.includes("v_current_type not in ('tournament','event')")
    && teamEventsMigration.includes("v_event_type not in ('tournament','event')"),
  "Event update and delete RPCs must not allow event-only users to mutate matches or meetings"
);
assert.ok(
  html.includes('id="pfmsTeamEventsPanel"')
    && html.includes('id="pfmsTeamEventForm"')
    && html.includes('id="pfmsTeamEventsList"')
    && html.includes('data-pfms-show-events'),
  "Team event UI must include the independent events workspace and module navigation"
);
assert.ok(
  teamEventParticipantsMigration.includes("create table if not exists public.pfms_legacy_team_event_participants")
    && teamEventParticipantsMigration.includes("foreign key (event_id, team_id)")
    && teamEventParticipantsMigration.includes("foreign key (team_player_assignment_id, team_id)")
    && teamEventParticipantsMigration.includes("force row level security")
    && teamEventParticipantsMigration.includes("revoke all on table public.pfms_legacy_team_event_participants"),
  "Event participants must be bound to the same team event and roster, and remain read-only through table grants/RLS"
);
assert.ok(
  teamEventParticipantsMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'events', 'view')")
    && teamEventParticipantsMigration.includes("pfms_has_legacy_team_permission(v_team_id, 'events', 'edit')")
    && teamEventParticipantsMigration.includes("pfms_add_legacy_team_event_participant")
    && teamEventParticipantsMigration.includes("pfms_update_legacy_team_event_participant")
    && teamEventParticipantsMigration.includes("pfms_remove_legacy_team_event_participant"),
  "Event RSVP and attendance RPCs must enforce independent event permissions"
);
assert.ok(
  teamEventParticipantsMigration.includes("('invited','confirmed','declined','attended','absent')"),
  "Event RSVP and attendance states are incomplete"
);
assert.ok(
  teamEventParticipantsMigration.includes("p_status is null or p_status not in")
    && teamEventParticipantsMigration.includes("tp.squad_status <> 'inactive'")
    && teamEventParticipantsMigration.includes("unique (event_id, team_player_assignment_id)"),
  "Event participant updates must reject null states, inactive roster players and duplicate registrations"
);

assert.ok(
  app.includes("async function addPfmsLegacyTeamEventParticipant")
    && app.includes("async function updatePfmsLegacyTeamEventParticipant")
    && app.includes("async function removePfmsLegacyTeamEventParticipant")
    && app.includes("pfms_list_legacy_team_event_participants")
    && app.includes("pfms_list_legacy_team_event_player_options")
    && app.includes("data-pfms-event-participant-status"),
  "Event participant lists must connect roster selection and RSVP changes"
);
assert.ok(
  mainStyles.includes(".pfms-event-participants")
    && mainStyles.includes(".pfms-event-participant-row")
    && mainStyles.includes(".pfms-event-participant-add"),
  "Event participant and RSVP controls must have responsive styling"
);
assert.ok(
  stagingAudit.includes("'pfms_legacy_team_event_participants'"),
  "Staging audit must include event participant records"
);
assert.ok(
  teamEventTravelMigration.includes("create table if not exists public.pfms_legacy_team_event_travel_plans")
    && teamEventTravelMigration.includes("foreign key (event_id, team_id)")
    && teamEventTravelMigration.includes("force row level security")
    && teamEventTravelMigration.includes("revoke all on table public.pfms_legacy_team_event_travel_plans")
    && teamEventTravelMigration.includes("pfms_has_legacy_team_permission(p_team_id, 'events', 'view')")
    && teamEventTravelMigration.includes("pfms_has_legacy_team_permission(v_team_id, 'events', 'edit')"),
  "Detailed event travel plans must be same-team scoped, RLS protected and permission checked"
);
assert.ok(
  !teamEventTravelMigration.includes("pfms_legacy_team_event_travel_meeting_point_check")
    && teamEventTravelMigration.includes("v_participant_count > p_seat_capacity"),
  "Travel migration must not reference absent columns and must reject vehicle capacities below existing active RSVPs"
);
assert.ok(
  teamEventTravelMigration.includes("v_seat_capacity is not null and v_participant_count >= v_seat_capacity")
    && teamEventTravelMigration.includes("Transport vehicle is at seat capacity")
    && teamEventTravelMigration.includes("pfms_add_legacy_team_event_participant")
    && teamEventTravelMigration.includes("pfms_update_legacy_team_event_participant"),
  "Vehicle seat limits must be enforced on participant additions and RSVP status changes"
);
assert.ok(
  teamEventTravelMigration.includes("for update of e")
    && teamEventTravelMigration.includes("for update;"),
  "Event participant and travel updates must serialize against the event row"
);
const removeParticipantFunctionStart = teamEventTravelMigration.indexOf("create or replace function public.pfms_remove_legacy_team_event_participant");
const removeParticipantFunction = teamEventTravelMigration.slice(removeParticipantFunctionStart);
const removeEventLock = removeParticipantFunction.indexOf("from public.pfms_legacy_team_calendar_events e");
const removeEventLockClause = removeParticipantFunction.indexOf("for update;", removeEventLock);
const removeParticipantLock = removeParticipantFunction.indexOf("for update;", removeEventLockClause + 1);
assert.ok(
  removeParticipantFunctionStart >= 0
    && removeEventLock >= 0
    && removeEventLockClause > removeEventLock
    && removeParticipantLock > removeEventLockClause
    && removeParticipantFunction.includes("revoke all on function public.pfms_remove_legacy_team_event_participant(uuid)"),
  "RSVP removal must lock the event before the participant row and remain protected by EXECUTE grants"
);

assert.ok(
  app.includes("async function savePfmsLegacyTeamEventTravelPlan")
    && app.includes("async function deletePfmsLegacyTeamEventTravelPlan")
    && app.includes("pfms_list_legacy_team_event_travel_plans")
    && app.includes("pfms_save_legacy_team_event_travel_plan")
    && app.includes("pfms_delete_legacy_team_event_travel_plan")
    && app.includes("data-pfms-event-travel-form"),
  "Event travel planning must load, save and remove a detailed itinerary through the protected RPCs"
);
assert.ok(
  workspaceStyles.includes(".pfms-event-travel-details")
    && workspaceStyles.includes(".pfms-event-travel-form")
    && workspaceStyles.includes("@media(max-width:640px)"),
  "Detailed event travel forms and summaries must be responsive"
);
assert.ok(
  stagingAudit.includes("'pfms_legacy_team_event_travel_plans'"),
  "Staging audit must include event travel plans"
);
assert.ok(
  teamEventTravelMigration.includes("v_event_type not in ('tournament','event')")
    && teamEventTravelMigration.includes("pfms_has_legacy_team_permission(v_team_id, 'events', 'edit')")
    && teamEventTravelMigration.includes("p_departure_at is null")
    && teamEventTravelMigration.includes("p_return_departure_at < p_arrival_at"),
  "Travel plans must be event-only, edit-permission protected and validate departure/arrival/return ordering"
);
assert.ok(
  teamEventTravelMigration.includes("grant execute on function public.pfms_list_legacy_team_event_travel_plans(uuid)")
    && teamEventTravelMigration.includes("grant execute on function public.pfms_save_legacy_team_event_travel_plan(uuid, text, text, timestamptz")
    && teamEventTravelMigration.includes("grant execute on function public.pfms_delete_legacy_team_event_travel_plan(uuid)"),
  "Travel plan RPC execution grants must match their exact function signatures"
);
assert.ok(
  app.includes("function pfmsDateTimeLocalIso(value)")
    && app.includes("pfmsLegacyTeamEventTravelPlans = []")
    && app.includes("pfmsLegacyTeamEventTravelPlans = travelResult.data || []")
    && app.includes("resetPfmsLegacyTeamEventsState()"),
  "Travel plan timestamps and cached data must use local datetime conversion and clear on workspace reset"
);


assert.ok(
  mainStyles.includes(".pfms-team-event-card")
    && mainStyles.includes(".pfms-event-form")
    && mainStyles.includes("@media(max-width:640px)"),
  "Team event UI must have responsive card and form styling"
);

assert.ok(
  teamEventLogisticsMigration.includes("create table if not exists public.pfms_legacy_team_event_logistics")
    && teamEventLogisticsMigration.includes("foreign key (event_id, team_id)")
    && teamEventLogisticsMigration.includes("revoke all on table public.pfms_legacy_team_event_logistics")
    && teamEventLogisticsMigration.includes("force row level security"),
  "Event logistics must be team-bound and read-only outside the permission-checked RPC"
);
assert.ok(
  teamEventLogisticsMigration.includes("pfms_save_legacy_team_event")
    && teamEventLogisticsMigration.includes("pfms_list_legacy_team_events_with_logistics")
    && teamEventLogisticsMigration.includes("p_capacity")
    && teamEventLogisticsMigration.includes("p_registration_deadline > p_event_date")
    && app.includes("data.registration_deadline > data.event_date")
    && teamEventLogisticsMigration.includes("v_participant_count >= v_capacity")
    && teamEventLogisticsMigration.includes("create or replace function public.pfms_update_legacy_team_event_participant")
    && teamEventLogisticsMigration.includes("revoke all on function public.pfms_update_legacy_team_event_participant"),
  "Event logistics RPCs must save and list transport details and enforce capacity in the database"
);
assert.ok(
  app.includes("pfms_save_legacy_team_event")
    && app.includes("pfms_list_legacy_team_events_with_logistics")
    && app.includes("p_meeting_point")
    && app.includes("p_transport_mode")
    && app.includes("p_fee_per_person")
    && app.includes("p_capacity"),
  "Event frontend must submit and display event logistics and capacity through the secure RPC"
);
assert.ok(
  html.includes('name="meeting_point"')
    && html.includes('name="registration_deadline"')
    && html.includes('name="transport_mode"')
    && html.includes('name="transport_notes"')
    && html.includes('name="fee_per_person"')
    && html.includes('name="capacity"'),
  "Event editor must include meeting point, deadline, transport, fees and capacity fields"
);
assert.ok(
  mainStyles.includes(".pfms-event-logistics"),
  "Event logistics summary must have responsive styling"
);
assert.ok(
  stagingAudit.includes("'pfms_legacy_team_event_logistics'"),
  "Staging audit must inventory the event logistics table"
);
assert.ok(
  teamAnalysisMigration.includes("revoke all on table public.pfms_legacy_team_analysis")
    && teamAnalysisMigration.includes("grant select on table public.pfms_legacy_team_analysis to authenticated")
    && teamAnalysisMigration.includes("create policy pfms_legacy_team_analysis_select")
    && teamAnalysisMigration.includes("analysis', 'view'"),
  "Tactical/video analysis records must be read-only through RLS and scoped to the analysis permission"
);
assert.ok(
  app.includes("async function loadPfmsLegacyTeamAnalysis")
    && app.includes("async function savePfmsLegacyTeamAnalysis")
    && app.includes("async function deletePfmsLegacyTeamAnalysis")
    && app.includes("pfms_list_legacy_team_analysis_matches")
    && app.includes("pfms_create_legacy_team_analysis")
    && app.includes("pfms_update_legacy_team_analysis")
    && app.includes("pfms_delete_legacy_team_analysis"),
  "Tactical/video analysis frontend must connect list, create, update and delete workflows"
);
assert.ok(
  app.includes("url.protocol === 'https:'")
    && app.includes("target=\"_blank\" rel=\"noopener noreferrer\"")
    && app.includes("resetPfmsLegacyTeamAnalysisState()"),
  "Video references must be HTTPS-only, opened without opener access, and cleared on team/account changes"
);
assert.ok(
  app.includes("form.elements.video_url.required = form.elements.analysis_type.value === 'video'"),
  "Changing or resetting an analysis form must keep the conditional video URL requirement in sync"
);
assert.ok(
  html.includes('id="pfmsTeamAnalysisPanel"')
    && html.includes('id="pfmsTeamAnalysisForm"')
    && html.includes('id="pfmsTeamAnalysisList"')
    && html.includes('data-pfms-show-analysis'),
  "Tactical/video analysis panel, form, list and workspace navigation must exist"
);
assert.ok(
  mainStyles.includes(".pfms-team-analysis-card")
    && mainStyles.includes(".pfms-analysis-form-grid")
    && mainStyles.includes("@media(max-width:640px)"),
  "Tactical/video analysis forms and cards must have responsive styles"
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
assert.ok(html.includes('id="importLegacyDataButton"') && app.includes("importLegacyDataButton"), "Legacy local player/report data import must be reachable from the main player catalogue");
assert.ok(html.includes('id="exportPlayersCsvButton"') && app.includes("function exportMainPlayersCsv()") && app.includes("visibleMainPlayerRows = filtered.slice()"), "Filtered player CSV export is missing");
assert.ok(html.includes('id="exportReportsCsvButton"') && app.includes("function exportMainReportsCsv()"), "Scouting report CSV export is missing");
assert.ok(app.includes("function pfmsCsvCell(value)") && app.includes("text = \"'\" + text"), "CSV export must neutralize spreadsheet formula injection");


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
for (const [fileName, source] of [["app.js", app], ["scout-workspace.js", scout]]) {
  const declarations = [...source.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match => match[1]);
  const counts = new Map();
  for (const name of declarations) counts.set(name, (counts.get(name) || 0) + 1);
  const duplicates = [...counts].filter(([, count]) => count > 1).map(([name]) => name);
  assert.deepEqual(duplicates, [], fileName + " must not contain duplicate function declarations");
}

assert.ok(scout.includes("'global-search'") && scout.includes("pfms_global_players") && scout.includes("data-scout-copy-global") && scout.includes("source_global_player_id"), "Scout global search/copy workflow is missing");
assert.ok(scout.includes("isCurrentRequest(requestGeneration, requestUserId)"), "Scout global player import must stop safely on account changes");
assert.equal((scout.match(/async function uploadFiles\(files\)/g) || []).length, 1, "Scout workspace must have exactly one media upload handler");
assert.equal((scout.match(/async function deleteMedia\(id\)/g) || []).length, 1, "Scout workspace must have exactly one media delete handler");
assert.ok(
  scout.includes("const requestGeneration = state.generation;") &&
  scout.includes("if (!isCurrentRequest(requestGeneration, userId)) break;") &&
  scout.includes(".eq('owner_id', requestUserId)"),
  "Scout media operations must enforce account-generation and owner isolation"
);

assert.ok(
  scout.includes(".eq('owner_id', requestUserId)") &&
  scout.includes("owner_id: requestUserId"),
  "All private Scout reads and writes must be explicitly scoped to the current owner"
);
assert.ok(scout.includes('normalized(player.surname).includes(query)') && scout.includes('normalized(fullName(player)).includes(query)'), 'Global Scout search must match both surname and full name');
assert.ok(globalCatalogueMigration.includes("source_global_player_id") && globalCatalogueMigration.includes("pfss_scout_players_owner_global_source_uidx"), "Private Scout copies must retain their global source link");
assert.ok(scoutIntegrityMigration.includes("pfss_scout_players_touch_updated_at") && scoutIntegrityMigration.includes("pfss_scout_reports_rating_range"), "Scout integrity migration is incomplete");
assert.ok(
  ![...scoutWorkspaceBaseMigration.matchAll(/create\\s+policy[\\s\\S]*?;/gi)]
    .some((match) => match[0].includes("public.is_admin()")),
  "Scout RLS policies must use the canonical PFMS admin helper available earlier in migration order"
);
assert.ok(
  scoutForceRlsMigration.includes("alter table public.pfss_scout_players force row level security") &&
  scoutForceRlsMigration.includes("alter table public.pfss_scout_reports force row level security") &&
  scoutForceRlsMigration.includes("alter table public.pfss_scout_media force row level security"),
  "Scout tables must enforce RLS in addition to owner-scoped policies"
);
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
assert.ok(stagingAudit.includes("FUNCTION_GRANTS") && stagingAudit.includes("aclexplode"), "Staging audit must inventory effective function EXECUTE grants, including Security Definer routines");
assert.ok(stagingAudit.includes("'configuration', p.proconfig"), "Staging audit must expose explicit function security configuration such as search_path");
assert.ok(stagingAudit.includes("ROW_ESTIMATES") && stagingAudit.includes("legacy_organizations_rows_estimate") && stagingAudit.includes("new_pfms_organizations_rows_estimate"), "Staging audit must compare both organization models and their estimated row counts");
assert.ok(stagingAudit.includes("last_autoanalyze") && stagingAudit.includes("not an exact row count"), "Staging audit must label table statistics as estimates");
assert.ok(
  legacyInvitationLifecycleHardeningMigration.includes("v_org_status not in ('approved','active')")
    && legacyInvitationLifecycleHardeningMigration.includes("for share")
    && legacyInvitationLifecycleHardeningMigration.includes("revoke all on function public.pfms_apply_legacy_invitation()"),
  "Invitation redemption must re-check organization status under a row lock and keep the trigger function non-executable by browser roles"
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

