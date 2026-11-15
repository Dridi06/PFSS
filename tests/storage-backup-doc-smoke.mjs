import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [plan, scoutMigration, mediaMigration, acceptance, restoreGuide] = await Promise.all([
  read("docs/STORAGE_BACKUP_RESTORE.md"),
  read("supabase/migrations/20261112_private_scout_workspaces.sql"),
  read("supabase/migrations/20261117_pfms_main_media_library.sql"),
  read("supabase/STAGING_ACCEPTANCE_READ_ONLY.sql"),
  read("docs/BACKUP_RESTORE.md")
]);

// The documented storage inventory must match the checked-in schema.
assert.match(scoutMigration, /values\s*\(\s*'pfss-scout-private'\s*,\s*'pfss-scout-private'\s*,\s*false/i);
assert.match(scoutMigration, /create table if not exists public\.pfss_scout_media/i);
assert.match(mediaMigration, /create table if not exists public\.pfms_main_media/i);
assert.match(mediaMigration, /storage_path\s*~\s*\('\^\[0-9a-fA-F-\]\{36\}\/main\//i);
assert.match(plan, /pfss-scout-private/);
assert.match(plan, /pfss_scout_media/);
assert.match(plan, /pfms_main_media/);
assert.match(plan, /<user-id>\/main\//);
assert.match(plan, /<user-id>\/<dateiname>/);

// Storage security is read-only and integrity-oriented; destructive sync is forbidden.
for (const phrase of ["read-only", "SHA-256", "isoliertes Supabase-Testprojekt", "keine Quellobjekte löschen", "keine öffentlichen URLs"]) {
  assert.ok(plan.toLowerCase().includes(phrase.toLowerCase()), "Storage backup plan is missing: " + phrase);
}
assert.match(plan, /niemals Quellobjekte bereinigen/i);
assert.match(plan, /nicht überschreiben oder löschen/i);
assert.match(acceptance, /'main_media_private_bucket'/);
assert.match(acceptance, /'private_scout_storage_isolated'/);
assert.match(acceptance, /b\.public\s*=\s*false/);
assert.match(restoreGuide, /Storage-Binärdateien sind nicht Bestandteil/i);
assert.match(restoreGuide, /docs\/STORAGE_BACKUP_RESTORE\.md/);

console.log("PFMS storage backup documentation tests passed: private bucket, owner paths, integrity and isolated restore safeguards.");
