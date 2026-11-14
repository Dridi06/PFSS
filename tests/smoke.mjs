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
const supabaseConfig = await read("supabase/config.toml");

const requiredFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "scout-workspace.js",
  "scout-workspace.css",
  "pfms-logo.svg",
  "rechtliches.html"
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
assert.ok(html.includes('data-registration-choice="owner_bootstrap"'), "Owner registration choice is missing");
assert.ok(html.includes('id="ownerBootstrapForm"') && html.includes('id="ownerBootstrapToken"'), "Owner activation form is missing");
assert.ok(app.includes("pfms_owner_setup_available") && app.includes("pfms-owner-bootstrap"), "Owner availability or activation wiring is missing");
assert.ok(ownerBootstrap.includes("PFMS_OWNER_BOOTSTRAP_TOKEN") && ownerBootstrap.includes("pfms_claim_initial_owner"), "Owner bootstrap secret or claim call is missing");
assert.ok(ownerBootstrap.includes("auth.getUser()") && !ownerBootstrap.includes("p_user_id"), "Owner bootstrap must derive identity from verified JWT, not request body");
assert.ok(ownerMigration.includes("singleton boolean primary key") && ownerMigration.includes("auth.role()") && ownerMigration.includes("'service_role'"), "Owner migration must enforce a single server-side owner claim");
assert.ok(supabaseConfig.includes("[functions.pfms-owner-bootstrap]") && supabaseConfig.includes("verify_jwt = true"), "Owner bootstrap must require JWT verification");

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
if (/pfss_players_v1|pfss_reports_v1/.test(app)) knownGaps.push("Haupt-Spieler und Berichte verwenden noch localStorage.");
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
