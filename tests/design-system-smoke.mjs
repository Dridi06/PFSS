import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const system = await readFile(new URL("../pfms-design-system.css", import.meta.url), "utf8");
const legacy = await readFile(new URL("../PFSS_Black_Gold_Design_Update.css", import.meta.url), "utf8");
const auth = await readFile(new URL("../pfms-auth-executive.css", import.meta.url), "utf8");

assert.match(html, /PFSS_Black_Gold_Design_Update\.css/);
assert.match(html, /pfms-design-system\.css/);
assert.ok(html.indexOf("pfms-design-system.css") > html.indexOf("scout-workspace.css"), "Global design layer must load after module styles");
for (const token of ["--pfms-bg:", "--pfms-surface:", "--pfms-gold:", "--pfms-ink:", "--pfms-line:"]) {
  assert.ok(system.includes(token), "Missing design token " + token);
}
for (const selector of [".sidebar", ".main-area", ".topbar", ".page-heading", ".panel", ".stat-card", ".player-card", ".scout-panel", ".btn-primary", ".modal", "table", "#authScreen .auth-visual", "#authScreen .auth-card"]) {
  assert.ok(system.includes(selector), "Missing global visual contract " + selector);
}
assert.match(system, /pfms-welcome\.webp/);
assert.match(auth, /pfms-login-hero\.webp\?v=20261116-original-user-image-3/);
assert.match(auth, /aspect-ratio:512 \/ 468/);
assert.match(auth, /grid-template-columns:minmax\(0,1\.5fr\) minmax\(380px,\.92fr\)/);
assert.match(auth, /grid-template-columns:minmax\(0,1fr\)/);
assert.match(auth, /#authScreen \.auth-visual>\*\{display:none!important\}/);
assert.match(auth, /#authScreen \.auth-card/);
assert.match(system, /@media\(max-width:760px\)/);
assert.match(system, /prefers-reduced-motion/);
assert.match(legacy, /BLACK & GOLD LUXURY/);
console.log("PFMS unified executive design-system contract: OK");
