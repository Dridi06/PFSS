import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Tenant-owned organization and team authority must never be mutated through
// browser-side PostgREST table calls. Mutations belong to guarded RPCs/triggers.
const browserFiles = ["app.js", "scout-workspace.js"];
const sources = await Promise.all(
  browserFiles.map((file) => readFile(resolve(process.cwd(), file), "utf8"))
);
const frontend = sources.join("\n");

const rpcOnlyRelations = [
  "pfms_organizations",
  "pfms_memberships",
  "pfms_scout_profiles",
  "organizations",
  "organization_memberships",
  "organization_invitations",
  "pfms_legacy_teams",
  "pfms_legacy_team_staff",
  "pfms_legacy_team_permissions"
];

for (const relation of rpcOnlyRelations) {
  const escaped = relation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const directTableAccess = new RegExp(
    "\\.(?:from|table)\\s*\\(\\s*['\\\"]" + escaped + "['\\\"]\\s*\\)",
    "i"
  );
  assert.doesNotMatch(
    frontend,
    directTableAccess,
    "Browser code must not access tenant-authority relation " + relation +
      " directly; use a server-authorized RPC."
  );

  const rawRestEndpoint = new RegExp(
    "/rest/v1/" + escaped + "(?:[/?#'\\\"]|$)",
    "i"
  );
  assert.doesNotMatch(
    frontend,
    rawRestEndpoint,
    "Browser code must not bypass RPC authorization through a raw PostgREST URL for " + relation + "."
  );
}

// Keep the protected workflows available through the application's RPC boundary.
for (const rpc of [
  "pfms_list_my_manageable_legacy_organizations",
  "pfms_create_legacy_invitation",
  "pfms_list_legacy_org_members_for_manager",
  "pfms_update_legacy_org_membership_for_manager",
  "pfms_list_my_legacy_teams",
  "pfms_assign_legacy_team_staff",
  "pfms_save_legacy_team_permissions"
]) {
  assert.ok(
    frontend.includes(rpc),
    "Expected guarded RPC workflow is missing from the browser application: " + rpc
  );
}
assert.match(
  frontend,
  /\.rpc\s*\(/,
  "Tenant workflows must be routed through Supabase RPC calls."
);
assert.match(
  frontend,
  /pfms_update_legacy_org_membership_for_manager[\s\S]*?pfssSupabase\.rpc\(rpc,/,
  "Organization-manager membership changes must select the guarded manager RPC dynamically."
);

console.log(
  "PFMS frontend tenant-write boundary passed: " +
  rpcOnlyRelations.length +
  " protected relations are RPC-only across " +
  browserFiles.length +
  " browser entry points."
);
