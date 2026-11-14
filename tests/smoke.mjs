import fs from "node:fs/promises";
import assert from "node:assert/strict";

const read = (path) => fs.readFile(path, "utf8");
const html = await read("index.html");
const app = await read("app.js");
const scout = await read("scout-workspace.js");
const cors = await read("supabase/functions/_shared/cors.ts");
const usernameLogin = await read("supabase/functions/username-login/index.ts");
const r2Check = await read("supabase/functions/r2-connection-check/index.ts");
const ownerBootstrap = await read("supabase/functions/pfms-owner-bootstrap/index.ts");
const ownerMigration = await read("supabase/migrations/20261115_pfms_platform_owner_bootstrap.sql");
const ownerGuardMigration = await read("supabase/migrations/20261116_pfms_owner_bootstrap_registration_guard.sql");
const stagingAudit = await read("supabase/STAGING_READ_ONLY_AUDIT.sql");
const ownerGuide = await read("docs/OWNER_BOOTSTRAP.md");
const adminMembersMigration = await read("supabase/migrations/20261115_admin_global_member_directory.sql");
const legacyOrgAdminMigration = await read("supabase/migrations/20261111_admin_legacy_organization_management.sql");
const legacyAdminCompatMigration = await read("supabase/migrations/20261116_pfms_legacy_admin_compat.sql");

const supabaseConfig = await read("supabase/config.toml");
const globalCatalogueMigration = await read("supabase/migrations/20261115_pfms_global_player_catalogue.sql");
const systemEventsMigration = await read("supabase/migrations/20261116_pfms_system_event_monitoring.sql");
const systemEventsHardeningMigration = await read("supabase/migrations/20261117_pfms_system_event_hardening.sql");
const mainMediaMigration = await read("supabase/migrations/20261117_pfms_main_media_library.sql");

const requiredFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "scout-workspace.js",
  "scout-workspace.css",
  "pfms-logo.svg",
  "rechtliches.html",
  "supabase/migrations/20261115_pfms_platform_owner_bootstrap.sql",
  "supabase/functions/pfms-owner-bootstrap/index.ts",
  "supabase/migrations/20261115_admin_global_member_directory.sql",
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
  const doubleQuoted = tag[2].match(new RegExp("\\b" + attribute + '="([^"]+)"', "i"))?.[1];
  const singleQuoted = tag[2].match(new RegExp("\\b" + attribute + "='([^']+)'", "i"))?.[1];
  const value = doubleQuoted || singleQuoted;
  if (!value || /^(https?:|data:|#)/i.test(value)) continue;
  const localPath = decodeURIComponent(value.split("?")[0]);
  await fs.access(localPath);
}

assert.ok(!html.includes("\\n  "), "index.html contains literal escaped line breaks");
assert.ok(!html.includes("PROFESSIONAL FOOTBALL"), "Old public-facing product spelling remains");
assert.ok(cors.includes("PFMS_ALLOWED_ORIGINS") && cors.includes("DEFAULT_ALLOWED_ORIGINS"), "CORS allowlist configuration is missing");
const denoConfig = JSON.parse(await read("deno.json"));
assert.equal(denoConfig.nodeModulesDir, "auto", "Deno npm dependency resolution must be enabled");
assert.ok(!usernameLogin.includes('"Access-Control-Allow-Origin": "*"'), "Username login must not allow wildcard CORS");
assert.ok(!r2Check.includes('"Access-Control-Allow-Origin": "*"'), "R2 check must not allow wildcard CORS");
assert.ok(usernameLogin.includes('"Cache-Control": "no-store"'), "Username login tokens must not be cached");
assert.ok(usernameLogin.includes("corsForRequest") && r2Check.includes("corsForRequest"), "Edge Functions must use shared CORS policy");
assert.ok(html.includes('data-registration-choice="owner_bootstrap"'), "Owner bootstrap registration choice is missing");
assert.ok(html.includes('id="ownerBootstrapSection"'), "Owner bootstrap activation section is missing");
assert.ok(app.includes("pfms_owner_setup_available") && app.includes("functions.invoke('pfms-owner-bootstrap'"), "Owner bootstrap UI is not connected to its server endpoint");
const ownerVisibilityStart = app.indexOf("async function updateOwnerBootstrapVisibility(user)");
const ownerVisibilityEnd = app.indexOf("\nfunction showPendingScreen", ownerVisibilityStart);
const ownerVisibilityCode = app.slice(ownerVisibilityStart, ownerVisibilityEnd);
assert.ok(ownerVisibilityStart >= 0 && ownerVisibilityCode.includes("user?.user_metadata?.registration_type !== 'owner_bootstrap'"), "Only dedicated owner registrations may see the owner activation panel");
assert.ok(ownerVisibilityCode.includes("section.hidden = true"), "Owner activation must be hidden by default");
assert.ok(app.includes("showPendingScreen(profile.status, user)"), "Pending profile flow must pass verified user metadata to owner visibility checks");
assert.ok(ownerBootstrap.includes("auth.getUser()") && ownerBootstrap.includes("email_confirmed_at"), "Owner bootstrap must validate a confirmed authenticated account");
assert.ok(ownerBootstrap.includes("registration_type") && ownerBootstrap.includes('"owner_bootstrap"'), "Owner bootstrap must require the dedicated registration type");
assert.ok(ownerBootstrap.includes("PFMS_OWNER_BOOTSTRAP_TOKEN") && ownerBootstrap.includes("constantTimeEqual"), "Owner bootstrap secret comparison is missing");
assert.ok(ownerBootstrap.includes("pfms_claim_initial_owner"), "Owner bootstrap must use the privileged one-time database claim");
assert.ok(ownerMigration.includes("singleton boolean primary key") && ownerMigration.includes("service_role"), "Owner migration must enforce one service-role-only owner claim");
assert.ok(ownerMigration.includes("An approved administrator already exists"), "Owner bootstrap must refuse to create a second root identity");
assert.ok(ownerGuardMigration.includes("pfms_owner_bootstrap_requests"), "Owner registration eligibility table is missing");
assert.ok(ownerGuardMigration.includes("after insert on auth.users"), "Owner eligibility must be recorded at initial account creation");
assert.ok(ownerGuardMigration.includes("claimed_at is null") && ownerGuardMigration.includes("for update"), "Owner registration request must be locked and claimable only once");
assert.ok(ownerGuardMigration.includes("revoke all on table public.pfms_owner_bootstrap_requests from public, anon, authenticated"), "Owner registration evidence must not be user-readable or writable");
assert.ok(stagingAudit.includes("'pfms_owner_bootstrap_requests'"), "Read-only audit must inspect immutable owner registration requests");
assert.ok(stagingAudit.includes("'pfms_platform_owner'"), "Read-only staging audit must inspect the owner singleton table");
assert.ok(ownerGuide.includes("Staging") && ownerGuide.includes("PFMS_OWNER_BOOTSTRAP_TOKEN"), "Owner bootstrap staging guide is incomplete");
assert.ok(ownerMigration.includes("An approved administrator already exists") && ownerMigration.includes("pfms_owner_setup_available"), "Owner migration must gate setup when an administrator already exists");
assert.ok(ownerBootstrap.includes("Verified owner registration required"), "Owner endpoint must reject unverified or non-owner registration accounts");
assert.ok(html.includes('data-registration-choice="owner_bootstrap"'), "Owner registration choice is missing");
assert.ok(html.includes('id="ownerBootstrapForm"') && html.includes('id="ownerBootstrapToken"'), "Owner activation form is missing");
assert.ok(app.includes("pfms_owner_setup_available") && app.includes("pfms-owner-bootstrap"), "Owner availability or activation wiring is missing");
assert.ok(ownerBootstrap.includes("PFMS_OWNER_BOOTSTRAP_TOKEN") && ownerBootstrap.includes("pfms_claim_initial_owner"), "Owner bootstrap secret or claim call is missing");
assert.ok(ownerBootstrap.includes("auth.getUser()") && ownerBootstrap.includes("userData.user.id") && !/payload[^;]*p_user_id/s.test(ownerBootstrap), "Owner bootstrap must derive identity from verified JWT, not request body");
assert.ok(ownerMigration.includes("singleton boolean primary key") && ownerMigration.includes("auth.role()") && ownerMigration.includes("'service_role'"), "Owner migration must enforce a single server-side owner claim");
assert.ok(supabaseConfig.includes("[functions.pfms-owner-bootstrap]") && supabaseConfig.includes("verify_jwt = true"), "Owner bootstrap must require JWT verification");
assert.ok(app.includes("pfms_global_players") && app.includes("pfms_main_scouting_reports"), "Main player catalogue and reports must use Supabase");
assert.ok(app.includes("data-global-player-edit") && app.includes("data-global-player-delete"), "Global player edit/delete controls are missing");
assert.ok(app.includes("editingGlobalPlayerId") && app.includes("query.update(row)"), "Global player updates must be persisted to Supabase");
assert.ok(app.includes("editingMainReportId"), "Main report edit state is missing");
assert.ok(app.includes("data-main-report-edit") && app.includes("data-main-report-delete"), "Main report edit/delete controls are missing");
assert.ok(app.includes("query.update(payload)") && app.includes("query.insert(payload)"), "Main report create/update must use Supabase");
assert.ok(app.includes("authorId === window.pfssCurrentUserId") && app.includes("window.pfssIsRealAdmin"), "Report controls must be limited to report authors and administrators");
assert.ok(html.includes('id="mainMediaStatus"') && html.includes('id="mediaGrid"'), "Main media library UI is missing");
assert.ok(!html.includes("Cloud-Upload wird in einem späteren Schritt angebunden"), "Main media UI must not advertise local-only storage");
assert.ok(app.includes("function loadPfmsMainMedia") && app.includes("function renderPfmsMainMedia"), "Main media cloud load/render functions are missing");
assert.ok(app.includes("PFMS_MAIN_MEDIA_BUCKET") && app.includes(".upload(storagePath, file"), "Main media must upload files to the private bucket");
assert.ok(app.includes("createSignedUrl") && app.includes("data-main-media-delete") && app.includes("deleteMainMedia"), "Main media must privately display and delete files");
assert.ok(app.includes("await loadPfmsMainMedia();") && app.includes("view === 'media'"), "Main media must load at authentication and when its view opens");
assert.ok(!app.includes("document.querySelectorAll('input[type=file]:not(#mediaInput)')"), "Unrelated file inputs such as backups must not be routed into media uploads");
assert.ok(app.includes("PFMS_MAIN_MEDIA_MAX_SIZE") && app.includes("PFMS_MAIN_MEDIA_ALLOWED_TYPES"), "Main media uploads must enforce size and MIME allowlists");
assert.ok(mainMediaMigration.includes("force row level security") && mainMediaMigration.includes("owner_id = auth.uid()"), "Main media metadata must be protected by forced owner-scoped RLS");
assert.ok(mainMediaMigration.includes("pfss-scout-private") && mainMediaMigration.includes("public = false"), "Main media must use the existing private bucket");
assert.ok(mainMediaMigration.includes("storage_path ~") && mainMediaMigration.includes("/main/"), "Main media path must stay inside the authenticated user folder");
assert.ok(globalCatalogueMigration.includes("author_id = auth.uid() or public.pfms_is_admin()"), "Report RLS must restrict read/update/delete to the author or an administrator");
assert.ok(globalCatalogueMigration.includes("on delete restrict"), "Player deletion must preserve reports rather than cascade-delete history");
assert.ok(app.includes("pfms_import_legacy_catalogue") && app.includes("importLegacyLocalData"), "Legacy local data must have an explicit safe cloud import path");
assert.ok(globalCatalogueMigration.includes("public.pfms_global_players") && globalCatalogueMigration.includes("public.pfms_main_scouting_reports"), "Persistent global catalogue migration is incomplete");
assert.ok(globalCatalogueMigration.includes("public.pfms_is_admin()") && globalCatalogueMigration.includes("pfms_current_user_is_approved"), "Global catalogue RLS must enforce approved users and administrator writes");
assert.ok(globalCatalogueMigration.includes("enable row level security") && globalCatalogueMigration.includes("pfms_main_scouting_reports"), "Main cloud catalogue must have RLS and persistent reports");
assert.ok(globalCatalogueMigration.includes("pfms_import_legacy_catalogue") && globalCatalogueMigration.includes("jsonb_array_length"), "Legacy local backups must use a bounded transactional cloud import");
assert.ok(stagingAudit.includes("'pfms_global_players'") && stagingAudit.includes("'pfms_main_scouting_reports'"), "Read-only audit must inspect main catalogue tables");
assert.ok(systemEventsMigration.includes("force row level security") && systemEventsMigration.includes("public.pfms_is_admin()"), "System events must be protected by forced RLS and PFMS admin review policies");
assert.ok(systemEventsMigration.includes("pfms_system_events_insert_own") && systemEventsMigration.includes("pfms_system_events_admin_select"), "System events must separate user inserts from administrator reads");
assert.ok(systemEventsHardeningMigration.includes("revoke update on table public.pfms_system_events"), "System event table-wide updates must be revoked");
assert.ok(systemEventsHardeningMigration.includes("grant update (status, resolved_at, resolved_by)"), "Only event workflow fields may be updated");
assert.ok(systemEventsHardeningMigration.includes("System event evidence is immutable"), "System event evidence must be immutable after insert");
assert.ok(systemEventsHardeningMigration.includes("Sensitive values are not allowed in system event logs"), "Database must reject common secret/token patterns");
assert.ok(systemEventsHardeningMigration.includes("new.resolved_by := auth.uid()"), "Resolved events must be attributed to the authenticated administrator");
assert.ok(app.includes(".update({ status })"), "Admin event updates must only change workflow status");

assert.ok(!systemEventsMigration.includes("grant select, insert, update, delete on table public.pfms_system_events"), "System events must not grant delete access");
assert.ok(html.includes('id="pfmsAdminErrorsFilterForm"') && html.includes('id="pfmsAdminErrorsResults"'), "Admin error log interface is missing");
assert.ok(app.includes("function pfmsSanitizeLogValue") && app.includes("setupPfmsClientErrorLogging()"), "Client error logging with redaction is missing");
const errorLoggerStart = app.indexOf("async function pfmsLogClientError");
const errorLoggerEnd = app.indexOf("\\nfunction setupPfmsClientErrorLogging", errorLoggerStart);
const errorLoggerCode = app.slice(errorLoggerStart, errorLoggerEnd);
assert.ok(errorLoggerStart >= 0 && !errorLoggerCode.includes("stack:"), "Client error telemetry must not persist stack traces");
assert.ok(app.includes("[redacted-token]") && app.includes("[email]"), "Client error telemetry must redact tokens and email addresses");
assert.ok(app.includes("function pfmsSanitizeLogPath") && app.includes("'[id]'"), "Client error routes must redact ID-like path segments");
assert.ok(app.includes("pfmsClientErrorCount >= 5"), "Client error telemetry must be rate-limited");
assert.ok(app.includes("addEventListener('unhandledrejection'") && app.includes("addEventListener('error'"), "Frontend error handlers are missing");
assert.ok(app.includes(".from('pfms_system_events').insert") && app.includes("function setupPfmsAdminErrors()"), "Error reporting and admin review are not connected");
assert.ok(stagingAudit.includes("'pfms_system_events'"), "Read-only audit must inspect the system event log");
assert.ok(globalCatalogueMigration.includes("pfms_import_legacy_catalogue") && globalCatalogueMigration.includes("jsonb_array_length"), "Transactional, bounded legacy backup import is missing");
assert.ok(adminMembersMigration.includes("public.pfms_is_admin()") && !adminMembersMigration.includes("public.is_admin()"), "Admin member directory must use the existing PFMS admin helper");
assert.ok(legacyOrgAdminMigration.includes("pfms_admin_update_legacy_membership"), "Legacy membership update RPC used by the admin interface is missing");
assert.ok(legacyAdminCompatMigration.includes("create or replace function public.is_admin()") && legacyAdminCompatMigration.includes("select public.pfms_is_admin()"), "Legacy admin RPC compatibility bridge is missing");

assert.ok(systemEventsMigration.includes("public.pfms_is_admin()") && !systemEventsMigration.includes("public.is_admin()"), "System event policies must use the existing PFMS admin helper");
assert.ok(mainMediaMigration.includes("public.pfms_main_media") && mainMediaMigration.includes("pfss-scout-private") && mainMediaMigration.includes("enable row level security"), "Private main media migration is incomplete");
assert.ok(mainMediaMigration.includes("storage_path ~ ('^' || auth.uid()::text || '/main/[^/]+

assert.ok(!globalCatalogueMigration.includes("pg_catalog.current_date"), "Migration must use valid PostgreSQL date syntax");

assert.ok(html.includes('id="pfmsAdminMembersFilterForm"') && html.includes('id="pfmsAdminMembersResults"'), "Admin member directory UI is missing");
assert.ok(app.includes("function loadPfmsAdminMembers()") && app.includes("pfms_admin_list_legacy_members"), "Admin member directory is not connected to its database RPC");
assert.ok(app.includes("pfms_admin_update_legacy_membership"), "Admin member role/status updates are not connected");
assert.ok(adminMembersMigration.includes("security definer") && adminMembersMigration.includes("public.pfms_is_admin()"), "Global membership directory must enforce server-side administrator authorization");
assert.ok(adminMembersMigration.includes("revoke all on function public.pfms_admin_list_legacy_members") && adminMembersMigration.includes("grant execute on function public.pfms_admin_list_legacy_members"), "Global membership directory RPC grants are incomplete");

assert.match(app, /persistSession:\s*true/, "Supabase session persistence must stay enabled");
assert.match(app, /shouldShowWelcome\s*=\s*showIntro\s*\|\|\s*showReturningGreeting/, "Welcome animation must be conditional");
assert.match(app, /finishAuthentication\(\);/, "Authentication must complete after the reload path");
assert.ok(
  app.includes("pfss_admin_list_profiles") && app.includes("pfss_admin_update_profile"),
  "Expected admin profile RPC integration is missing"
);
assert.ok(
  (await read("supabase/migrations/20261111_organizations_memberships_permissions.sql")).length > 0,
  "Organization foundation migration is missing"
);
assert.ok(
  (await read("supabase/migrations/20261112_private_scout_workspaces.sql")).length > 0,
  "Private scout workspace migration is missing"
);
const scoutIntegrityMigration = await read("supabase/migrations/20261114_scout_workspace_integrity.sql");
assert.match(scoutIntegrityMigration, /pfss_scout_players_touch_updated_at/);
assert.match(scoutIntegrityMigration, /pfss_scout_reports_touch_updated_at/);
assert.match(scoutIntegrityMigration, /pfss_scout_reports_rating_range/);
assert.match(scoutIntegrityMigration, /pfss_scout_media_insert/);
assert.match(scoutIntegrityMigration, /storage_path ~/);
assert.ok(
  scoutIntegrityMigration.includes("storage_path ~ ('^' || auth.uid()::text || '/[^/]+$')"),
  "Scout media metadata must be limited to the uploader's private storage folder"
);
assert.ok(
  !/\n\)\s*\);\s*$/m.test(scoutIntegrityMigration),
  "Scout integrity migration has an orphaned policy closure"
);

assert.ok(
  scout.includes("pfss_scout_players") &&
  scout.includes("pfss_scout_reports") &&
  scout.includes("pfss_scout_media"),
  "Scout workspace must use the private Supabase tables"
);
assert.ok(
  scout.includes(".storage.from(BUCKET).upload") &&
  scout.includes("createSignedUrl") &&
  scout.includes(".storage.from(BUCKET).remove"),
  "Scout workspace must upload, privately display and delete media"
);
assert.ok(
  scout.includes("data-scout-edit-player") &&
  scout.includes("data-scout-delete-player") &&
  scout.includes("data-scout-edit-report") &&
  scout.includes("data-scout-delete-report"),
  "Scout workspace CRUD controls are incomplete"
);
assert.ok(
  !/demoPlayers|demoReports|DESIGNVORSCHAU|TECHNISCHE ANBINDUNG FOLGT/i.test(scout),
  "Scout workspace must not ship demo data or preview copy"
);
assert.ok(
  scout.includes("'global-search'") &&
  scout.includes("pfms_global_players") &&
  scout.includes("data-scout-copy-global") &&
  scout.includes("source_global_player_id"),
  "Scout global search and private player copy workflow is missing"
);
assert.ok(
  globalCatalogueMigration.includes("source_global_player_id") &&
  globalCatalogueMigration.includes("pfss_scout_players_owner_global_source_uidx"),
  "Private Scout profiles must link to a global source without duplicate copies"
);

const mediaDeleteStart = scout.indexOf("async function deleteMedia(id)");
const mediaDeleteBody = scout.slice(mediaDeleteStart, scout.indexOf("\n  function bindEvents", mediaDeleteStart));
const storageDeletePosition = mediaDeleteBody.indexOf(".storage.from(BUCKET).remove");
const metadataDeletePosition = mediaDeleteBody.indexOf(".from(TABLES.media).delete");
assert.ok(
  mediaDeleteStart >= 0 && storageDeletePosition >= 0 &&
  metadataDeletePosition > storageDeletePosition,
  "Private media object must be deleted before its metadata row"
);

const knownGaps = [];
if (/let players = read|let reports = read|write\(DB_KEYS/.test(app)) knownGaps.push("Haupt-Spieler und Berichte verwenden noch lokale Speicherung.");
if (!/pfss_scout_players/.test(scout)) knownGaps.push("Scout-Workspace ist noch nicht mit Supabase verbunden.");
for (const [label, pattern] of [
  ["Vereinsworkflow", /Platzhalter|Funktionen folgen/i],
  ["Zahlungsworkflow", /kein Zahlungsanbieter|noch keine Zahlung/i],
  ["Fehlerüberwachung", /automatische Protokollierung ist noch nicht angebunden/i]
]) {
  if (pattern.test(html)) knownGaps.push(label + " ist noch nicht vollständig integriert.");
}

console.log("PFMS smoke tests passed. " + navViews.size + " navigation targets verified.");
if (knownGaps.length) {
  console.log("\nKnown unfinished areas (tracked, not hidden):");
  for (const gap of knownGaps) console.log("- " + gap);
}
)"), "Main media path must stay inside the authenticated user's private folder");
assert.ok(stagingAudit.includes("'pfms_main_media'"), "Read-only audit must inspect the main media metadata table");
assert.ok(globalCatalogueMigration.includes("author_id = auth.uid() or public.pfms_is_admin()"), "Report RLS must restrict read/update/delete to the author or an administrator");
assert.ok(globalCatalogueMigration.includes("on delete restrict"), "Player deletion must preserve reports rather than cascade-delete history");
assert.ok(app.includes("pfms_import_legacy_catalogue") && app.includes("importLegacyLocalData"), "Legacy local data must have an explicit safe cloud import path");
assert.ok(globalCatalogueMigration.includes("public.pfms_global_players") && globalCatalogueMigration.includes("public.pfms_main_scouting_reports"), "Persistent global catalogue migration is incomplete");
assert.ok(globalCatalogueMigration.includes("public.pfms_is_admin()") && globalCatalogueMigration.includes("pfms_current_user_is_approved"), "Global catalogue RLS must enforce approved users and administrator writes");
assert.ok(globalCatalogueMigration.includes("enable row level security") && globalCatalogueMigration.includes("pfms_main_scouting_reports"), "Main cloud catalogue must have RLS and persistent reports");
assert.ok(globalCatalogueMigration.includes("pfms_import_legacy_catalogue") && globalCatalogueMigration.includes("jsonb_array_length"), "Legacy local backups must use a bounded transactional cloud import");
assert.ok(stagingAudit.includes("'pfms_global_players'") && stagingAudit.includes("'pfms_main_scouting_reports'"), "Read-only audit must inspect main catalogue tables");
assert.ok(systemEventsMigration.includes("force row level security") && systemEventsMigration.includes("public.pfms_is_admin()"), "System events must be protected by forced RLS and PFMS admin review policies");
assert.ok(systemEventsMigration.includes("pfms_system_events_insert_own") && systemEventsMigration.includes("pfms_system_events_admin_select"), "System events must separate user inserts from administrator reads");
assert.ok(systemEventsHardeningMigration.includes("revoke update on table public.pfms_system_events"), "System event table-wide updates must be revoked");
assert.ok(systemEventsHardeningMigration.includes("grant update (status, resolved_at, resolved_by)"), "Only event workflow fields may be updated");
assert.ok(systemEventsHardeningMigration.includes("System event evidence is immutable"), "System event evidence must be immutable after insert");
assert.ok(systemEventsHardeningMigration.includes("Sensitive values are not allowed in system event logs"), "Database must reject common secret/token patterns");
assert.ok(systemEventsHardeningMigration.includes("new.resolved_by := auth.uid()"), "Resolved events must be attributed to the authenticated administrator");
assert.ok(app.includes(".update({ status })"), "Admin event updates must only change workflow status");

assert.ok(!systemEventsMigration.includes("grant select, insert, update, delete on table public.pfms_system_events"), "System events must not grant delete access");
assert.ok(html.includes('id="pfmsAdminErrorsFilterForm"') && html.includes('id="pfmsAdminErrorsResults"'), "Admin error log interface is missing");
assert.ok(app.includes("function pfmsSanitizeLogValue") && app.includes("setupPfmsClientErrorLogging()"), "Client error logging with redaction is missing");
const errorLoggerStart = app.indexOf("async function pfmsLogClientError");
const errorLoggerEnd = app.indexOf("\\nfunction setupPfmsClientErrorLogging", errorLoggerStart);
const errorLoggerCode = app.slice(errorLoggerStart, errorLoggerEnd);
assert.ok(errorLoggerStart >= 0 && !errorLoggerCode.includes("stack:"), "Client error telemetry must not persist stack traces");
assert.ok(app.includes("[redacted-token]") && app.includes("[email]"), "Client error telemetry must redact tokens and email addresses");
assert.ok(app.includes("function pfmsSanitizeLogPath") && app.includes("'[id]'"), "Client error routes must redact ID-like path segments");
assert.ok(app.includes("pfmsClientErrorCount >= 5"), "Client error telemetry must be rate-limited");
assert.ok(app.includes("addEventListener('unhandledrejection'") && app.includes("addEventListener('error'"), "Frontend error handlers are missing");
assert.ok(app.includes(".from('pfms_system_events').insert") && app.includes("function setupPfmsAdminErrors()"), "Error reporting and admin review are not connected");
assert.ok(stagingAudit.includes("'pfms_system_events'"), "Read-only audit must inspect the system event log");
assert.ok(globalCatalogueMigration.includes("pfms_import_legacy_catalogue") && globalCatalogueMigration.includes("jsonb_array_length"), "Transactional, bounded legacy backup import is missing");
assert.ok(adminMembersMigration.includes("public.pfms_is_admin()") && !adminMembersMigration.includes("public.pfms_is_admin()"), "Admin member directory must use the existing PFMS admin helper");
assert.ok(legacyOrgAdminMigration.includes("pfms_admin_update_legacy_membership"), "Legacy membership update RPC used by the admin interface is missing");
assert.ok(legacyAdminCompatMigration.includes("create or replace function public.is_admin()") && legacyAdminCompatMigration.includes("select public.pfms_is_admin()"), "Legacy admin RPC compatibility bridge is missing");

assert.ok(systemEventsMigration.includes("public.pfms_is_admin()") && !systemEventsMigration.includes("public.is_admin()"), "System event policies must use the existing PFMS admin helper");

assert.ok(!globalCatalogueMigration.includes("pg_catalog.current_date"), "Migration must use valid PostgreSQL date syntax");

assert.ok(html.includes('id="pfmsAdminMembersFilterForm"') && html.includes('id="pfmsAdminMembersResults"'), "Admin member directory UI is missing");
assert.ok(app.includes("function loadPfmsAdminMembers()") && app.includes("pfms_admin_list_legacy_members"), "Admin member directory is not connected to its database RPC");
assert.ok(app.includes("pfms_admin_update_legacy_membership"), "Admin member role/status updates are not connected");
assert.ok(adminMembersMigration.includes("security definer") && adminMembersMigration.includes("public.pfms_is_admin()"), "Global membership directory must enforce server-side administrator authorization");
assert.ok(adminMembersMigration.includes("revoke all on function public.pfms_admin_list_legacy_members") && adminMembersMigration.includes("grant execute on function public.pfms_admin_list_legacy_members"), "Global membership directory RPC grants are incomplete");

assert.match(app, /persistSession:\s*true/, "Supabase session persistence must stay enabled");
assert.match(app, /shouldShowWelcome\s*=\s*showIntro\s*\|\|\s*showReturningGreeting/, "Welcome animation must be conditional");
assert.match(app, /finishAuthentication\(\);/, "Authentication must complete after the reload path");
assert.ok(
  app.includes("pfss_admin_list_profiles") && app.includes("pfss_admin_update_profile"),
  "Expected admin profile RPC integration is missing"
);
assert.ok(
  (await read("supabase/migrations/20261111_organizations_memberships_permissions.sql")).length > 0,
  "Organization foundation migration is missing"
);
assert.ok(
  (await read("supabase/migrations/20261112_private_scout_workspaces.sql")).length > 0,
  "Private scout workspace migration is missing"
);
const scoutIntegrityMigration = await read("supabase/migrations/20261114_scout_workspace_integrity.sql");
assert.match(scoutIntegrityMigration, /pfss_scout_players_touch_updated_at/);
assert.match(scoutIntegrityMigration, /pfss_scout_reports_touch_updated_at/);
assert.match(scoutIntegrityMigration, /pfss_scout_reports_rating_range/);
assert.match(scoutIntegrityMigration, /pfss_scout_media_insert/);
assert.match(scoutIntegrityMigration, /storage_path ~/);
assert.ok(
  scoutIntegrityMigration.includes("storage_path ~ ('^' || auth.uid()::text || '/[^/]+$')"),
  "Scout media metadata must be limited to the uploader's private storage folder"
);
assert.ok(
  !/\n\)\s*\);\s*$/m.test(scoutIntegrityMigration),
  "Scout integrity migration has an orphaned policy closure"
);

assert.ok(
  scout.includes("pfss_scout_players") &&
  scout.includes("pfss_scout_reports") &&
  scout.includes("pfss_scout_media"),
  "Scout workspace must use the private Supabase tables"
);
assert.ok(
  scout.includes(".storage.from(BUCKET).upload") &&
  scout.includes("createSignedUrl") &&
  scout.includes(".storage.from(BUCKET).remove"),
  "Scout workspace must upload, privately display and delete media"
);
assert.ok(
  scout.includes("data-scout-edit-player") &&
  scout.includes("data-scout-delete-player") &&
  scout.includes("data-scout-edit-report") &&
  scout.includes("data-scout-delete-report"),
  "Scout workspace CRUD controls are incomplete"
);
assert.ok(
  !/demoPlayers|demoReports|DESIGNVORSCHAU|TECHNISCHE ANBINDUNG FOLGT/i.test(scout),
  "Scout workspace must not ship demo data or preview copy"
);
assert.ok(
  scout.includes("'global-search'") &&
  scout.includes("pfms_global_players") &&
  scout.includes("data-scout-copy-global") &&
  scout.includes("source_global_player_id"),
  "Scout global search and private player copy workflow is missing"
);
assert.ok(
  globalCatalogueMigration.includes("source_global_player_id") &&
  globalCatalogueMigration.includes("pfss_scout_players_owner_global_source_uidx"),
  "Private Scout profiles must link to a global source without duplicate copies"
);

const mediaDeleteStart = scout.indexOf("async function deleteMedia(id)");
const mediaDeleteBody = scout.slice(mediaDeleteStart, scout.indexOf("\n  function bindEvents", mediaDeleteStart));
const storageDeletePosition = mediaDeleteBody.indexOf(".storage.from(BUCKET).remove");
const metadataDeletePosition = mediaDeleteBody.indexOf(".from(TABLES.media).delete");
assert.ok(
  mediaDeleteStart >= 0 && storageDeletePosition >= 0 &&
  metadataDeletePosition > storageDeletePosition,
  "Private media object must be deleted before its metadata row"
);

const knownGaps = [];
if (/let players = read|let reports = read|write\(DB_KEYS/.test(app)) knownGaps.push("Haupt-Spieler und Berichte verwenden noch lokale Speicherung.");
if (!/pfss_scout_players/.test(scout)) knownGaps.push("Scout-Workspace ist noch nicht mit Supabase verbunden.");
for (const [label, pattern] of [
  ["Vereinsworkflow", /Platzhalter|Funktionen folgen/i],
  ["Zahlungsworkflow", /kein Zahlungsanbieter|noch keine Zahlung/i],
  ["Fehlerüberwachung", /automatische Protokollierung ist noch nicht angebunden/i]
]) {
  if (pattern.test(html)) knownGaps.push(label + " ist noch nicht vollständig integriert.");
}

console.log("PFMS smoke tests passed. " + navViews.size + " navigation targets verified.");
if (knownGaps.length) {
  console.log("\nKnown unfinished areas (tracked, not hidden):");
  for (const gap of knownGaps) console.log("- " + gap);
}
)"), "Main media must be restricted to the current user's storage folder");
assert.ok(app.includes("async function loadPfmsMainMedia") && app.includes("createSignedUrl") && app.includes("async function addMedia") && app.includes("async function deleteMainMedia"), "Main media cloud upload, signed retrieval or delete is missing");


assert.ok(!globalCatalogueMigration.includes("pg_catalog.current_date"), "Migration must use valid PostgreSQL date syntax");

assert.ok(html.includes('id="pfmsAdminMembersFilterForm"') && html.includes('id="pfmsAdminMembersResults"'), "Admin member directory UI is missing");
assert.ok(app.includes("function loadPfmsAdminMembers()") && app.includes("pfms_admin_list_legacy_members"), "Admin member directory is not connected to its database RPC");
assert.ok(app.includes("pfms_admin_update_legacy_membership"), "Admin member role/status updates are not connected");
assert.ok(adminMembersMigration.includes("security definer") && adminMembersMigration.includes("public.pfms_is_admin()"), "Global membership directory must enforce server-side administrator authorization");
assert.ok(adminMembersMigration.includes("revoke all on function public.pfms_admin_list_legacy_members") && adminMembersMigration.includes("grant execute on function public.pfms_admin_list_legacy_members"), "Global membership directory RPC grants are incomplete");

assert.match(app, /persistSession:\s*true/, "Supabase session persistence must stay enabled");
assert.match(app, /shouldShowWelcome\s*=\s*showIntro\s*\|\|\s*showReturningGreeting/, "Welcome animation must be conditional");
assert.match(app, /finishAuthentication\(\);/, "Authentication must complete after the reload path");
assert.ok(
  app.includes("pfss_admin_list_profiles") && app.includes("pfss_admin_update_profile"),
  "Expected admin profile RPC integration is missing"
);
assert.ok(
  (await read("supabase/migrations/20261111_organizations_memberships_permissions.sql")).length > 0,
  "Organization foundation migration is missing"
);
assert.ok(
  (await read("supabase/migrations/20261112_private_scout_workspaces.sql")).length > 0,
  "Private scout workspace migration is missing"
);
const scoutIntegrityMigration = await read("supabase/migrations/20261114_scout_workspace_integrity.sql");
assert.match(scoutIntegrityMigration, /pfss_scout_players_touch_updated_at/);
assert.match(scoutIntegrityMigration, /pfss_scout_reports_touch_updated_at/);
assert.match(scoutIntegrityMigration, /pfss_scout_reports_rating_range/);
assert.match(scoutIntegrityMigration, /pfss_scout_media_insert/);
assert.match(scoutIntegrityMigration, /storage_path ~/);
assert.ok(
  scoutIntegrityMigration.includes("storage_path ~ ('^' || auth.uid()::text || '/[^/]+$')"),
  "Scout media metadata must be limited to the uploader's private storage folder"
);
assert.ok(
  !/\n\)\s*\);\s*$/m.test(scoutIntegrityMigration),
  "Scout integrity migration has an orphaned policy closure"
);

assert.ok(
  scout.includes("pfss_scout_players") &&
  scout.includes("pfss_scout_reports") &&
  scout.includes("pfss_scout_media"),
  "Scout workspace must use the private Supabase tables"
);
assert.ok(
  scout.includes(".storage.from(BUCKET).upload") &&
  scout.includes("createSignedUrl") &&
  scout.includes(".storage.from(BUCKET).remove"),
  "Scout workspace must upload, privately display and delete media"
);
assert.ok(
  scout.includes("data-scout-edit-player") &&
  scout.includes("data-scout-delete-player") &&
  scout.includes("data-scout-edit-report") &&
  scout.includes("data-scout-delete-report"),
  "Scout workspace CRUD controls are incomplete"
);
assert.ok(
  !/demoPlayers|demoReports|DESIGNVORSCHAU|TECHNISCHE ANBINDUNG FOLGT/i.test(scout),
  "Scout workspace must not ship demo data or preview copy"
);
assert.ok(
  scout.includes("'global-search'") &&
  scout.includes("pfms_global_players") &&
  scout.includes("data-scout-copy-global") &&
  scout.includes("source_global_player_id"),
  "Scout global search and private player copy workflow is missing"
);
assert.ok(
  globalCatalogueMigration.includes("source_global_player_id") &&
  globalCatalogueMigration.includes("pfss_scout_players_owner_global_source_uidx"),
  "Private Scout profiles must link to a global source without duplicate copies"
);

const mediaDeleteStart = scout.indexOf("async function deleteMedia(id)");
const mediaDeleteBody = scout.slice(mediaDeleteStart, scout.indexOf("\n  function bindEvents", mediaDeleteStart));
const storageDeletePosition = mediaDeleteBody.indexOf(".storage.from(BUCKET).remove");
const metadataDeletePosition = mediaDeleteBody.indexOf(".from(TABLES.media).delete");
assert.ok(
  mediaDeleteStart >= 0 && storageDeletePosition >= 0 &&
  metadataDeletePosition > storageDeletePosition,
  "Private media object must be deleted before its metadata row"
);

const knownGaps = [];
if (/let players = read|let reports = read|write\(DB_KEYS/.test(app)) knownGaps.push("Haupt-Spieler und Berichte verwenden noch lokale Speicherung.");
if (!/pfss_scout_players/.test(scout)) knownGaps.push("Scout-Workspace ist noch nicht mit Supabase verbunden.");
for (const [label, pattern] of [
  ["Vereinsworkflow", /Platzhalter|Funktionen folgen/i],
  ["Zahlungsworkflow", /kein Zahlungsanbieter|noch keine Zahlung/i],
  ["Fehlerüberwachung", /automatische Protokollierung ist noch nicht angebunden/i]
]) {
  if (pattern.test(html)) knownGaps.push(label + " ist noch nicht vollständig integriert.");
}

console.log("PFMS smoke tests passed. " + navViews.size + " navigation targets verified.");
if (knownGaps.length) {
  console.log("\nKnown unfinished areas (tracked, not hidden):");
  for (const gap of knownGaps) console.log("- " + gap);
}
)"), "Main media path must stay inside the authenticated user's private folder");
assert.ok(stagingAudit.includes("'pfms_main_media'"), "Read-only audit must inspect the main media metadata table");
assert.ok(globalCatalogueMigration.includes("author_id = auth.uid() or public.pfms_is_admin()"), "Report RLS must restrict read/update/delete to the author or an administrator");
assert.ok(globalCatalogueMigration.includes("on delete restrict"), "Player deletion must preserve reports rather than cascade-delete history");
assert.ok(app.includes("pfms_import_legacy_catalogue") && app.includes("importLegacyLocalData"), "Legacy local data must have an explicit safe cloud import path");
assert.ok(globalCatalogueMigration.includes("public.pfms_global_players") && globalCatalogueMigration.includes("public.pfms_main_scouting_reports"), "Persistent global catalogue migration is incomplete");
assert.ok(globalCatalogueMigration.includes("public.pfms_is_admin()") && globalCatalogueMigration.includes("pfms_current_user_is_approved"), "Global catalogue RLS must enforce approved users and administrator writes");
assert.ok(globalCatalogueMigration.includes("enable row level security") && globalCatalogueMigration.includes("pfms_main_scouting_reports"), "Main cloud catalogue must have RLS and persistent reports");
assert.ok(globalCatalogueMigration.includes("pfms_import_legacy_catalogue") && globalCatalogueMigration.includes("jsonb_array_length"), "Legacy local backups must use a bounded transactional cloud import");
assert.ok(stagingAudit.includes("'pfms_global_players'") && stagingAudit.includes("'pfms_main_scouting_reports'"), "Read-only audit must inspect main catalogue tables");
assert.ok(systemEventsMigration.includes("force row level security") && systemEventsMigration.includes("public.pfms_is_admin()"), "System events must be protected by forced RLS and PFMS admin review policies");
assert.ok(systemEventsMigration.includes("pfms_system_events_insert_own") && systemEventsMigration.includes("pfms_system_events_admin_select"), "System events must separate user inserts from administrator reads");
assert.ok(systemEventsHardeningMigration.includes("revoke update on table public.pfms_system_events"), "System event table-wide updates must be revoked");
assert.ok(systemEventsHardeningMigration.includes("grant update (status, resolved_at, resolved_by)"), "Only event workflow fields may be updated");
assert.ok(systemEventsHardeningMigration.includes("System event evidence is immutable"), "System event evidence must be immutable after insert");
assert.ok(systemEventsHardeningMigration.includes("Sensitive values are not allowed in system event logs"), "Database must reject common secret/token patterns");
assert.ok(systemEventsHardeningMigration.includes("new.resolved_by := auth.uid()"), "Resolved events must be attributed to the authenticated administrator");
assert.ok(app.includes(".update({ status })"), "Admin event updates must only change workflow status");

assert.ok(!systemEventsMigration.includes("grant select, insert, update, delete on table public.pfms_system_events"), "System events must not grant delete access");
assert.ok(html.includes('id="pfmsAdminErrorsFilterForm"') && html.includes('id="pfmsAdminErrorsResults"'), "Admin error log interface is missing");
assert.ok(app.includes("function pfmsSanitizeLogValue") && app.includes("setupPfmsClientErrorLogging()"), "Client error logging with redaction is missing");
const errorLoggerStart = app.indexOf("async function pfmsLogClientError");
const errorLoggerEnd = app.indexOf("\\nfunction setupPfmsClientErrorLogging", errorLoggerStart);
const errorLoggerCode = app.slice(errorLoggerStart, errorLoggerEnd);
assert.ok(errorLoggerStart >= 0 && !errorLoggerCode.includes("stack:"), "Client error telemetry must not persist stack traces");
assert.ok(app.includes("[redacted-token]") && app.includes("[email]"), "Client error telemetry must redact tokens and email addresses");
assert.ok(app.includes("function pfmsSanitizeLogPath") && app.includes("'[id]'"), "Client error routes must redact ID-like path segments");
assert.ok(app.includes("pfmsClientErrorCount >= 5"), "Client error telemetry must be rate-limited");
assert.ok(app.includes("addEventListener('unhandledrejection'") && app.includes("addEventListener('error'"), "Frontend error handlers are missing");
assert.ok(app.includes(".from('pfms_system_events').insert") && app.includes("function setupPfmsAdminErrors()"), "Error reporting and admin review are not connected");
assert.ok(stagingAudit.includes("'pfms_system_events'"), "Read-only audit must inspect the system event log");
assert.ok(globalCatalogueMigration.includes("pfms_import_legacy_catalogue") && globalCatalogueMigration.includes("jsonb_array_length"), "Transactional, bounded legacy backup import is missing");
assert.ok(adminMembersMigration.includes("public.pfms_is_admin()") && !adminMembersMigration.includes("public.pfms_is_admin()"), "Admin member directory must use the existing PFMS admin helper");
assert.ok(legacyOrgAdminMigration.includes("pfms_admin_update_legacy_membership"), "Legacy membership update RPC used by the admin interface is missing");
assert.ok(legacyAdminCompatMigration.includes("create or replace function public.is_admin()") && legacyAdminCompatMigration.includes("select public.pfms_is_admin()"), "Legacy admin RPC compatibility bridge is missing");

assert.ok(systemEventsMigration.includes("public.pfms_is_admin()") && !systemEventsMigration.includes("public.is_admin()"), "System event policies must use the existing PFMS admin helper");

assert.ok(!globalCatalogueMigration.includes("pg_catalog.current_date"), "Migration must use valid PostgreSQL date syntax");

assert.ok(html.includes('id="pfmsAdminMembersFilterForm"') && html.includes('id="pfmsAdminMembersResults"'), "Admin member directory UI is missing");
assert.ok(app.includes("function loadPfmsAdminMembers()") && app.includes("pfms_admin_list_legacy_members"), "Admin member directory is not connected to its database RPC");
assert.ok(app.includes("pfms_admin_update_legacy_membership"), "Admin member role/status updates are not connected");
assert.ok(adminMembersMigration.includes("security definer") && adminMembersMigration.includes("public.pfms_is_admin()"), "Global membership directory must enforce server-side administrator authorization");
assert.ok(adminMembersMigration.includes("revoke all on function public.pfms_admin_list_legacy_members") && adminMembersMigration.includes("grant execute on function public.pfms_admin_list_legacy_members"), "Global membership directory RPC grants are incomplete");

assert.match(app, /persistSession:\s*true/, "Supabase session persistence must stay enabled");
assert.match(app, /shouldShowWelcome\s*=\s*showIntro\s*\|\|\s*showReturningGreeting/, "Welcome animation must be conditional");
assert.match(app, /finishAuthentication\(\);/, "Authentication must complete after the reload path");
assert.ok(
  app.includes("pfss_admin_list_profiles") && app.includes("pfss_admin_update_profile"),
  "Expected admin profile RPC integration is missing"
);
assert.ok(
  (await read("supabase/migrations/20261111_organizations_memberships_permissions.sql")).length > 0,
  "Organization foundation migration is missing"
);
assert.ok(
  (await read("supabase/migrations/20261112_private_scout_workspaces.sql")).length > 0,
  "Private scout workspace migration is missing"
);
const scoutIntegrityMigration = await read("supabase/migrations/20261114_scout_workspace_integrity.sql");
assert.match(scoutIntegrityMigration, /pfss_scout_players_touch_updated_at/);
assert.match(scoutIntegrityMigration, /pfss_scout_reports_touch_updated_at/);
assert.match(scoutIntegrityMigration, /pfss_scout_reports_rating_range/);
assert.match(scoutIntegrityMigration, /pfss_scout_media_insert/);
assert.match(scoutIntegrityMigration, /storage_path ~/);
assert.ok(
  scoutIntegrityMigration.includes("storage_path ~ ('^' || auth.uid()::text || '/[^/]+$')"),
  "Scout media metadata must be limited to the uploader's private storage folder"
);
assert.ok(
  !/\n\)\s*\);\s*$/m.test(scoutIntegrityMigration),
  "Scout integrity migration has an orphaned policy closure"
);

assert.ok(
  scout.includes("pfss_scout_players") &&
  scout.includes("pfss_scout_reports") &&
  scout.includes("pfss_scout_media"),
  "Scout workspace must use the private Supabase tables"
);
assert.ok(
  scout.includes(".storage.from(BUCKET).upload") &&
  scout.includes("createSignedUrl") &&
  scout.includes(".storage.from(BUCKET).remove"),
  "Scout workspace must upload, privately display and delete media"
);
assert.ok(
  scout.includes("data-scout-edit-player") &&
  scout.includes("data-scout-delete-player") &&
  scout.includes("data-scout-edit-report") &&
  scout.includes("data-scout-delete-report"),
  "Scout workspace CRUD controls are incomplete"
);
assert.ok(
  !/demoPlayers|demoReports|DESIGNVORSCHAU|TECHNISCHE ANBINDUNG FOLGT/i.test(scout),
  "Scout workspace must not ship demo data or preview copy"
);
assert.ok(
  scout.includes("'global-search'") &&
  scout.includes("pfms_global_players") &&
  scout.includes("data-scout-copy-global") &&
  scout.includes("source_global_player_id"),
  "Scout global search and private player copy workflow is missing"
);
assert.ok(
  globalCatalogueMigration.includes("source_global_player_id") &&
  globalCatalogueMigration.includes("pfss_scout_players_owner_global_source_uidx"),
  "Private Scout profiles must link to a global source without duplicate copies"
);

const mediaDeleteStart = scout.indexOf("async function deleteMedia(id)");
const mediaDeleteBody = scout.slice(mediaDeleteStart, scout.indexOf("\n  function bindEvents", mediaDeleteStart));
const storageDeletePosition = mediaDeleteBody.indexOf(".storage.from(BUCKET).remove");
const metadataDeletePosition = mediaDeleteBody.indexOf(".from(TABLES.media).delete");
assert.ok(
  mediaDeleteStart >= 0 && storageDeletePosition >= 0 &&
  metadataDeletePosition > storageDeletePosition,
  "Private media object must be deleted before its metadata row"
);

const knownGaps = [];
if (/let players = read|let reports = read|write\(DB_KEYS/.test(app)) knownGaps.push("Haupt-Spieler und Berichte verwenden noch lokale Speicherung.");
if (!/pfss_scout_players/.test(scout)) knownGaps.push("Scout-Workspace ist noch nicht mit Supabase verbunden.");
for (const [label, pattern] of [
  ["Vereinsworkflow", /Platzhalter|Funktionen folgen/i],
  ["Zahlungsworkflow", /kein Zahlungsanbieter|noch keine Zahlung/i],
  ["Fehlerüberwachung", /automatische Protokollierung ist noch nicht angebunden/i]
]) {
  if (pattern.test(html)) knownGaps.push(label + " ist noch nicht vollständig integriert.");
}

console.log("PFMS smoke tests passed. " + navViews.size + " navigation targets verified.");
if (knownGaps.length) {
  console.log("\nKnown unfinished areas (tracked, not hidden):");
  for (const gap of knownGaps) console.log("- " + gap);
}
