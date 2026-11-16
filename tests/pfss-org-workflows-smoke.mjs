import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20270102_pfss_membership_role_detail_and_management_invites.sql", import.meta.url),
  "utf8"
);
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const roles = await readFile(new URL("../pfms-role-workflows.js", import.meta.url), "utf8");

assert.match(migration, /ALTER TABLE public\.pfss_memberships[\s\S]*?ADD COLUMN IF NOT EXISTS role_detail text/i);
assert.match(migration, /ALTER TABLE public\.pfss_invitations[\s\S]*?ADD COLUMN IF NOT EXISTS role_detail text/i);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.pfss_org_create_invitation\(/i);
assert.match(migration, /auth\.uid\(\)[\s\S]*?v_actor_role NOT IN \('owner','admin'\)/);
assert.match(migration, /v_role_detail NOT IN \('scout','trainer','co_trainer','betreuer','spieler'\)/);
assert.match(migration, /extensions\.gen_random_bytes\(16\)/);
assert.match(migration, /extensions\.digest\(pg_catalog\.convert_to\(v_token, 'UTF8'\), 'sha256'\)/);
assert.match(migration, /token_hash, expires_at, created_by[\s\S]*?v_token_hash/);
assert.doesNotMatch(migration, /INSERT INTO public\.pfss_invitations[\s\S]{0,400}v_token\s*[,)]/i,
  "Raw invitation tokens must never be stored in the invitations table.");
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.pfss_apply_signup_invitation\(\)/);
assert.match(migration, /email does not match the registered email/i);
assert.match(migration, /role_detail, status[\s\S]*?v_role_detail, 'active'/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.pfss_org_list_members_v2\(/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.pfss_org_list_invitations_v2\(/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.pfss_org_update_member_role_detail\(/);
assert.match(migration, /v_old_role = 'owner'[\s\S]*?Owner membership is protected/);
assert.match(migration, /v_actor_role = 'admin'[\s\S]*?Only the owner may manage administrator roles/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.pfss_org_create_invitation\(uuid,text,text,integer\) FROM PUBLIC, anon/i);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.pfss_org_create_invitation\(uuid,text,text,integer\) TO authenticated/i);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.pfss_apply_signup_invitation\(\) FROM PUBLIC, anon, authenticated/i);
assert.match(migration, /public\.pfms_get_my_role_context\(\)/);
assert.match(migration, /FROM public\.pfss_memberships AS m[\s\S]*?JOIN public\.pfss_organizations AS o/);
assert.match(migration, /'source_model', 'pfss'/);
assert.match(migration, /m\.role_detail/);

assert.match(html, /id="pfssOrgManagementPanel"/);
assert.match(html, /id="pfssOrgInvitationForm"/);
assert.match(html, /id="pfssOrgMembersList"/);
assert.match(html, /id="pfssOrgInvitationsList"/);
for (const id of ["pfssOrgManagementOrganization","pfssOrgInvitationSubmit","pfssOrgInvitationUrl","pfssOrgInvitationCopy"]) {
  assert.ok(html.includes('id="' + id + '"'), "Missing PFSS organization workflow control: " + id);
}

for (const rpc of [
  "pfss_org_create_invitation",
  "pfss_org_list_members_v2",
  "pfss_org_list_invitations_v2",
  "pfss_org_update_member_role_detail",
  "pfss_org_remove_member",
  "pfss_org_revoke_invitation"
]) assert.ok(app.includes("'" + rpc + "'"), "Frontend must use protected RPC " + rpc);

assert.match(app, /requestGeneration !== pfmsAuthGeneration[\s\S]*?window\.pfssCurrentUserId/);
assert.match(app, /window\.pfmsSelectedPFSSOrganizationId !== organization\.organization_id/);
assert.match(app, /data-pfss-org-manage/);
assert.match(app, /pfssOrgManagementPanel[\s\S]*?hidden/);
assert.match(app, /data-pfss-member-remove[\s\S]*?pfss_org_remove_member/);
assert.match(app, /data-pfss-invitation-revoke[\s\S]*?pfss_org_revoke_invitation/);
assert.match(roles, /co_trainer/);
assert.match(roles, /betreuer/);
assert.match(roles, /spieler/);

console.log("PFMS PFSS organization workflow tests passed: role detail, hashed single-use invitations, email binding, protected membership actions, hierarchy and session-scoped frontend.");
