import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
const pass = (name) => console.log("PASS " + name);
const fail = (name) => failures.push(name);
const read = (path) => {
  const full = resolve(root, path);
  if (!existsSync(full)) {
    fail("Missing required file: " + path);
    return "";
  }
  return readFileSync(full, "utf8");
};

const login = read("supabase/functions/username-login/index.ts");
const r2 = read("supabase/functions/r2-connection-check/index.ts");
const scout = read("supabase/migrations/20261112_private_scout_workspaces.sql");
const tenant = read("supabase/migrations/20261112_pfss_tenant_integrity_hardening.sql");
const config = read("supabase/config.toml");
const backup = read(".github/workflows/pfss-database-backup.yml");

function requirePattern(source, pattern, label) {
  if (pattern.test(source)) pass(label);
  else fail(label);
}
function forbidPattern(source, pattern, label) {
  if (!pattern.test(source)) pass(label);
  else fail(label);
}

forbidPattern(login, /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/, "Username login does not enable wildcard CORS");
requirePattern(login, /PFSS_ALLOWED_ORIGINS/, "Username login uses configured CORS origins");
requirePattern(login, /MAX_BODY_BYTES/, "Username login defines a request body limit");
requirePattern(login, /new TextEncoder\(\)\.encode\(raw\)\.byteLength/, "Username login checks actual request byte length");
requirePattern(login, /content-type[\s\S]{0,180}application\/json/i, "Username login requires JSON content type");
requirePattern(login, /Cache-Control["']:\s*["']no-store/i, "Username login disables response caching");
requirePattern(login, /suppliedPassword\.length\s*>\s*MAX_PASSWORD_LENGTH/, "Username login bounds password input length");

forbidPattern(r2, /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/, "R2 diagnostics do not enable wildcard CORS");
requirePattern(r2, /PFSS_ALLOWED_ORIGINS/, "R2 diagnostics use configured CORS origins");
requirePattern(r2, /authClient\.auth\.getUser\(/, "R2 diagnostics validate the bearer token with Supabase Auth");
requirePattern(r2, /PFSS_R2_ADMIN_USER_IDS/, "R2 diagnostics require explicit administrator IDs");
requirePattern(r2, /configuredAdmins\.includes\(authData\.user\.id\)/, "R2 diagnostics enforce the administrator allowlist");
requirePattern(r2, /if \(req\.method !== "POST"\)/, "R2 diagnostics accept POST only");
requirePattern(config, /\[functions\.r2-connection-check\][\s\S]*?verify_jwt\s*=\s*true/, "R2 function gateway JWT verification is enabled");

for (const table of ["pfss_scout_players", "pfss_scout_reports", "pfss_scout_media"]) {
  requirePattern(scout, new RegExp("alter table public\\." + table + " enable row level security"), table + " has RLS enabled");
}
forbidPattern(scout, /public\.is_admin\s*\(/, "Private scout migration has no unverified is_admin dependency");
requirePattern(scout, /with check \(owner_id = auth\.uid\(\)\)/, "Private player ownership is enforced on insert");
requirePattern(scout, /select 1 from public\.pfss_scout_players p[\s\S]*?p\.owner_id = auth\.uid\(\)/, "Report and media references are owner-scoped");
requirePattern(scout, /revoke all on public\.pfss_scout_players[\s\S]*?from anon, public/, "Private scout tables revoke anonymous and public privileges");
requirePattern(scout, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/, "Private media storage is scoped to the authenticated owner");
requirePattern(scout, /file_size_limit=52428800/, "Private media bucket has a 50 MiB upload cap");
requirePattern(scout, /allowed_mime_types/, "Private media bucket limits MIME types");

requirePattern(tenant, /LIVE PRECONDITIONS: NOT VERIFIED BY THIS REPOSITORY CHANGE/, "Tenant migration does not claim unverified live preconditions");
requirePattern(tenant, /supabase\/preflight\/00_schema_security_inventory\.sql/, "Tenant migration points to the read-only preflight inventory");

requirePattern(backup, /openssl enc -aes-256-cbc -salt -pbkdf2/, "Backup workflow encrypts database dumps");
requirePattern(backup, /aws s3api head-object/, "Backup workflow verifies uploaded object metadata");
requirePattern(backup, /PFSS_DATABASE_URL/, "Backup workflow requires a database URL secret");
requirePattern(backup, /PFSS_BACKUP_ENCRYPTION_PASSPHRASE/, "Backup workflow requires an encryption passphrase");

if (failures.length) {
  console.error("\nSECURITY STATIC CHECKS FAILED");
  for (const item of failures) console.error("- " + item);
  process.exitCode = 1;
} else {
  console.log("\nSECURITY STATIC CHECKS PASSED");
}
