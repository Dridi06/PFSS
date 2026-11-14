import fs from "node:fs/promises";
import assert from "node:assert/strict";

const read = (path) => fs.readFile(path, "utf8");

const [
  html,
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
  mainMediaMigration
] = await Promise.all([
  read("index.html"),
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
  read("supabase/migrations/20261117_pfms_main_media_library.sql")
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
  "docs/OWNER_BOOTSTRAP.md",
  "supabase/STAGING_READ_ONLY_AUDIT.sql",
  "supabase/migrations/20261115_pfms_platform_owner_bootstrap.sql",
  "supabase/migrations/20261116_pfms_owner_bootstrap_registration_guard.sql",
  "supabase/migrations/20261115_pfms_global_player_catalogue.sql",
  "supabase/migrations/20261115_admin_global_member_directory.sql",
  "supabase/migrations/20261116_pfms_system_event_monitoring.sql",
  "supabase/migrations/20261117_pfms_system_event_hardening.sql",
  "supabase/migrations/20261117_pfms_main_media_library.sql",
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
  if (/^(https?:|data:|mailto:|tel:|#|javascript:)/i.test(value)) continue;
  const localPath = decodeURIComponent(value.split("?")[0].split("#")[0]).replace(/^\.\//, "");
  if (localPath) await fs.access(localPath);
}

assert.ok(!html.includes("\\n  "), "index.html contains literal escaped line breaks");
assert.ok(!html.includes("PROFESSIONAL FOOTBALL"), "Old public-facing product spelling remains");
assert.ok(html.includes("PFMS – Professionell Football Management System"), "PFMS brand is missing");
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
assert.ok(usernameLogin.includes("corsForRequest") && r2Check.includes("corsForRequest"), "Edge Functions must use shared CORS policy");
assert.ok(!usernameLogin.includes('"Access-Control-Allow-Origin": "*"'), "Username login must not allow wildcard CORS");
assert.ok(!r2Check.includes('"Access-Control-Allow-Origin": "*"'), "R2 check must not allow wildcard CORS");
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
