import fs from "node:fs/promises";
import assert from "node:assert/strict";

const read = (path) => fs.readFile(path, "utf8");

const [
  html,
  app,
  scout,
  css,
  cors,
  usernameLogin,
  r2Check,
  ownerBootstrap,
  ownerMigration,
  ownerGuardMigration,
  ownerGuide,
  adminMembersMigration,
  legacyOrgAdminMigration,
  legacyAdminCompatMigration,
  globalCatalogueMigration,
  scoutMigration,
  scoutIntegrityMigration,
  systemEventsMigration,
  systemEventsHardeningMigration,
  mainMediaMigration,
  stagingAudit,
  supabaseConfig,
  denoConfigText
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
  read("supabase/migrations/20261112_private_scout_workspaces.sql"),
  read("supabase/migrations/20261114_scout_workspace_integrity.sql"),
  read("supabase/migrations/20261116_pfms_system_event_monitoring.sql"),
  read("supabase/migrations/20261117_pfms_system_event_hardening.sql"),
  read("supabase/migrations/20261117_pfms_main_media_library.sql"),
  read("supabase/STAGING_READ_ONLY_AUDIT.sql"),
  read("supabase/config.toml"),
  read("deno.json")
]);

const denoConfig = JSON.parse(denoConfigText);
const requiredFiles = [
  "README.md",
  "index.html",
  "app.js",
  "styles.css",
  "scout-workspace.js",
  "scout-workspace.css",
  "pfms-logo.svg",
  "rechtliches.html",
  "package.json",
  ".github/workflows/pfms-quality.yml",
  "supabase/functions/_shared/cors.ts",
  "supabase/migrations/20261117_pfms_main_media_library.sql"
];

for (const path of requiredFiles) {
  await fs.access(path);
}

// The main navigation must always point to an existing page section.
const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
const views = new Set([...html.matchAll(/data-view=["']([^"']+)["']/g)].map((m) => m[1]));
for (const view of views) {
  assert.ok(ids.has("view-" + view), "Navigation target has no view section: " + view);
}

// Local assets referenced by the page must exist in the repository.
for (const tag of html.matchAll(/<(script|link|img)\b([^>]*)>/gi)) {
  const attribute = tag[1].toLowerCase() === "link" ? "href" : "src";
  const doubleQuoted = tag[2].match(new RegExp("\\b" + attribute + '="([^"]+)"', "i"))?.[1];
  const singleQuoted = tag[2].match(new RegExp("\\b" + attribute + "='([^']+)'", "i"))?.[1];
  const value = doubleQuoted || singleQuoted;
  if (!value || /^(https?:|data:|#)/i.test(value)) continue;
  await fs.access(decodeURIComponent(value.split("?")[0]));
}

assert.ok(!html.includes("\\n  "), "HTML contains literal escaped line breaks");
assert.ok(!html.includes("PROFESSIONAL FOOTBALL"), "Old public-facing English brand spelling remains");
assert.ok(html.includes("Professionell Football Management System"), "PFMS product descriptor is missing");
assert.equal(denoConfig.nodeModulesDir, "auto", "Deno npm module resolution must be enabled");

// Authentication and reload behaviour.
assert.match(app, /persistSession:\s*true/, "Supabase session persistence must stay enabled");
assert.match(app, /shouldShowWelcome\s*=\s*showIntro\s*\|\|\s*showReturningGreeting/, "Welcome sequence must be conditional");
assert.match(app, /finishAuthentication\(\);/, "Normal reload must immediately restore the authenticated app");
assert.ok(app.includes("pfss_admin_list_profiles") && app.includes("pfss_admin_update_profile"), "Core admin profile RPCs are missing");

// CORS, username login and serverless endpoint safety.
assert.ok(cors.includes("PFMS_ALLOWED_ORIGINS") && cors.includes("DEFAULT_ALLOWED_ORIGINS"), "CORS allowlist configuration is missing");
assert.ok(usernameLogin.includes("corsForRequest") && r2Check.includes("corsForRequest"), "Edge Functions must use the shared CORS policy");
assert.ok(!usernameLogin.includes('"Access-Control-Allow-Origin": "*"'), "Username login must not use wildcard CORS");
assert.ok(!r2Check.includes('"Access-Control-Allow-Origin": "*"'), "R2 check must not use wildcard CORS");
assert.ok(usernameLogin.includes('"Cache-Control": "no-store"'), "Username login tokens must not be cacheable");
assert.ok(usernameLogin.includes("rawBody.length > 8192"), "Username login request body must be bounded");

// Secure first and only platform owner bootstrap.
assert.ok(html.includes('data-registration-choice="owner_bootstrap"') && html.includes('id="ownerBootstrapSection"'), "Dedicated owner registration and activation UI are missing");
assert.ok(app.includes("pfms_owner_setup_available") && app.includes("pfms-owner-bootstrap"), "Owner UI is not connected to the server bootstrap");
assert.ok(app.includes("user?.user_metadata?.registration_type !== 'owner_bootstrap'"), "Owner activation UI must be limited to the dedicated registration route");
assert.ok(ownerBootstrap.includes("auth.getUser()") && ownerBootstrap.includes("email_confirmed_at"), "Owner endpoint must verify an authenticated confirmed account");
assert.ok(ownerBootstrap.includes("PFMS_OWNER_BOOTSTRAP_TOKEN") && ownerBootstrap.includes("constantTimeEqual"), "Owner endpoint must use a protected one-time secret comparison");
assert.ok(ownerBootstrap.includes("pfms_claim_initial_owner") && ownerBootstrap.includes("Verified owner registration required"), "Owner endpoint must use the guarded server-side claim");
assert.ok(ownerMigration.includes("singleton boolean primary key") && ownerMigration.includes("'service_role'"), "Owner table must enforce a single service-role claim");
assert.ok(ownerGuardMigration.includes("pfms_owner_bootstrap_requests") && ownerGuardMigration.includes("after insert on auth.users"), "Owner eligibility must be recorded at initial account creation");
assert.ok(ownerGuardMigration.includes("claimed_at is null") && ownerGuardMigration.includes("for update"), "Owner request must be locked and claimable only once");
assert.ok(ownerGuardMigration.includes("revoke all on table public.pfms_owner_bootstrap_requests from public, anon, authenticated"), "Owner evidence must not be user-readable or writable");
assert.ok(supabaseConfig.includes("[functions.pfms-owner-bootstrap]") && supabaseConfig.includes("verify_jwt = true"), "Owner bootstrap must require JWT verification");
assert.ok(ownerGuide.includes("PFMS_OWNER_BOOTSTRAP_TOKEN") && ownerGuide.includes("20261116_pfms_owner_bootstrap_registration_guard.sql"), "Owner staging guide must document both bootstrap migrations");

// Global players and main scouting reports: persistent CRUD with RLS.
assert.ok(app.includes("pfms_global_players") && app.includes("pfms_main_scouting_reports"), "Main player catalogue and reports must use Supabase");
assert.ok(app.includes("data-global-player-edit") && app.includes("data-global-player-delete"), "Global player edit/delete actions are missing");
assert.ok(app.includes("editingGlobalPlayerId") && app.includes("query.update(row)"), "Global player update must persist to Supabase");
assert.ok(app.includes("editingMainReportId") && app.includes("data-main-report-edit") && app.includes("data-main-report-delete"), "Main scouting report edit/delete is missing");
assert.ok(app.includes("query.update(payload)") && app.includes("query.insert(payload)"), "Main report create/update must persist to Supabase");
assert.ok(app.includes("report.authorId === window.pfssCurrentUserId") && app.includes("window.pfssIsRealAdmin"), "Report management controls must be limited to the author or admin");
assert.ok(globalCatalogueMigration.includes("author_id = auth.uid() or public.pfms_is_admin()"), "Report RLS must limit report access to author/admin");
assert.ok(globalCatalogueMigration.includes("on delete restrict"), "Deleting a player must not cascade-delete scouting history");
assert.ok(globalCatalogueMigration.includes("pfms_import_legacy_catalogue"), "Legacy backup import RPC is missing");
assert.ok(app.includes("importLegacyLocalData") && app.includes("pfms_import_legacy_catalogue"), "Legacy local records must use explicit cloud import");
assert.ok(stagingAudit.includes("'pfms_global_players'") && stagingAudit.includes("'pfms_main_scouting_reports'"), "Read-only staging audit must cover the cloud catalogue");

// Private Scout workspace, global discovery and player copy workflow.
assert.ok(scout.includes("pfss_scout_players") && scout.includes("pfss_scout_reports") && scout.includes("pfss_scout_media"), "Scout workspace tables are missing");
assert.ok(scout.includes("createSignedUrl") && scout.includes(".upload(path, file") && scout.includes(".remove([item.storage_path])"), "Scout private media lifecycle is incomplete");
assert.ok(scout.includes("'global-search'") && scout.includes("pfms_global_players") && scout.includes("data-scout-copy-global"), "Scout global search/copy workflow is missing");
assert.ok(scoutMigration.includes("enable row level security") && scoutMigration.includes("pfss-scout-private"), "Private Scout RLS/storage migration is incomplete");
assert.ok(scoutIntegrityMigration.includes("pfss_scout_players_touch_updated_at") && scoutIntegrityMigration.includes("pfss_scout_reports_rating_range"), "Scout integrity migration is incomplete");
assert.ok(!/demoPlayers|demoReports|DESIGNVORSCHAU|TECHNISCHE ANBINDUNG FOLGT/i.test(scout), "Scout workspace must not use demo data or preview-only copy");

// Main private media library.
assert.ok(html.includes('id="mainMediaStatus"') && html.includes('id="mediaGrid"'), "Main media library page is missing");
assert.ok(!html.includes("Cloud-Upload wird in einem späteren Schritt angebunden"), "Main media page must not advertise local-only storage");
assert.ok(app.includes("function loadPfmsMainMedia") && app.includes("function renderPfmsMainMedia"), "Main media cloud loader and renderer are missing");
assert.ok(app.includes("PFMS_MAIN_MEDIA_BUCKET") && app.includes(".upload(storagePath, file"), "Main media must upload to private Storage");
assert.ok(app.includes("createSignedUrl") && app.includes("data-main-media-delete") && app.includes("deleteMainMedia"), "Main media must privately preview and delete files");
assert.ok(app.includes("PFMS_MAIN_MEDIA_MAX_SIZE") && app.includes("PFMS_MAIN_MEDIA_ALLOWED_TYPES"), "Main media must enforce file size and MIME limits");
assert.ok(app.includes("await loadPfmsMainMedia();") && app.includes("view === 'media'"), "Main media must load at login and when opening its page");
assert.ok(!app.includes("input[type=file]:not(#mediaInput)"), "Backup and unrelated file inputs must not be treated as media uploads");
assert.ok(mainMediaMigration.includes("force row level security") && mainMediaMigration.includes("owner_id = auth.uid()"), "Main media rows must use forced owner-scoped RLS");
assert.ok(mainMediaMigration.includes("storage_path ~") && mainMediaMigration.includes("/main/"), "Main media object paths must be user-scoped");
assert.ok(mainMediaMigration.includes("pfss-scout-private"), "Main media must use the existing private bucket");
assert.ok(stagingAudit.includes("'pfms_main_media'"), "Staging audit must inspect the main media table");

// System event evidence: minimal client reporting, immutable event fields and admin review.
assert.ok(systemEventsMigration.includes("force row level security") && systemEventsMigration.includes("public.pfms_is_admin()"), "System event table must enforce RLS and admin review");
assert.ok(systemEventsHardeningMigration.includes("grant update (status, resolved_at, resolved_by)"), "Only event workflow fields may be updated");
assert.ok(systemEventsHardeningMigration.includes("System event evidence is immutable"), "System event evidence must be immutable");
assert.ok(systemEventsHardeningMigration.includes("Sensitive values are not allowed in system event logs"), "Database must reject common secrets");
assert.ok(app.includes("function pfmsSanitizeLogValue") && app.includes("setupPfmsClientErrorLogging()"), "Frontend error reporting must sanitize before sending");
assert.ok(app.includes("[redacted-token]") && app.includes("[email]") && app.includes("pfmsClientErrorCount >= 5"), "Frontend telemetry must redact and rate-limit");
assert.ok(app.includes(".from('pfms_system_events').insert") && app.includes("function setupPfmsAdminErrors()"), "Error reporting and administrator review must be connected");
assert.ok(html.includes('id="pfmsAdminErrorsFilterForm"') && html.includes('id="pfmsAdminErrorsResults"'), "Admin error review UI is missing");
assert.ok(stagingAudit.includes("'pfms_system_events'"), "Staging audit must include system events");

// Organization/member admin foundations.
assert.ok(app.includes("function loadPfmsAdminMembers()") && app.includes("pfms_admin_list_legacy_members"), "Admin member directory is not connected to its RPC");
assert.ok(app.includes("pfms_admin_update_legacy_membership"), "Admin member role/status updates are missing");
assert.ok(adminMembersMigration.includes("public.pfms_is_admin()") && adminMembersMigration.includes("pfms_admin_list_legacy_members"), "Admin member RPC must use the PFMS admin guard");
assert.ok(legacyOrgAdminMigration.includes("pfms_admin_update_legacy_membership"), "Legacy org membership update RPC is missing");
assert.ok(legacyAdminCompatMigration.includes("create or replace function public.is_admin()") && legacyAdminCompatMigration.includes("public.pfms_is_admin()"), "Legacy authorization compatibility bridge is missing");
assert.ok(html.includes('id="pfmsAdminMembersFilterForm"') && html.includes('id="pfmsAdminMembersResults"'), "Admin global member directory UI is missing");
assert.ok(stagingAudit.includes("'organizations'") && stagingAudit.includes("'pfms_organizations'"), "Staging audit must compare both existing organization models");

console.log("PFMS smoke tests passed: " + views.size + " navigation targets and core security/data flows verified.");
