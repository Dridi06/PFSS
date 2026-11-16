import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20270101_pfms_authenticated_role_context.sql", import.meta.url),
  "utf8"
);
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const workflows = await readFile(new URL("../pfms-role-workflows.js", import.meta.url), "utf8");

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.pfms_get_my_role_context\(\)/i);
assert.match(migration, /RETURNS jsonb[\s\S]*?LANGUAGE plpgsql[\s\S]*?STABLE[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/i);
assert.match(migration, /auth\.uid\(\)/);
assert.match(migration, /p\.status = 'approved'/);
assert.match(migration, /m\.user_id = v_user_id[\s\S]*?m\.status = 'active'[\s\S]*?o\.status IN \('approved', 'active'\)/);
assert.match(migration, /s\.user_id = v_user_id[\s\S]*?s\.status = 'active'[\s\S]*?t\.status = 'active'/);
assert.equal((migration.match(/JOIN public\.organization_memberships AS active_membership/g) || []).length, 2,
  "Team assignments and derived team roles must require a current active organization membership.");
assert.match(migration, /'member_role', membership\.member_role/);
assert.match(migration, /'team_role', assignment\.team_role/);
assert.match(migration, /'roles', v_roles/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.pfms_get_my_role_context\(\) FROM PUBLIC, anon/i);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.pfms_get_my_role_context\(\) TO authenticated/i);
assert.doesNotMatch(migration, /\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|ALTER\s+TABLE|DROP\s+TABLE)\b/i,
  "Role-context migration must not change business data or existing tables.");

assert.match(app, /async function updatePfmsRoleContext\([\s\S]*?pfms_get_my_role_context[\s\S]*?workflows\.resolveContext/);
assert.match(app, /requestGeneration !== pfmsAuthGeneration[\s\S]*?window\.pfssCurrentUserId/);
assert.match(workflows, /member_role/);
assert.match(workflows, /membershipRole\(organization\)/);
assert.match(workflows, /hasAgencyScoutMembership/);
assert.match(workflows, /activeTeamAssignments/);

console.log("PFMS authenticated role-context tests passed: approved own profile, own active memberships/team assignments, role RPC grants, read-only migration and session-bound frontend integration.");
