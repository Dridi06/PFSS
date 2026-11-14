import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

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

console.log("PFMS build configuration smoke tests passed: missing, mismatched, malformed, non-canonical and secret credentials fail closed.");
