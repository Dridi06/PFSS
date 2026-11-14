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
  PFSS_SUPABASE_URL: "https://different-project.supabase.co",
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

console.log("PFMS build configuration smoke tests passed: missing, mismatched and secret credentials fail closed.");
