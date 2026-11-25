import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../asi/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../asi/app.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-asi.mjs", import.meta.url), "utf8");

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
assert.match(build,/dist-asi/);
assert.doesNotMatch(app,/service_role|sb_secret_/i);
console.log("ASI workspace contract smoke tests passed.");
