import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const adminView = html.match(/<section class="view" id="view-admin">([\\s\\S]*?)<\\/section>\\s*<section class="view" id="view-agencies">/);
assert.ok(adminView, 'Administrator view must exist');
const view = adminView[1];
assert.match(view, /id="pfmsAdminCommandHeading"/, 'Admin cockpit heading must exist');
const requiredViews = ['admin-members','clubs','agencies','scouts','players','admin-errors','admin-inbox','admin-payments','backup'];
for (const target of requiredViews) {
  assert.match(view, new RegExp('data-view="' + target + '"'), 'Admin cockpit must link to ' + target);
}
assert.match(html, /id="adminNavSection" hidden/, 'Admin navigation must remain hidden until role access is applied');
assert.match(css, /\\.pfms-admin-command-grid[^{]*\\{[^}]*display:grid/s, 'Admin command grid styles must exist');
assert.match(css, /@media\\(max-width:560px\\)[^{]*\\{[^}]*pfms-admin-command-grid/s, 'Admin command grid must be mobile responsive');
console.log('PFMS administrator command center smoke test passed.');
