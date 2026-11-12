import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const errors = [];
const warnings = [];
const jsFiles = [
  "app.js",
  "scout-workspace.js",
  "workspace-ui.js",
];
for (const file of jsFiles) {
  const path = resolve(root, file);
  if (!existsSync(path)) {
    errors.push(`Missing JavaScript file: ${file}`);
    continue;
  }
  try {
    new vm.Script(readFileSync(path, "utf8"), { filename: file });
    console.log(`PASS JavaScript syntax: ${file}`);
  } catch (error) {
    errors.push(`JavaScript syntax error in ${file}: ${error.message}`);
  }
}

const htmlPath = resolve(root, "index.html");
if (!existsSync(htmlPath)) {
  errors.push("Missing index.html");
} else {
  const html = readFileSync(htmlPath, "utf8");
  const ids = [...html.matchAll(/\\bid\\s*=\\s*["']([^"']+)["']/gi)].map(m => m[1]);
  const seen = new Set();
  const duplicates = new Set();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  if (duplicates.size) errors.push(`Duplicate HTML IDs: ${[...duplicates].join(", ")}`);
  else console.log(`PASS HTML IDs: ${ids.length} unique IDs`);

  const refs = [...html.matchAll(/(?:src|href)\\s*=\\s*["']([^"'#?]+)(?:\\?[^"']*)?["']/gi)]
    .map(m => m[1])
    .filter(value => !/^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(value));
  for (const ref of refs) {
    const local = resolve(root, ref);
    if (!local.startsWith(root + "/") && local !== root) {
      errors.push(`Resource escapes repository root: ${ref}`);
    } else if (!existsSync(local)) {
      errors.push(`Missing local HTML resource: ${ref}`);
    }
  }
  if (!errors.some(x => x.includes("Missing local HTML resource") || x.includes("Resource escapes"))) {
    console.log(`PASS Local HTML resources: ${refs.length} checked`);
  }

  if (!/name=["']viewport["'][^>]*viewport-fit=cover/i.test(html)) {
    warnings.push("Viewport meta should include viewport-fit=cover for modern iOS safe areas.");
  }
}
if (!existsSync(resolve(root, "supabase/config.toml"))) {
  warnings.push("Supabase config.toml not found; verify Edge Function JWT settings manually.");
}
if (errors.length) {
  console.error("\\nQUALITY CHECK FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("\\nQUALITY CHECK PASSED");
}
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
