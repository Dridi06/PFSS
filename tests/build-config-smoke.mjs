import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const script = "scripts/build-static.mjs";
const baseEnv = { ...process.env, PFMS_BUILD_TARGET: "staging" };
delete baseEnv.PFSS_SUPABASE_URL;
delete baseEnv.PFSS_SUPABASE_KEY;
delete baseEnv.PFMS_STAGING_PROJECT_REF;

const missing = spawnSync(process.execPath, [script], { encoding: "utf8", env: baseEnv });
assert.notEqual(missing.status, 0, "Staging build must fail when Supabase values are missing");
assert.match(missing.stderr, /PFSS_SUPABASE_URL and PFSS_SUPABASE_KEY are required/);

const mismatchEnv = {
  ...baseEnv,
  PFMS_STAGING_PROJECT_REF: "abcdefghijklmnopqrst",
  PFSS_SUPABASE_URL: "https://zyxwvutsrqponmlkjihg.supabase.co",
  PFSS_SUPABASE_KEY: "sb_publishable_test"
};
const mismatch = spawnSync(process.execPath, [script], { encoding: "utf8", env: mismatchEnv });
assert.notEqual(mismatch.status, 0, "Staging build must fail when URL and project reference differ");
assert.match(mismatch.stderr, /does not match PFMS_STAGING_PROJECT_REF/);

const secretEnv = {
  ...baseEnv,
  PFMS_STAGING_PROJECT_REF: "abcdefghijklmnopqrst",
  PFSS_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  PFSS_SUPABASE_KEY: "sb_secret_test"
};
const secret = spawnSync(process.execPath, [script], { encoding: "utf8", env: secretEnv });
assert.notEqual(secret.status, 0, "Browser build must reject Supabase secret keys");
assert.match(secret.stderr, /publishable\/anon key/);


const validBase = {
  ...baseEnv,
  PFMS_STAGING_PROJECT_REF: "abcdefghijklmnopqrst",
  PFSS_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  PFSS_SUPABASE_KEY: "sb_publishable_test"
};

for (const unsafeUrl of [
  "https://user:password@abcdefghijklmnopqrst.supabase.co",
  "https://abcdefghijklmnopqrst.supabase.co:8443",
  "https://abcdefghijklmnopqrst.supabase.co/unexpected-path",
  "https://abcdefghijklmnopqrst.supabase.co?redirect=example",
  "https://abcdefghijklmnopqrst.supabase.co#fragment",
  "https://abcdefghijklmnopqrst.supabase.co.attacker.example"
]) {
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...validBase, PFSS_SUPABASE_URL: unsafeUrl }
  });
  assert.notEqual(result.status, 0, "Staging build must reject non-canonical Supabase URL: " + unsafeUrl);
  assert.match(result.stderr, /exact HTTPS origin of a Supabase project/);
}

const invalidUrl = spawnSync(process.execPath, [script], {
  encoding: "utf8",
  env: { ...validBase, PFSS_SUPABASE_URL: "not-a-url" }
});
assert.notEqual(invalidUrl.status, 0, "Staging build must reject malformed Supabase URLs");
assert.match(invalidUrl.stderr, /valid HTTPS Supabase project URL/);


const renderBlueprint = await readFile(new URL("../render.yaml", import.meta.url), "utf8");
assert.equal((renderBlueprint.match(/^  - type:/gm) || []).length, 1, "Render blueprint must define exactly one service in this staging-only branch");
assert.match(renderBlueprint, /^    name: pfss-staging$/m, "Render blueprint must target the existing staging service name");
assert.match(renderBlueprint, /^    runtime: static$/m, "Staging service must remain a static site");
assert.match(renderBlueprint, /^    branch: feature\/pfss-complete-platform-build$/m, "Staging service must deploy only from the feature branch");
assert.match(renderBlueprint, /^    buildCommand: npm run check:syntax && npm run build && npm run test:dist$/m, "Staging deploy must run syntax, build and distribution tests");
assert.match(renderBlueprint, /^    staticPublishPath: \.\/dist$/m, "Only the tested dist directory may be published");
assert.match(renderBlueprint, /^        value: staging$/m, "Render must build with the staging target");
for (const key of ["PFMS_STAGING_PROJECT_REF", "PFSS_SUPABASE_URL", "PFSS_SUPABASE_KEY"]) {
  const escapedKey = key;
  assert.match(
    renderBlueprint,
    new RegExp("      - key: " + escapedKey + "\\n        sync: false"),
    "Staging environment value " + key + " must be supplied privately in Render, never committed to the blueprint"
  );
}
assert.match(renderBlueprint, /^    autoDeployTrigger: 'off'$/m, "Staging auto-deploy must remain disabled until an explicitly approved manual deployment.");
assert.match(renderBlueprint, /name: Content-Security-Policy/, "Staging must retain its Content Security Policy");
assert.match(renderBlueprint, /name: Strict-Transport-Security/, "Staging must retain HSTS");
assert.match(renderBlueprint, /name: X-Content-Type-Options[\s\S]*?value: nosniff/, "Staging must prevent MIME-type sniffing.");
assert.match(renderBlueprint, /name: Referrer-Policy[\s\S]*?value: strict-origin-when-cross-origin/, "Staging must use a restrictive referrer policy.");
assert.match(renderBlueprint, /name: X-Frame-Options[\s\S]*?value: DENY/, "Staging must prevent framing in legacy user agents.");
assert.match(renderBlueprint, /name: Permissions-Policy[\s\S]*?value: camera=\(\), microphone=\(\), geolocation=\(\)/, "Staging must disable unused sensitive browser capabilities.");

const cspLine = renderBlueprint.match(/^\s+value: "(default-src[^"\n]+)"$/m)?.[1] || "";
assert.ok(cspLine, "A complete Content Security Policy must be configured.");
const csp = new Map(cspLine.split(";").map((directive) => {
  const [name, ...values] = directive.trim().split(/\s+/);
  return [name, values];
}));
assert.deepEqual(csp.get("default-src"), ["'self'"], "CSP default must be same-origin only.");
assert.deepEqual(csp.get("object-src"), ["'none'"], "CSP must disable plugin/object content.");
assert.deepEqual(csp.get("base-uri"), ["'self'"], "CSP must restrict base URL injection.");
assert.deepEqual(csp.get("frame-ancestors"), ["'none'"], "CSP must forbid embedding.");
assert.deepEqual(csp.get("form-action"), ["'self'"], "CSP forms must submit only to this origin.");
assert.deepEqual(csp.get("script-src"), ["'self'", "https://cdn.jsdelivr.net"], "Executable scripts must be restricted to reviewed origins; inline scripts and eval are not allowed.");
assert.ok(!csp.get("script-src").includes("'unsafe-eval'"), "Executable scripts must never enable eval.");
assert.ok(!csp.get("script-src").includes("'unsafe-inline'"), "Executable scripts must never enable inline scripts.");

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i,
  "The frontend must not rely on inline scripts that would weaken the script CSP.");
assert.doesNotMatch(renderBlueprint, /^    branch: main$/m, "Staging blueprint must never deploy from production main");

console.log("PFMS build configuration smoke tests passed: fail-closed Supabase config and staging-only Render blueprint safeguards.");
