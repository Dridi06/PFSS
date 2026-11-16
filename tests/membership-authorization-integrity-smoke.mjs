import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const migration = (await readFile(
  resolve(process.cwd(), "supabase/migrations/20261229_pfms_membership_authorization_integrity.sql"),
  "utf8"
)).replace(/\s+/g, " ").toLowerCase();

const helper = migration.slice(
  migration.indexOf("create or replace function public.pfss_has_org_role"),
  migration.indexOf("revoke all on function public.pfss_has_org_role")
);
for (const [pattern, message] of [
  [/security definer/, "Legacy authorization helper must remain SECURITY DEFINER."],
  [/set search_path = ''/, "Legacy authorization helper must pin an empty search_path."],
  [/auth\.uid\(\) is not null/, "Legacy authorization helper must require authentication."],
  [/p_organization_id is not null/, "Legacy authorization helper must reject NULL organization IDs."],
  [/join public\.pfss_organizations o on o\.id = m\.organization_id/, "Legacy authorization must resolve the owning organization."],
  [/m\.status = 'active'/, "Legacy authorization must require active membership."],
  [/o\.status = 'active'/, "Legacy authorization must reject suspended/inactive organizations."],
  [/m\.role = any\(p_allowed_roles\)/, "Optional role allowlists must remain enforced."]
]) assert.match(helper, pattern, message);

const update = migration.slice(
  migration.indexOf("create or replace function public.pfms_admin_update_membership"),
  migration.indexOf("revoke all on function public.pfms_admin_update_membership")
);
for (const [pattern, message] of [
  [/public\.pfms_is_admin\(\)/, "Only approved platform administrators may update PFMS memberships."],
  [/p_permissions is null[\s\S]*jsonb_typeof\(p_permissions\) is distinct from 'object'/, "Permissions must be a non-null JSON object."],
  [/pg_catalog\.jsonb_each\(p_permissions\)/, "Permission keys and values must be validated."],
  [/from public\.pfms_organizations o[\s\S]*for update/, "Parent organization must be locked before changing memberships."],
  [/from public\.pfms_memberships m[\s\S]*for update/, "Target membership must be locked before changing it."],
  [/v_current_role = 'owner'[\s\S]*v_current_status = 'active'/, "The active-owner invariant must be checked."],
  [/other_owner\.member_role = 'owner'[\s\S]*other_owner\.status = 'active'/, "Another active owner must exist before demoting the final owner."],
  [/p_member_role is null[\s\S]*p_member_role not in/, "NULL and unsupported membership roles must be rejected."],
  [/p_status is null[\s\S]*p_status not in/, "NULL and unsupported membership statuses must be rejected."],
  [/p_permissions is null[\s\S]*jsonb_typeof\(p_permissions\) is distinct from 'object'/, "NULL and non-object permission payloads must be rejected."],
  [/jsonb_typeof\(e.value\) is distinct from 'boolean'/, "Permission values must be booleans."],
  [/using errcode = '23514'/, "Owner invariant violations must return a constraint error."],
  [/set member_role = p_member_role[\s\S]*permissions = v_permissions/, "Validated role, status and permissions must be persisted together."]
]) assert.match(update, pattern, message);


const parentLock = update.indexOf("perform 1 from public.pfms_organizations o");
const parentLockClause = update.indexOf("for update", parentLock);
const lockedMembershipRead = update.indexOf(
  "select m.organization_id, m.member_role, m.status",
  parentLockClause
);
const membershipLockClause = update.indexOf("for update", lockedMembershipRead);
const tenantRecheck = update.indexOf("v_locked_org_id is distinct from v_org_id");
const ownerInvariant = update.indexOf("v_current_role = 'owner'");
assert.ok(
  parentLock >= 0 &&
  parentLockClause > parentLock &&
  lockedMembershipRead > parentLockClause &&
  membershipLockClause > lockedMembershipRead &&
  tenantRecheck > membershipLockClause &&
  ownerInvariant > tenantRecheck,
  "Owner updates must lock the parent organization first, lock/re-read the membership second, revalidate its tenant, then enforce the owner invariant."
);


const managerMigration = (await readFile(
  resolve(process.cwd(), "supabase/migrations/20261230_pfms_legacy_manager_admin_rpc_boundary.sql"),
  "utf8"
)).replace(/\s+/g, " ").toLowerCase();
const managerUpdate = managerMigration.slice(
  managerMigration.indexOf("create or replace function public.pfms_update_legacy_org_membership_for_manager"),
  managerMigration.indexOf("revoke all on function public.pfms_update_legacy_org_membership_for_manager")
);
for (const [pattern, message] of [
  [/security definer/, "Legacy manager RPC must remain SECURITY DEFINER."],
  [/set search_path = ''/, "Legacy manager RPC must use an empty search_path."],
  [/if public\.is_admin\(\) then raise exception/, "Platform administrators must be denied the legacy manager RPC."],
  [/not public\.can_manage_org\(v_organization_id\)/, "Non-admin callers must pass the organization manager predicate."],
  [/v_current_role in \('owner','club_admin','agency_admin'\)/, "Leadership memberships must be protected for every manager RPC caller."],
  [/p_role is null[\s\S]*p_role not in/, "NULL and unsupported operational roles must be rejected."],
  [/p_status is null[\s\S]*p_status not in/, "NULL and unsupported membership statuses must be rejected."],
]) assert.match(managerUpdate, pattern, message);
assert.match(
  managerMigration,
  /revoke all on function public\.pfms_update_legacy_org_membership_for_manager\(uuid, text, text\)[\s\S]*grant execute on function public\.pfms_update_legacy_org_membership_for_manager\(uuid, text, text\)[\s\S]*to authenticated/,
  "The manager RPC must revoke PUBLIC/anon and retain authenticated execution."
);
assert.doesNotMatch(
  managerUpdate,
  /not public\.is_admin\(\) and v_current_role/,
  "Leadership protection must not be bypassed by a platform-admin exception."
);

const manifest = JSON.parse(await readFile(
  resolve(process.cwd(), "supabase/migrations/dependency-manifest.json"), "utf8"
));
assert.ok(
  manifest.dependencies.some((edge) =>
    edge.before === "20261111_organizations_memberships_permissions.sql" &&
    edge.after === "20261229_pfms_membership_authorization_integrity.sql"
  ),
  "Migration dependency graph must place the PFMS membership hardening after its core schema."
);
assert.ok(
  manifest.dependencies.some((edge) =>
    edge.before === "20261222_pfms_legacy_org_manager_active_org_gate.sql" &&
    edge.after === "20261230_pfms_legacy_manager_admin_rpc_boundary.sql"
  ),
  "Legacy manager RPC boundary must follow the active-organization authorization helper."
);

const acceptance = await readFile(
  resolve(process.cwd(), "supabase/STAGING_ACCEPTANCE_READ_ONLY.sql"), "utf8"
);
assert.match(acceptance, /'legacy_membership_requires_active_organization'/);
assert.match(acceptance, /'pfms_last_active_owner_is_protected'/);
console.log("PFMS organization lifecycle and last-active-owner integrity smoke test passed.");
