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
assert.match(migration, /FROM public\.pfms_memberships AS m[\s\S]*?JOIN public\.pfms_organizations AS o[\s\S]*?m\.user_id = v_user_id[\s\S]*?m\.status = 'active'[\s\S]*?o\.status = 'active'/);
assert.match(migration, /FROM public\.pfms_scout_profiles AS s[\s\S]*?s\.status = 'active'/);
assert.match(migration, /permissions ->> 'manage_members'/);
assert.match(migration, /'can_manage_organization', membership\.can_manage_organization/);
assert.match(migration, /to_regclass\('public\.organizations'\)/);
assert.match(migration, /to_regclass\('public\.pfms_legacy_team_staff'\)/);
assert.match(migration, /active_membership\.user_id = \$1[\s\S]*?active_membership\.status = 'active'/);
assert.match(migration, /'team_role', s\.role/);
assert.match(migration, /'roles', v_roles/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.pfms_get_my_role_context\(\) FROM PUBLIC, anon/i);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.pfms_get_my_role_context\(\) TO authenticated/i);
assert.doesNotMatch(migration, /\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|ALTER\s+TABLE|DROP\s+TABLE)\b/i,
  "Role-context migration must not change business data or existing tables.");

assert.match(app, /async function updatePfmsRoleContext\([\s\S]*?pfms_get_my_role_context[\s\S]*?workflows\.resolveContext/);
assert.match(app, /roles: Array\.isArray\(roleData\?\.roles\) \? roleData\.roles : \[\]/);
assert.match(app, /requestGeneration !== pfmsAuthGeneration[\s\S]*?window\.pfssCurrentUserId/);
assert.match(workflows, /can_manage_organization/);
assert.match(workflows, /declaredRoles\.has\("agenturscout"\)/);
assert.match(workflows, /declaredRoles\.has\("spieler"\)/);
assert.match(workflows, /activeTeamAssignments/);

console.log("PFMS authenticated role-context tests passed: canonical PFMS memberships, permissions, scout profile, optional legacy teams, active profile gate, least-privilege grants and session-bound frontend integration.");
