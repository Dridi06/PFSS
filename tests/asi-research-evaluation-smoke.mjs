import assert from "node:assert/strict";
import { compareIdentity, detectFactConflicts, researchPlayerIdentity } from "../asi-core/research-workflow.mjs";
import { evaluateRegression } from "../asi-core/model-evaluation.mjs";

const matched = compareIdentity({ name: "A. Player" }, [{ label: "A. Player", sourceUrl: "https://www.wikidata.org/entity/Q1" }]);
assert.equal(matched[0].identityStatus, "pending_exact_name_match");
assert.equal(matched[0].identityConfidence, 0.7);
assert.equal(matched[0].requiresHumanConfirmation, true);

const conflicts = detectFactConflicts([
  { claimType: "club", value: "Club A", sourceUrl: "https://a.example" },
  { claimType: "club", value: "Club B", sourceUrl: "https://b.example" },
]);
assert.equal(conflicts.length, 1);
assert.equal(conflicts[0].automaticResolution, false);

const bundle = await researchPlayerIdentity({
  candidate: { name: "A. Player", birthYear: 2000 },
  fetchImpl: async () => new Response(JSON.stringify({ results: { bindings: [{
    item: { value: "https://www.wikidata.org/entity/Q1" },
    itemLabel: { value: "A. Player" },
    birthDate: { value: "2000-01-01T00:00:00Z" },
  }] } }), { status: 200, headers: { "content-type": "application/json" } }),
});
assert.equal(bundle.persistence, "not_performed");
assert.equal(bundle.approvalRequired, true);
assert.equal(bundle.identitySuggestions.length, 1);

const tooSmall = evaluateRegression([{ predicted: 1, observed: 2 }]);
assert.equal(tooSmall.evaluable, false);
assert.equal(tooSmall.mae, null);
const data = Array.from({ length: 20 }, (_, i) => ({ predicted: i + 2, observed: i }));
const metrics = evaluateRegression(data);
assert.equal(metrics.evaluable, true);
assert.equal(metrics.mae, 2);
assert.equal(metrics.rmse, 2);
assert.equal(metrics.direction, "overprediction");
console.log("ASI research workflow and model evaluation smoke passed.");
