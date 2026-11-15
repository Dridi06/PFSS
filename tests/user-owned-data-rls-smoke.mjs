import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const migrationDir = resolve(process.cwd(), "supabase/migrations");
async function migration(name) {
  return (await readFile(resolve(migrationDir, name), "utf8"))
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const [tasks, tickets, media, catalogue] = await Promise.all([
  migration("20261128_pfms_personal_tasks.sql"),
  migration("20261129_pfms_support_tickets.sql"),
  migration("20261117_pfms_main_media_library.sql"),
  migration("20261115_pfms_global_player_catalogue.sql")
]);

function requirePattern(source, pattern, message) {
  assert.match(source, pattern, message);
}
function forbidPattern(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

// Personal tasks: all four CRUD operations are owner-scoped and approval-gated.
requirePattern(tasks, /alter table public\.pfms_personal_tasks enable row level security/);
requirePattern(tasks, /alter table public\.pfms_personal_tasks force row level security/);
for (const action of ["select", "insert", "update", "delete"]) {
  requirePattern(
    tasks,
    new RegExp("create policy pfms_personal_tasks_" + action + "_own[\\\\s\\\\S]*?for " + action)
  );
}
requirePattern(tasks, /owner_id = auth\.uid\(\) and public\.pfms_current_user_is_approved\(\)/);
requirePattern(tasks, /revoke all on table public\.pfms_personal_tasks from public, anon/);
requirePattern(tasks, /grant select, insert, update, delete on public\.pfms_personal_tasks to authenticated/);

// Support tickets: users may submit/read their own tickets; only admins may triage.
requirePattern(tickets, /alter table public\.pfms_support_tickets enable row level security/);
requirePattern(tickets, /alter table public\.pfms_support_tickets force row level security/);
requirePattern(
  tickets,
  /create policy pfms_support_tickets_select_own_or_admin[\\s\\S]*?owner_id = auth\.uid\(\) and public\.pfms_current_user_is_approved\(\)[\\s\\S]*?or public\.pfms_is_admin\(\)/
);
requirePattern(
  tickets,
  /create policy pfms_support_tickets_insert_own[\\s\\S]*?owner_id = auth\.uid\(\)[\\s\\S]*?status = 'open'[\\s\\S]*?admin_response is null[\\s\\S]*?public\.pfms_current_user_is_approved\(\)/
);
requirePattern(
  tickets,
  /create policy pfms_support_tickets_update_admin[\\s\\S]*?using \(public\.pfms_is_admin\(\)\)[\\s\\S]*?with check \(public\.pfms_is_admin\(\)\)/
);
requirePattern(tickets, /grant update \(status, admin_response\) on public\.pfms_support_tickets to authenticated/);
forbidPattern(tickets, /grant update on public\.pfms_support_tickets to authenticated/);
requirePattern(tickets, /pg_advisory_xact_lock[\s\S]*?v_recent_count >= 10/);

// Private main media: owner-only metadata and UID-first object path; no public bucket.
requirePattern(media, /alter table public\.pfms_main_media enable row level security/);
requirePattern(media, /alter table public\.pfms_main_media force row level security/);
requirePattern(media, /create policy pfms_main_media_select_own[\s\S]*?using \(owner_id = auth\.uid\(\)\)/);
requirePattern(media, /create policy pfms_main_media_insert_own[\s\S]*?owner_id = auth\.uid\(\)[\s\S]*?storage_path ~ \('\^' \|\| auth\.uid\(\)::text \|\| '\/main\/\[\^\/\]\+\$'\)/);
requirePattern(media, /create policy pfms_main_media_delete_own[\s\S]*?owner_id = auth\.uid\(\)/);
requirePattern(media, /grant select, insert, delete on table public\.pfms_main_media to authenticated/);
forbidPattern(media, /grant .*update.* on table public\.pfms_main_media to authenticated/);
requirePattern(media, /storage\.buckets where id = 'pfss-scout-private' and public = false/);

// Global catalogue: approved users can read; only admins can mutate global player records.
requirePattern(catalogue, /alter table public\.pfms_global_players enable row level security/);
requirePattern(catalogue, /alter table public\.pfms_global_players force row level security/);
requirePattern(catalogue, /create policy pfms_global_players_select[\s\S]*?using \(public\.pfms_current_user_is_approved\(\)\)/);
requirePattern(catalogue, /create policy pfms_global_players_insert[\s\S]*?with check \(public\.pfms_is_admin\(\) and created_by = auth\.uid\(\)\)/);
requirePattern(catalogue, /create policy pfms_global_players_update[\s\S]*?using \(public\.pfms_is_admin\(\)\)[\s\S]*?with check \(public\.pfms_is_admin\(\)\)/);
requirePattern(catalogue, /create policy pfms_global_players_delete[\s\S]*?using \(public\.pfms_is_admin\(\)\)/);

// Scouting reports: authors own their work; administrators retain oversight.
requirePattern(catalogue, /alter table public\.pfms_main_scouting_reports enable row level security/);
requirePattern(catalogue, /alter table public\.pfms_main_scouting_reports force row level security/);
requirePattern(catalogue, /create policy pfms_main_scouting_reports_select[\s\S]*?author_id = auth\.uid\(\) or public\.pfms_is_admin\(\)/);
requirePattern(catalogue, /create policy pfms_main_scouting_reports_insert[\s\S]*?author_id = auth\.uid\(\)[\s\S]*?public\.pfms_current_user_is_approved\(\)/);
requirePattern(catalogue, /create policy pfms_main_scouting_reports_update[\s\S]*?using \(author_id = auth\.uid\(\) or public\.pfms_is_admin\(\)\)[\s\S]*?with check \(author_id = auth\.uid\(\) or public\.pfms_is_admin\(\)\)/);
requirePattern(catalogue, /create policy pfms_main_scouting_reports_delete[\s\S]*?using \(author_id = auth\.uid\(\) or public\.pfms_is_admin\(\)\)/);

console.log("PFMS user-owned data security contracts passed: personal tasks, support tickets, private media, global player catalogue and scouting reports.");
