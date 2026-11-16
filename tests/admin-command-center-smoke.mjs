import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const start = html.indexOf('<section class="view" id="view-admin">');
const end = html.indexOf('<section class="view" id="view-agencies">', start);
assert.ok(start >= 0 && end > start, 'Administrator view must exist');
const view = html.slice(start, end);
assert.ok(view.includes('id="pfmsAdminCommandHeading"'), 'Admin cockpit heading must exist');
const requiredViews = ['admin-members','clubs','agencies','scouts','players','admin-errors','admin-inbox','admin-payments','backup'];
for (const target of requiredViews) {
  assert.ok(view.includes('data-view="' + target + '"'), 'Admin cockpit must link to ' + target);
}
assert.ok(html.includes('id="adminNavSection" hidden'), 'Admin navigation must remain hidden until role access is applied');
assert.ok(css.includes('.pfms-admin-command-grid{display:grid'), 'Admin command grid styles must exist');
assert.ok(css.includes('@media(max-width:560px){.pfms-admin-command-center'), 'Admin command grid must be mobile responsive');
assert.ok(view.includes('id="pfmsAdminActivityList"'), 'Live activity list must be present');
assert.ok(view.includes('id="pfmsAdminActivityRefresh"'), 'Live activity refresh control must be present');
assert.ok(app.includes("pfms_admin_list_system_events_page"), 'Activity feed must use the protected admin RPC');
assert.ok(app.includes("p_limit: 5, p_offset: 0"), 'Activity feed must request a bounded five-event page');
assert.ok(app.includes("escapeHtml(item.message || 'Systemereignis')"), 'Activity feed must escape untrusted event messages');
console.log('PFMS administrator command center smoke test passed.');
