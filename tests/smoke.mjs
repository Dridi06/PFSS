import fs from "node:fs/promises";
import assert from "node:assert/strict";

const read = (path) => fs.readFile(path, "utf8");
const [
  html, app, scout, css, cors, usernameLogin, r2Check, ownerBootstrap,
  ownerMigration, ownerGuardMigration, ownerGuide, adminMembersMigration,
  legacyOrgAdminMigration, legacyAdminCompatMigration, globalCatalogueMigration,
  scoutIntegrityMigration, systemEventsMigration, systemEventsHardeningMigration,
  mainMediaMigration, stagingAudit, supabaseConfig, denoConfigText, qualityWorkflow
] = await Promise.all([
  read("index.html"),
  read("app.js"),
  read("scout-workspace.js"),
  read("styles.css"),
  read("supabase/functions/_shared/cors.ts"),
  read("supabase/functions/username-login/index.ts"),
  read("supabase/functions/r2-connection-check/index.ts"),
  read("supabase/functions/pfms-owner-bootstrap/index.ts"),
  read("supabase/migrations/20261115_pfms_platform_owner_bootstrap.sql"),
  read("supabase/migrations/20261116_pfms_owner_bootstrap_registration_guard.sql"),
  read("docs/OWNER_BOOTSTRAP.md"),
  read("supabase/migrations/20261115_admin_global_member_directory.sql"),
  read("supabase/migrations/20261111_admin_legacy_organization_management.sql"),
  read("supabase/migrations/20261116_pfms_legacy_admin_compat.sql"),
  read("supabase/migrations/20261115_pfms_global_player_catalogue.sql"),
  read("supabase/migrations/20261114_scout_workspace_integrity.sql"),
  read("supabase/migrations/20261116_pfms_system_event_monitoring.sql"),
  read("supabase/migrations/20261117_pfms_system_event_hardening.sql"),
  read("supabase/migrations/20261117_pfms_main_media_library.sql"),
  read("supabase/STAGING_READ_ONLY_AUDIT.sql"),
  read("supabase/config.toml"),
  read("deno.json"),
  read(".github/workflows/pfms-quality.yml")
]);

const requiredFiles = [
  "index.html", "app.js", "styles.css", "scout-workspace.js",
  "scout-workspace.css", "pfms-logo.svg", "pfms-welcome.webp",
  "rechtliches.html", "docs/PROJECT_STATUS.md",
  "docs/OWNER_BOOTSTRAP.md", "supabase/STAGING_READ_ONLY_AUDIT.sql",
  "supabase/migrations/20261114_scout_workspace_integrity.sql",
  "supabase/migrations/20261115_pfms_global_player_catalogue.sql",
  "supabase/migrations/20261115_pfms_platform_owner_bootstrap.sql",
  "supabase/migrations/20261115_admin_global_member_directory.sql",
  "supabase/migrations/20261116_pfms_owner_bootstrap_registration_guard.sql",
  "supabase/migrations/20261116_pfms_legacy_admin_compat.sql",
  "supabase/migrations/20261116_pfms_system_event_monitoring.sql",
  "supabase/migrations/20261117_pfms_system_event_hardening.sql",
  "supabase/migrations/20261117_pfms_main_media_library.sql"
];

for (const path of requiredFiles) {
  await fs.access(path);
}

const viewIds = new Set(
  [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1])
);
const navViews = new Set(
  [...html.matchAll(/data-view=["']([^"']+)["']/g)].map((match) => match[1])
);
for (const view of navViews) {
  assert.ok(viewIds.has("view-" + view), "Navigation target has no view section: " + view);
}

for (const tag of html.matchAll(/<(script|link)\b([^>]*)>/gi)) {
  const attribute = tag[1].toLowerCase() === "script" ? "src" : "href";
  const pattern = new RegExp("\\b" + attribute + "=['\"]([^'\"]+)['\"]", "i");
  const value = tag[2].match(pattern)?.[1];
  if (!value || /^(https?:|data:|#)/i.test(value)) continue;
  const localPath = decodeURIComponent(value.split("?")[0]);
  await fs.access(localPath);
}

assert.ok(!html.includes("\\n  "), "index.html contains literal escaped line breaks");
assert.ok(!html.includes("PROFESSIONAL FOOTBALL"), "Old public-facing product spelling remains");
assert.ok(app.includes("persistSession: true"), "Supabase session persistence must remain enabled");
assert.ok(app.includes("shouldShowWelcome = showIntro || showReturningGreeting"), "Welcome animation must remain conditional");
assert.ok(app.includes("finishAuthentication();"), "Authentication must complete after the reload path");

assert.ok(cors.includes("PFMS_ALLOWED_ORIGINS") && cors.includes("DEFAULT_ALLOWED_ORIGINS"), "Shared CORS allowlist is missing");
assert.ok(usernameLogin.includes("corsForRequest") && r2Check.includes("corsForRequest") && ownerBootstrap.includes("corsForRequest"), "All Edge Functions must use shared CORS");
assert.ok(!usernameLogin.includes('"Access-Control-Allow-Origin": "*"') && !r2Check.includes('"Access-Control-Allow-Origin": "*"'), "Edge Functions must not use wildcard CORS");
assert.ok(usernameLogin.includes('"Cache-Control": "no-store"'), "Username login tokens must not be cached");
assert.ok(JSON.parse(denoConfigText).nodeModulesDir === "auto", "Deno npm dependency resolution must be enabled");
assert.ok(qualityWorkflow.includes("deno check") && qualityWorkflow.includes("pfms-owner-bootstrap/index.ts"), "CI must type-check all Supabase Edge Functions");

assert.ok(html.includes('data-registration-choice="owner_bootstrap"'), "Dedicated owner registration choice is missing");
assert.ok(html.includes('id="ownerBootstrapSection"') && html.includes('id="ownerBootstrapForm"'), "Owner activation interface is missing");
assert.ok(app.includes("pfms_owner_setup_available") && app.includes("pfms-owner-bootstrap"), "Owner activation UI is not connected");
assert.ok(ownerBootstrap.includes("auth.getUser()") && ownerBootstrap.includes("email_confirmed_at"), "Owner bootstrap must verify an authenticated, confirmed user");
assert.ok(ownerBootstrap.includes("PFMS_OWNER_BOOTSTRAP_TOKEN") && ownerBootstrap.includes("constantTimeEqual"), "Owner bootstrap secret validation is missing");
assert.ok(ownerBootstrap.includes("pfms_claim_initial_owner") && ownerBootstrap.includes("userData.user.id"), "Owner claim must derive the user ID from the verified JWT");
assert.ok(ownerMigration.includes("singleton boolean primary key") && ownerMigration.includes("'service_role'"), "Owner database claim must be one-time and service-role-only");
assert.ok(ownerGuardMigration.includes("after insert on auth.users") && ownerGuardMigration.includes("pfms_owner_bootstrap_requests"), "Owner registration eligibility must be recorded at initial signup");
assert.ok(ownerGuardMigration.includes("revoke all on table public.pfms_owner_bootstrap_requests"), "Owner registration evidence must not be user-accessible");
assert.ok(ownerGuide.includes("PFMS_OWNER_BOOTSTRAP_TOKEN") && ownerGuide.includes("STAGING"), "Owner staging guide is incomplete");
assert.ok(supabaseConfig.includes("[functions.pfms-owner-bootstrap]") && supabaseConfig.includes("verify_jwt = true"), "Owner Edge Function must require JWT verification");

assert.ok(html.includes('id="pfmsAdminMembersFilterForm"') && html.includes('id="pfmsAdminMembersResults"'), "Admin member directory UI is missing");
assert.ok(app.includes("pfms_admin_list_legacy_members") && app.includes("pfms_admin_update_legacy_membership"), "Admin member directory read/write actions are not connected");
assert.ok(adminMembersMigration.includes("security definer") && adminMembersMigration.includes("public.pfms_is_admin()"), "Admin member directory must enforce server-side administrator authorization");
assert.ok(adminMembersMigration.includes("grant execute on function public.pfms_admin_list_legacy_members"), "Admin member directory RPC grant is missing");
assert.ok(legacyOrgAdminMigration.includes("pfms_admin_update_legacy_membership"), "Legacy membership update RPC is missing");
assert.ok(legacyAdminCompatMigration.includes("create or replace function public.is_admin()") && legacyAdminCompatMigration.includes("select public.pfms_is_admin()"), "Legacy admin authorization compatibility bridge is missing");

assert.ok(app.includes("pfms_global_players") && app.includes("pfms_main_scouting_reports"), "Main player catalogue and reports must use Supabase");
assert.ok(app.includes("data-global-player-edit") && app.includes("data-global-player-delete"), "Global player edit/delete controls are missing");
assert.ok(app.includes("editingGlobalPlayerId") && app.includes("query.update(row)"), "Global player edits must be persisted");
assert.ok(app.includes("data-main-report-edit") && app.includes("data-main-report-delete"), "Main scouting report edit/delete controls are missing");
assert.ok(app.includes("editingMainReportId") && app.includes("query.update(payload)"), "Main report edits must be persisted");
assert.ok(app.includes("authorId === window.pfssCurrentUserId"), "Report management must be limited to the author or an administrator");
assert.ok(globalCatalogueMigration.includes("author_id = auth.uid() or public.pfms_is_admin()"), "Main report RLS must restrict access to author/admin");
assert.ok(globalCatalogueMigration.includes("on delete restrict") && globalCatalogueMigration.includes("pfms_import_legacy_catalogue"), "Player history and transactional legacy import must be protected");
assert.ok(stagingAudit.includes("'pfms_global_players'") && stagingAudit.includes("'pfms_main_scouting_reports'"), "Staging audit must inspect the main catalogue");

assert.ok(html.includes('id="mainMediaStatus"') && html.includes('id="mediaGrid"'), "Main media library UI is missing");
assert.ok(!html.includes("Cloud-Upload wird in einem späteren Schritt angebunden"), "Main media UI must not advertise local-only storage");
assert.ok(app.includes("function loadPfmsMainMedia") && app.includes("function renderPfmsMainMedia"), "Main media load/render functions are missing");
assert.ok(app.includes("PFMS_MAIN_MEDIA_BUCKET") && app.includes(".upload(storagePath, file"), "Main media upload is not connected to private Storage");
assert.ok(app.includes("createSignedUrl") && app.includes("data-main-media-delete") && app.includes("deleteMainMedia"), "Main media signed display/delete is missing");
assert.ok(app.includes("PFMS_MAIN_MEDIA_MAX_SIZE") && app.includes("PFMS_MAIN_MEDIA_ALLOWED_TYPES"), "Main media size/MIME allowlists are missing");
assert.ok(app.includes("await loadPfmsMainMedia();") && app.includes("view === 'media'"), "Main media must load at login and when the view opens");
assert.ok(!app.includes("document.querySelectorAll('input[type=file]:not(#mediaInput)')"), "Unrelated file inputs must not be sent to the media uploader");
assert.ok(mainMediaMigration.includes("force row level security") && mainMediaMigration.includes("owner_id = auth.uid()"), "Main media table must use forced owner-scoped RLS");
assert.ok(mainMediaMigration.includes("storage_path ~") && mainMediaMigration.includes("/main/"), "Main media objects must stay in the owner's private folder");
assert.ok(mainMediaMigration.includes("pfss-scout-private") && mainMediaMigration.includes("public = false"), "Main media must use the existing private bucket");
assert.ok(stagingAudit.includes("'pfms_main_media'"), "Staging audit must inspect the main media table");

assert.ok(scout.includes("pfss_scout_players") && scout.includes("pfss_scout_reports") && scout.includes("pfss_scout_media"), "Scout workspace must use private Supabase tables");
assert.ok(scout.includes(".storage.from(BUCKET).upload") && scout.includes("createSignedUrl") && scout.includes(".storage.from(BUCKET).remove"), "Scout workspace private media CRUD is incomplete");
assert.ok(scout.includes("data-scout-edit-player") && scout.includes("data-scout-delete-player") && scout.includes("data-scout-edit-report") && scout.includes("data-scout-delete-report"), "Scout player/report CRUD controls are incomplete");
assert.ok(!/demoPlayers|demoReports|DESIGNVORSCHAU|TECHNISCHE ANBINDUNG FOLGT/i.test(scout), "Scout workspace must not ship demo data or preview copy");
assert.ok(scoutIntegrityMigration.includes("pfss_scout_players_touch_updated_at") && scoutIntegrityMigration.includes("pfss_scout_reports_touch_updated_at"), "Scout updated_at triggers are missing");
assert.ok(scoutIntegrityMigration.includes("pfss_scout_media_insert") && scoutIntegrityMigration.includes("storage_path ~"), "Scout media path integrity check is missing");

assert.ok(html.includes('id="pfmsAdminErrorsFilterForm"') && html.includes('id="pfmsAdminErrorsResults"'), "Admin error log interface is missing");
assert.ok(app.includes("function pfmsSanitizeLogValue") && app.includes("setupPfmsClientErrorLogging()"), "Client error logging with redaction is missing");
const loggerStart = app.indexOf("async function pfmsLogClientError");
const loggerEnd = app.indexOf("\nfunction setupPfmsClientErrorLogging", loggerStart);
const loggerCode = app.slice(loggerStart, loggerEnd);
assert.ok(loggerStart >= 0 && !loggerCode.includes("stack:"), "Error telemetry must not persist stack traces");
assert.ok(app.includes("[redacted-token]") && app.includes("[email]") && app.includes("pfmsClientErrorCount >= 5"), "Error telemetry redaction/rate limits are missing");
assert.ok(app.includes(".from('pfms_system_events').insert") && app.includes("function setupPfmsAdminErrors()"), "Error event collection/admin review is not connected");
assert.ok(systemEventsMigration.includes("force row level security") && systemEventsMigration.includes("public.pfms_is_admin()"), "System event RLS must protect data and admin reads");
assert.ok(systemEventsMigration.includes("pfms_system_events_insert_own") && systemEventsMigration.includes("pfms_system_events_admin_select"), "System event insert/read policies are missing");
assert.ok(systemEventsHardeningMigration.includes("revoke update on table public.pfms_system_events"), "System event-wide updates must be revoked");
assert.ok(systemEventsHardeningMigration.includes("grant update (status, resolved_at, resolved_by)"), "Only system event status metadata may be updated");
assert.ok(systemEventsHardeningMigration.includes("System event evidence is immutable"), "System event evidence must not be editable");
assert.ok(systemEventsHardeningMigration.includes("Sensitive values are not allowed in system event logs"), "Database must reject common secret/token patterns");
assert.ok(systemEventsHardeningMigration.includes("new.resolved_by := auth.uid()"), "Resolution attribution must be set server-side");
assert.ok(app.includes(".update({ status })"), "Admin event triage must only update status");
assert.ok(stagingAudit.includes("'pfms_system_events'"), "Staging audit must inspect system event logs");

assert.ok(app.includes("exportPfssBackup") && app.includes("importPfssBackup"), "Local backup export/import functionality is missing");
assert.ok(app.includes("product: 'PFMS'"), "Backup data must carry the PFMS product marker");
assert.ok(app.includes("function safePfmsMediaFileName"), "Cloud media filenames must be sanitized");

const knownGaps = [];
if (html.includes("Mitglied aufnehmen") && html.includes("data-skeleton-action")) knownGaps.push("Vereins-Mitgliedsaufnahme bleibt bis zur Staging-Schemafreigabe ein Platzhalter.");
if (html.includes("kein Zahlungsanbieter angebunden")) knownGaps.push("Zahlungsanbieter und Webhooks sind noch nicht integriert.");
if (html.includes("automatische Protokollierung ist noch nicht angebunden")) knownGaps.push("Fehlerüberwachung ist noch nicht vollständig angebunden.");
if (html.includes("Mannschaft anlegen") && html.includes("data-skeleton-action")) knownGaps.push("Mannschafts- und Trainerworkflows benötigen noch das kanonische Organisationsmodell.");

console.log("PFMS smoke tests passed. " + navViews.size + " navigation targets verified.");
if (knownGaps.length) {
  console.log("\nKnown unfinished areas (tracked, not hidden):");
  for (const gap of knownGaps) console.log("- " + gap);
}
