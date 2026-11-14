import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

const outputDirectory = resolve(process.cwd(), "dist");
const renderConfig = await readFile(resolve(process.cwd(), "render.yaml"), "utf8");
assert.ok(renderConfig.includes("Content-Security-Policy"), "Render staging must publish a Content-Security-Policy header");
assert.ok(renderConfig.includes("frame-ancestors 'none'") && renderConfig.includes("object-src 'none'"), "Render CSP must block framing and plugin content");
assert.ok(renderConfig.includes("https://cdn.jsdelivr.net") && renderConfig.includes("https://*.supabase.co"), "Render CSP must allow the required external script and Supabase origins");
assert.ok(renderConfig.includes("https://fonts.googleapis.com") && renderConfig.includes("font-src"), "Render CSP must allow the stylesheet and font resources used by the UI");
const requiredFiles = [
  "index.html",
  "rechtliches.html",
  "styles.css",
  "scout-workspace.css",
  "app.js",
  "scout-workspace.js",
  "pfms-logo.svg",
  "pfms-welcome.webp",
  "pfms-config.js"
];

for (const file of requiredFiles) {
  await access(resolve(outputDirectory, file));
}

const runtimeConfigSource = await readFile(resolve(outputDirectory, "pfms-config.js"), "utf8");
const runtimeConfigMatch = runtimeConfigSource.match(/Object\.freeze\((\{.*\})\);/s);
assert.ok(runtimeConfigMatch, "Generated frontend config must be valid JSON data");
const runtimeConfig = JSON.parse(runtimeConfigMatch[1]);
assert.ok(["ci", "staging"].includes(runtimeConfig.buildTarget), "Build must explicitly identify CI or Staging target");
if (runtimeConfig.buildTarget === "ci") {
  assert.equal(runtimeConfig.projectRef, "ci-placeholder");
  assert.equal(runtimeConfig.supabaseUrl, "https://ci-placeholder.supabase.co");
} else {
  assert.match(runtimeConfig.projectRef, /^[a-z0-9]{20}$/);
  assert.equal(new URL(runtimeConfig.supabaseUrl).hostname, runtimeConfig.projectRef + ".supabase.co");
}
assert.ok(!runtimeConfigSource.includes("sb_secret_") && !runtimeConfigSource.includes("service_role"), "Browser config must not contain server-side secrets");


for (const page of ["index.html", "rechtliches.html"]) {
  const pagePath = resolve(outputDirectory, page);
  const source = await readFile(pagePath, "utf8");

  for (const match of source.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
    const value = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("#")) continue;

    const localPath = decodeURIComponent(value.split("?")[0].split("#")[0]);
    if (!localPath) continue;

    const targetPath = resolve(dirname(pagePath), localPath);
    assert.ok(
      targetPath === outputDirectory || targetPath.startsWith(outputDirectory + sep),
      page + " references a path outside dist/: " + value
    );
    await access(targetPath);
  }
}


for (const stylesheet of ["styles.css", "scout-workspace.css"]) {
  const stylesheetPath = resolve(outputDirectory, stylesheet);
  const source = await readFile(stylesheetPath, "utf8");

  for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    const value = match[1].trim();
    if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("#")) continue;

    const localPath = decodeURIComponent(value.split("?")[0].split("#")[0]);
    const targetPath = resolve(dirname(stylesheetPath), localPath);
    assert.ok(
      targetPath === outputDirectory || targetPath.startsWith(outputDirectory + sep),
      stylesheet + " references a path outside dist/: " + value
    );
    await access(targetPath);
  }
}

for (const forbidden of ["supabase", "tests", "docs", "package.json", "render.yaml"]) {
  await assert.rejects(
    access(resolve(outputDirectory, forbidden)),
    "Internal project path must not be published: " + forbidden
  );
}

console.log("PFMS build smoke tests passed: public assets resolve and internal project files are excluded.");
