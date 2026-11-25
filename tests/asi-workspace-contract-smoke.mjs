import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../asi/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../asi/app.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-asi.mjs", import.meta.url), "utf8");
const nationalTeamMigration = await readFile(new URL("../supabase/asi-migrations/20261125080000_asi_current_national_team_status.sql", import.meta.url), "utf8");

for (const id of ["authView","appView","loginForm","candidateForm","observationForm","playersBody","candidateList"]) {
  assert.match(html, new RegExp('id="'+id+'"'), "missing ASI UI contract: "+id);
}
assert.match(app,/signInWithPassword/);
assert.match(app,/asi_player_candidates/);
assert.match(app,/asi_candidate_evidence/);
assert.match(app,/Wikidata-Identität prüfen/);
assert.match(app,/query\.wikidata\.org/);
assert.match(app,/persistence|keine automatische Zuordnung oder Speicherung/);
assert.match(app,/asi_player_observations/);
assert.match(app,/owner_id:\s*currentUser\.id/);
assert.match(app,/projectRef !== "vxtybjaabtfhxfwctnyj"/);
assert.match(build,/vxtybjaabtfhxfwctnyj/);
assert.match(build,/sb_secret_/);
assert.match(build,/dist-myscoutingdatabase/);
assert.doesNotMatch(app,/service_role|sb_secret_/i);
assert.match(html,/Aktueller Nationalspieler\?/);
for (const level of ["U15","U16","U17","U18","U19","U20","U21","A-Nationalmannschaft"]) assert.ok(html.includes(level), "missing national team level "+level);
assert.match(app,/is_current_national_player/);
assert.match(app,/national_team_level/);
assert.match(app,/national_team_country/);
assert.match(nationalTeamMigration,/players_national_team_consistency_check/);
assert.match(nationalTeamMigration,/asi_player_candidates_national_team_consistency_check/);
assert.match(nationalTeamMigration,/v_candidate\.national_team_level/);
console.log("ASI workspace contract smoke tests passed.");
