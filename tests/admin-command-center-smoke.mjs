import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
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
console.log('PFMS administrator command center smoke test passed.');
