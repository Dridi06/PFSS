import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const errors = [];
const warnings = [];
const jsFiles = [
  "app.js",
  "scout-workspace.js",
  "workspace-ui.js",
  "pfss-finance.js",
  "pfss-i18n.js"
];

for (const file of jsFiles) {
  const path = resolve(root, file);
  if (!existsSync(path)) {
    errors.push("Missing JavaScript file: " + file);
    continue;
  }
  try {
    new vm.Script(readFileSync(path, "utf8"), { filename: file });
    console.log("PASS JavaScript syntax: " + file);
  } catch (error) {
    errors.push("JavaScript syntax error in " + file + ": " + error.message);
  }
}

const htmlPath = resolve(root, "index.html");
if (!existsSync(htmlPath)) {
  errors.push("Missing index.html");
} else {
  const html = readFileSync(htmlPath, "utf8");

  // Validate inline classic scripts in index.html.
  const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/gi)];
  inlineScripts.forEach((match, index) => {
    const attributes = match[1] || "";
    if (/\btype\s*=\s*["']module["']/i.test(attributes)) {
      warnings.push("Inline module script " + (index + 1) + " was not checked.");
      return;
    }
    try {
      new vm.Script(match[2], { filename: "index.html:inline-script-" + (index + 1) });
      console.log("PASS Inline script: " + (index + 1));
    } catch (error) {
      errors.push("Inline script syntax error (" + (index + 1) + "): " + error.message);
    }
  });

  const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(function (match) { return match[1]; });
  const seen = new Set();
  const duplicates = new Set();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  if (duplicates.size) errors.push("Duplicate HTML IDs: " + [...duplicates].join(", "));
  else console.log("PASS HTML IDs: " + ids.length + " unique IDs");

  const refs = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"'#?]+)(?:\?[^"']*)?["']/gi)]
    .map(function (match) { return match[1]; })
    .filter(function (value) { return !/^(?:https?:|data:|mailto:|tel:|about:|javascript:)/i.test(value); });
  let missing = 0;
  for (const ref of refs) {
    const local = resolve(root, ref);
    if (!local.startsWith(root + "/") && local !== root) {
      errors.push("Resource escapes repository root: " + ref);
      missing++;
    } else if (!existsSync(local)) {
      errors.push("Missing local HTML resource: " + ref);
      missing++;
    }
  }
  if (!missing) console.log("PASS Local HTML resources: " + refs.length + " checked");

  if (!/name=["']viewport["'][^>]*viewport-fit=cover/i.test(html)) {
    warnings.push("Viewport meta should include viewport-fit=cover for modern iOS safe areas.");
  }
  if (/<script\b[^>]*src=["']https?:\/\//i.test(html) &&
      !/<script\b[^>]*src=["']https?:\/\/[^"']+["'][^>]*\bintegrity=["']/i.test(html)) {
    warnings.push("At least one external script may be missing Subresource Integrity; review CSP/SRI policy.");
  }
}

if (!existsSync(resolve(root, "supabase/config.toml"))) {
  warnings.push("Supabase config.toml not found; verify Edge Function JWT settings manually.");
}
if (errors.length) {
  console.error("\nQUALITY CHECK FAILED");
  for (const error of errors) console.error("- " + error);
  process.exitCode = 1;
} else {
  console.log("\nQUALITY CHECK PASSED");
}
for (const warning of warnings) console.warn("WARNING: " + warning);
