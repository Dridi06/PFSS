import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const migrationDir = resolve(root, "supabase/migrations");
const migrationFiles = (await readdir(migrationDir)).filter((name) => name.endsWith(".sql")).sort();
const migrations = await Promise.all(migrationFiles.map((name) => readFile(resolve(migrationDir, name), "utf8")));
const migrationText = migrations.join("\n");
const frontend = await Promise.all(["app.js", "scout-workspace.js"].map((name) => readFile(resolve(root, name), "utf8")));
const frontendText = frontend.join("\n");
const report = await readFile(resolve(root, "docs/RPC_DEPRECATION_REVIEW.md"), "utf8");

const candidates = [
  "pfms_admin_search_legacy_organizations",
  "pfms_admin_list_legacy_scouts",
  "pfms_admin_list_legacy_org_members",
  "pfms_create_legacy_team_event",
  "pfms_update_legacy_team_event"
];

for (const name of candidates) {
  assert.match(migrationText, new RegExp("create\\s+(?:or\\s+replace\\s+)?function\\s+public\\." + name + "\\s*\\(", "i"),
    name + " must remain defined in the migration history.");
  assert.match(migrationText, new RegExp("grant\\s+execute\\s+on\\s+function\\s+public\\." + name + "\\s*\\([\\s\\S]*?\\)\\s+to\\s+authenticated", "i"),
    name + " must retain its explicit authenticated EXECUTE grant.");
  assert.doesNotMatch(migrationText, new RegExp("drop\\s+function\\s+(?:if\\s+exists\\s+)?public\\." + name + "\\s*\\(", "i"),
    name + " must not be dropped without a separately approved deprecation.");
}

const replacements = [
  ["pfms_admin_search_legacy_organizations_page", "pfms_admin_search_legacy_organizations"],
  ["pfms_admin_list_legacy_scouts_page", "pfms_admin_list_legacy_scouts"],
  ["pfms_admin_list_legacy_org_members_page", "pfms_admin_list_legacy_org_members"]
];
for (const [replacement, legacy] of replacements) {
  assert.match(migrationText, new RegExp("create\\s+(?:or\\s+replace\\s+)?function\\s+public\\." + replacement + "\\s*\\(", "i"),
    replacement + " must exist as a paginated replacement for " + legacy + ".");
  assert.ok(frontendText.includes("'" + replacement + "'") || frontendText.includes('"' + replacement + '"'),
    "Current frontend must call paginated replacement " + replacement + ".");
  assert.ok(report.includes("`" + legacy + "`") && report.includes("`" + replacement + "`"),
    "Review report must document the legacy/replacement relationship.");
}

for (const name of candidates.slice(3)) {
  assert.ok(report.includes("`" + name + "`"), "Review report must track " + name + ".");
}
assert.match(report, /No candidate is approved for deletion or privilege reduction/i);
assert.match(report, /external consumers/i);
assert.match(report, /dedicated isolated staging project/i);
assert.match(report, /is_admin\(\).*pfms_is_admin\(\)/s);

console.log("PFMS RPC deprecation review passed: five legacy RPCs protected; three paginated admin replacements verified; two event RPCs remain compatibility review items.");
