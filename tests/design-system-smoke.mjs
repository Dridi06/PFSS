import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const system = await readFile(new URL("../pfms-design-system.css", import.meta.url), "utf8");
const legacy = await readFile(new URL("../PFSS_Black_Gold_Design_Update.css", import.meta.url), "utf8");

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
assert.match(system, /aspect-ratio:710 \/ 652/);
assert.match(system, /grid-template-columns:minmax\(0,1\.62fr\) minmax\(390px,\.94fr\)/);
assert.match(system, /@media\(max-width:760px\)/);
assert.match(system, /prefers-reduced-motion/);
assert.match(legacy, /BLACK & GOLD LUXURY/);
console.log("PFMS unified executive design-system contract: OK");
