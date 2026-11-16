import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const root = new URL("../dist/", import.meta.url);
const [html, css, app, imagePath] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
  readFile(new URL("app.js", root), "utf8"),
  stat(new URL("pfms-welcome.webp", root))
]);

assert.match(html, /id="welcomeSequence"[^>]*aria-label="PFMS Willkommenssequenz"/);
assert.match(html, /class="welcome-star"/);
assert.match(html, /class="welcome-flashes"/);
assert.match(html, /HERZLICH WILLKOMMEN/);
assert.match(css, /pfms-welcome\.webp\?v=20261116-stadium-sequence-1/);
assert.match(css, /@keyframes pfms-star-arrive/);
assert.match(css, /@keyframes pfms-camera-flash/);
assert.match(css, /@media\(max-width:760px\)/);
assert.match(css, /prefers-reduced-motion:reduce/);
assert.match(app, /welcomeUser\.textContent = username/);
assert.match(app, /setTimeout\(finishAuthentication, 3500\)/);
assert.ok(imagePath.size > 10000, "Stadium welcome artwork must be present in the static build");

const image = await readFile(new URL("pfms-welcome.webp", root));
assert.equal(image.toString("ascii", 0, 4), "RIFF");
assert.equal(image.toString("ascii", 8, 12), "WEBP");
assert.equal(image.readUInt32LE(4), image.length - 8);

console.log("PFMS stadium welcome sequence smoke test passed: artwork, 3.5-second timing, star, crowd flashes, mobile layout and reduced-motion support.");
