import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const sql=await readFile(new URL("../supabase/asi-migrations/20261125060000_asi_audited_model_candidate_approval.sql",import.meta.url),"utf8");
const app=await readFile(new URL("../asi/app.js",import.meta.url),"utf8");
assert.match(sql,/security invoker/i);assert.match(sql,/private\.is_admin/);assert.match(sql,/status='retired'/);assert.match(sql,/passed=true/);assert.match(sql,/asi_model_reviews/);assert.match(app,/asi_review_model_candidate/);assert.match(app,/trainChronologicalModel/);assert.match(app,/autoActivation:false/);
console.log("myScoutingDatabase model lifecycle contracts passed.");
