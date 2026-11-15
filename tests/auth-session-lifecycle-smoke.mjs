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
assert.match(adminErrorsLoader, /pfms_admin_list_system_events_page[\s\S]*?p_limit: pageSize[\s\S]*?p_offset: page \* pageSize/,
  "The system event directory must use bounded server-side pagination.");
assert.match(adminErrorsLoader, /p_query: query[\s\S]*?p_severity: severity[\s\S]*?p_status: status/,
  "System event search and filters must be applied in the database.");
assert.match(adminErrorsLoader, /total_count[\s\S]*?pfmsAdminPaginationMarkup/,
  "System event results must expose the database total and page navigation.");

assert.match(app, /async function saveAdminUser\(button\)[\s\S]*?isCurrentPfmsAdminRequest/,
  "Admin profile changes must not update a different account's UI after a session switch.");


const adminOrganizationDetails = app.match(/async function showPfmsOrganizationDetails\(root,org\)[\s\S]*?(?=function showPfmsScoutDetails)/)?.[0] || "";
assert.match(adminOrganizationDetails, /isCurrentDetailRequest[\s\S]*?pfms_admin_list_legacy_org_members[\s\S]*?isCurrentDetailRequest/,
  "Organization member details must be bound to the selected organization and active admin session.");
assert.match(adminOrganizationDetails, /pfms_create_legacy_invitation[\s\S]*?isCurrentDetailRequest/,
  "Invitation results must not be rendered into a stale administrator view.");
const adminScoutDetails = app.match(/function showPfmsScoutDetails\(root,scout\)[\s\S]*?(?=const PFMS_ADMIN_MEMBER_ROLES)/)?.[0] || "";
assert.match(adminScoutDetails, /pfmsDetailRequestId/,
  "Selecting a scout must invalidate any pending organization detail response.");
assert.match(adminDirectoryLoader, /pfmsDetailRequestId[\s\S]*?previousDetail\.hidden = true/,
  "Starting a new directory search must invalidate and hide the previous detail selection.");
const adminMembersSetup = app.match(/function setupPfmsAdminMembers\(\)[\s\S]*?(?=async function checkPfssAccess)/)?.[0] || "";
const adminMemberActions = adminMembersSetup.match(/results\.addEventListener\('click',[\s\S]*?results\.dataset\.pfmsBound/)?.[0] || "";
assert.match(adminMemberActions, /requestGeneration = pfmsAuthGeneration[\s\S]*?isCurrentPfmsAdminRequest/,
  "Global membership changes must remain bound to the administrator session that initiated them.");
const adminErrorsSetup = app.match(/function setupPfmsAdminErrors\(\)[\s\S]*?(?=function setupPfmsAdminMembers)/)?.[0] || "";
const adminEventActions = adminErrorsSetup.match(/results\.addEventListener\('click',[\s\S]*?results\.dataset\.pfmsBound/)?.[0] || "";
assert.match(adminEventActions, /requestGeneration = pfmsAuthGeneration[\s\S]*?isCurrentPfmsAdminRequest/,
  "System-event triage writes must not update stale or non-admin UI state.");


const adminProfileLoader = app.match(/async function loadAdminUsers\(\)[\s\S]*?(?=async function saveAdminUser)/)?.[0] || "";
assert.match(adminProfileLoader, /pfss_admin_list_profiles_page[\s\S]*?p_limit: pageSize[\s\S]*?p_offset: page \* pageSize/,
  "The global profile directory must request a bounded database page.");
assert.match(adminProfileLoader, /Promise\.all\([\s\S]*?pfss_admin_profile_counts/,
  "Global profile counters must be loaded separately from the filtered result page.");
assert.match(adminProfileLoader, /requestId !== pfmsAdminUsersRequestId/,
  "Out-of-order profile pages must not overwrite a newer filter or page selection.");
assert.match(adminProfileLoader, /pfmsAdminPaginationMarkup/,
  "The global profile directory must expose accessible page navigation.");
assert.match(adminDirectoryLoader, /pfms_admin_search_legacy_organizations_page/,
  "Organization directory must use its paginated database RPC.");
assert.match(adminDirectoryLoader, /pfms_admin_list_legacy_scouts_page/,
  "Scout directory must use its paginated database RPC.");
assert.match(adminDirectoryLoader, /p_limit:pageSize[\s\S]*?p_offset:offset/,
  "Organization and scout directories must use bounded server-side pagination.");
assert.match(adminDirectoryLoader, /p_email:emailQuery[\s\S]*?p_user_id:idQuery[\s\S]*?p_status:statusQuery/,
  "Scout search filters must be sent to the database instead of filtering a full client-side result set.");
assert.match(adminDirectoryLoader, /pfmsAdminPaginationMarkup/,
  "Organization and scout directories must expose page navigation.");
assert.match(adminMembersLoader, /pfms_admin_list_legacy_members_page[\s\S]*?p_limit: pageSize[\s\S]*?p_offset: page \* pageSize/,
  "The global membership directory must use bounded server-side pagination.");
assert.match(adminMembersLoader, /pfmsAdminPaginationMarkup/,
  "The global membership directory must expose page navigation.");


const adminSupportLoader = app.match(/async function loadPfmsAdminSupportTickets\(\)[\s\S]*?(?=async function savePfmsAdminSupportTicket)/)?.[0] || "";
assert.match(adminSupportLoader, /count: 'exact'[\s\S]*?\.range\(page \* pageSize, page \* pageSize \+ pageSize - 1\)/,
  "The administrator support inbox must fetch a bounded database page with an exact total.");
assert.match(adminSupportLoader, /requestId !== pfmsAdminSupportRequestId[\s\S]*?isCurrentPfmsAdminRequest/,
  "The administrator support inbox must reject stale sessions and out-of-order requests.");
assert.match(adminSupportLoader, /if \(status\) request = request\.eq\('status', status\)/,
  "The support status filter must be applied by the database.");
assert.match(adminSupportLoader, /pfmsAdminPaginationMarkup/,
  "The administrator support inbox must render page navigation.");
const adminSupportSetup = app.match(/function setupPfmsAdminSupport\(\)[\s\S]*?(?=function showView)/)?.[0] || "";
assert.match(adminSupportSetup, /data-admin-page-action[\s\S]*?loadPfmsAdminSupportTickets/,
  "The support inbox page controls must request the selected database page.");
assert.match(app, /pfmsAdminSupportRequestId \+= 1[\s\S]*?pfmsAdminSupportTickets = \[\]/,
  "Signing out or changing accounts must invalidate pending support inbox requests.");

console.log("PFMS auth/session lifecycle tests passed: session invalidation, admin request isolation, latest-query wins, protected admin writes, approval/role revalidation, token refresh and tab-resume checks.");

assert.match(app, /const adminOnlyViews = new Set\(\[[\s\S]*?'admin-inbox'[\s\S]*?'backup'[\s\S]*?\]\)/,
  "The frontend must maintain an explicit list of platform-administrator-only routes.");
assert.match(app, /if \(adminOnlyViews\.has\(view\) && !window\.pfssIsRealAdmin\)[\s\S]*?view = 'dashboard'/,
  "Direct or stale navigation must not expose administrator screens to non-admin accounts.");
