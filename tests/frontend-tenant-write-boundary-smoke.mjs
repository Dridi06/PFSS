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

// Database ACLs must match the browser-side RPC-only contract.
const coreAcl = (
  await readFile(
    resolve(process.cwd(), "supabase/migrations/20261225_pfms_organization_table_write_acl_hardening.sql"),
    "utf8"
  )
).replace(/\\s+/g, " ").toLowerCase();
assert.match(
  coreAcl,
  /revoke all privileges on table public\\.pfms_organizations, public\\.pfms_memberships, public\\.pfms_scout_profiles from public, anon, authenticated/
);
assert.match(
  coreAcl,
  /grant select on table public\\.pfms_organizations, public\\.pfms_memberships, public\\.pfms_scout_profiles to authenticated/
);
assert.match(
  coreAcl,
  /grant all privileges on table public\\.pfms_organizations, public\\.pfms_memberships, public\\.pfms_scout_profiles to service_role/
);
assert.doesNotMatch(
  coreAcl,
  /grant (?:insert|update|delete|all(?: privileges)?) on table[\\s\\S]*?to authenticated/,
  "Authenticated browser roles must not receive direct write privileges on organization core tables."
);

const teamAcl = (
  await readFile(
    resolve(process.cwd(), "supabase/migrations/20261121_pfms_legacy_team_management.sql"),
    "utf8"
  )
).replace(/\\s+/g, " ").toLowerCase();
for (const table of ["pfms_legacy_teams", "pfms_legacy_team_staff"]) {
  assert.match(
    teamAcl,
    new RegExp("revoke all on table public\\\\." + table + " from public, anon, authenticated"),
    "Browser roles must not write directly to " + table + "."
  );
  assert.match(
    teamAcl,
    new RegExp("grant select on table public\\\\." + table + " to authenticated"),
    "Authenticated team reads must remain explicitly scoped by RLS for " + table + "."
  );
}

const invitationAcl = (
  await readFile(
    resolve(process.cwd(), "supabase/migrations/20261111_legacy_organization_invitations.sql"),
    "utf8"
  )
).replace(/\\s+/g, " ").toLowerCase();
assert.match(invitationAcl, /alter table public\\.organization_invitations enable row level security/);
assert.match(
  invitationAcl,
  /revoke all on table public\\.organization_invitations from public, anon, authenticated/,
  "Invitation tokens must never be directly accessible to browser roles."
);

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
  /const rpcName = window\.pfssIsRealAdmin[\s\S]*?pfms_update_legacy_org_membership_for_manager[\s\S]*?pfssSupabase\.rpc\(rpcName,/i,
  "Organization-manager membership changes must select the guarded manager RPC dynamically."
);

console.log(
  "PFMS frontend tenant-write boundary passed: " +
  rpcOnlyRelations.length +
  " protected relations are RPC-only across " +
  browserFiles.length +
  " browser entry points."
);
