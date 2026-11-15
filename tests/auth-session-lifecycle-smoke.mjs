import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

assert.match(app, /let pfmsAccessCheckGeneration = 0;/,
  "Access checks need a monotonic request generation.");
assert.match(app, /async function checkPfssAccess\(user, options = \{\}\)/,
  "Access validation must support explicit refresh-only checks.");
assert.match(app, /if \(requestId !== pfmsAccessCheckGeneration\) return;/,
  "A stale profile lookup must not overwrite a newer auth state.");
assert.match(app, /profile\.status !== 'approved'[\s\S]*?resetPfmsAuthenticatedState\(\)/,
  "A suspended or unapproved active account must have cached app state cleared.");
assert.match(app, /sameUser && !sameRole\) resetPfmsAuthenticatedState\(\)/,
  "A changed platform role must invalidate the previous authenticated state.");
assert.match(app, /event === 'TOKEN_REFRESHED' \|\| event === 'USER_UPDATED'/,
  "Token refresh and user updates must trigger profile revalidation.");
assert.match(app, /setTimeout\(\(\) => \{\s*void checkPfssAccess\(session\.user, \{ refreshOnly: true \}\);\s*\}, 0\)/,
  "Supabase auth callbacks must defer profile lookups outside the auth event pipeline.");
assert.match(app, /event === 'SIGNED_OUT'[\s\S]*?pfmsAccessCheckGeneration \+= 1;[\s\S]*?resetPfmsAuthenticatedState\(\)/,
  "Sign-out must invalidate in-flight access checks and clear account caches.");
assert.match(app, /document\.addEventListener\('visibilitychange'[\s\S]*?pfssSupabase\.auth\.getUser\(\)[\s\S]*?checkPfssAccess\(data\.user, \{ refreshOnly: true \}\)/,
  "Returning to a visible tab must revalidate the current user and refresh team assignments.");
assert.match(app, /now - pfmsLastVisibilityAccessCheckAt < 60000/,
  "Visibility revalidation must be throttled to avoid excessive profile requests.");
assert.match(app, /if \(refreshOnly && sameUser && sameRole\) \{[\s\S]*?await loadPfmsLegacyTeams\(\)/,
  "Refresh-only checks must keep the current view and refresh server-authoritative team assignments.");
assert.match(app, /!pfmsLegacyTeams\.some\(team => team\.team_id === pfmsSelectedLegacyTeam\.team_id\)/,
  "A selected team that is no longer assigned must be invalidated after a team refresh.");
assert.match(app, /pfmsTeamStaffDialog'\)\?\.close\(\)[\s\S]*?pfmsCloseSelectedTeam'\)\?\.click\(\)/,
  "Revoked team assignments must close team-management dialogs and clear the selected workspace.");


assert.match(app, /function isCurrentPfmsAdminRequest\(userId, generation\)/,
  "Administrator requests must be bound to the active administrator session.");
assert.match(app, /window\.pfssCurrentUserId === userId[\s\S]*?pfmsAuthGeneration === generation/,
  "A stale administrator response must fail closed after logout, account switch or role reset.");
const adminUsersLoader = app.match(/async function loadAdminUsers\(\)[\s\S]*?(?=async function saveAdminUser)/)?.[0] || "";
assert.match(adminUsersLoader, /requestGeneration = pfmsAuthGeneration[\s\S]*?isCurrentPfmsAdminRequest[\s\S]*?pfmsAdminUsersRequestId/,
  "The global user directory must reject stale and out-of-order responses.");
const adminDirectoryLoader = app.match(/async function loadPfmsAdminDirectory\(type,root\)[\s\S]*?(?=async function showPfmsOrganizationDetails)/)?.[0] || "";
assert.match(adminDirectoryLoader, /isCurrentPfmsAdminRequest[\s\S]*?pfmsRequestId/,
  "Organization and scout searches must reject stale session and earlier search responses.");
const adminMembersLoader = app.match(/async function loadPfmsAdminMembers\(\)[\s\S]*?(?=const PFMS_SYSTEM_EVENT_STATUSES)/)?.[0] || "";
assert.match(adminMembersLoader, /isCurrentPfmsAdminRequest[\s\S]*?pfmsAdminMembersRequestId/,
  "The global membership directory must reject stale and out-of-order responses.");
const adminErrorsLoader = app.match(/async function loadPfmsAdminErrors\(\)[\s\S]*?(?=function setupPfmsAdminErrors)/)?.[0] || "";
assert.match(adminErrorsLoader, /isCurrentPfmsAdminRequest[\s\S]*?pfmsAdminErrorsRequestId/,
  "The system event directory must reject stale and out-of-order responses.");
assert.match(app, /async function saveAdminUser\(button\)[\s\S]*?isCurrentPfmsAdminRequest/,
  "Admin profile changes must not update a different account's UI after a session switch.");

console.log("PFMS auth/session lifecycle tests passed: session invalidation, admin request isolation, latest-query wins, approval/role revalidation, token refresh and tab-resume checks.");

assert.match(app, /const adminOnlyViews = new Set\(\[[\s\S]*?'admin-inbox'[\s\S]*?'backup'[\s\S]*?\]\)/,
  "The frontend must maintain an explicit list of platform-administrator-only routes.");
assert.match(app, /if \(adminOnlyViews\.has\(view\) && !window\.pfssIsRealAdmin\)[\s\S]*?view = 'dashboard'/,
  "Direct or stale navigation must not expose administrator screens to non-admin accounts.");
