import assert from "node:assert/strict";
import { rankRecruitmentCandidates } from "../asi-core/recruitment-engine.mjs";

const players = [
  {
    id: "internal-1", name: "Internal prospect", sourceScope: "internal", age: 20,
    positions: ["left-back"], preferredFoot: "left", estimatedCost: 2_000_000,
    dimensions: { performance: 76, tacticalFit: 94, potential: 91, scoutAssessment: 88, economicFit: 90, physicalFit: 84 },
    evidenceQuality: { sourceReliability: 90, recency: 88, identityConfidence: 100, sampleAdequacy: 82 },
    scoutAssessments: [{ scoutId: "scout-a", rating: 88, observedAt: "2026-08-10", context: "live-match", note: "Strong recovery runs" }],
    dimensionEvidence: { tacticalFit: ["evidence-1"] },
  },
  {
    id: "external-1", name: "External candidate", sourceScope: "external", age: 23,
    positions: ["left-back"], preferredFoot: "left", estimatedCost: 4_000_000,
    dimensions: { performance: 88, tacticalFit: 78, potential: 72, scoutAssessment: 70, economicFit: 75, physicalFit: 86 },
    evidenceQuality: { sourceReliability: 85, recency: 80, identityConfidence: 98, sampleAdequacy: 90 },
  },
  {
    id: "unknown-1", name: "Unknown data", sourceScope: "external", age: 21,
    positions: ["left-back"], dimensions: {},
  },
  {
    id: "over-budget", name: "Over budget", sourceScope: "external", age: 21,
    positions: ["left-back"], preferredFoot: "left", estimatedCost: 9_000_000,
    dimensions: { performance: 99, tacticalFit: 99, potential: 99 },
  },
];

const ranked = rankRecruitmentCandidates(players, {
  constraints: { ageMin: 18, ageMax: 24, positions: ["left-back"], foot: "left", budgetMax: 5_000_000 },
});
assert.equal(ranked.length, 4);
assert.equal(ranked[0].playerId, "internal-1", "brief-specific fit should surface the internal prospect");
assert.equal(ranked[0].sourceScope, "internal", "internal and external candidates share one ranking");
assert.equal(ranked[0].scoutAssessments[0].rating, 88, "human scout rating must remain intact");
assert.ok(ranked[0].suitabilityScore > 0);
assert.equal(ranked.find((item) => item.playerId === "over-budget").eligible, false);
assert.equal(ranked.find((item) => item.playerId === "unknown-1").suitabilityScore, null,
  "missing dimensions must not be fabricated as zero or a score");
assert.ok(ranked[0].evidenceConfidence.score !== null);
assert.ok(ranked[0].breakdown.tacticalFit.sourceRefs.includes("evidence-1"));
console.log("ASI recruitment engine contract smoke passed.");
