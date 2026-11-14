import fs from "node:fs/promises";
import assert from "node:assert/strict";

const read = (path) => fs.readFile(path, "utf8");
const html = await read("index.html");
const app = await read("app.js");
const scout = await read("scout-workspace.js");

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

const knownGaps = [];
if (/pfss_players_v1|pfss_reports_v1/.test(app)) knownGaps.push("Haupt-Spieler und Berichte verwenden noch localStorage.");
if (/demoPlayers|demoReports|DESIGNVORSCHAU|TECHNISCHE ANBINDUNG FOLGT/i.test(scout)) {
  knownGaps.push("Scout-Workspace enthält noch Vorschau-/Beispieldaten.");
}
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
