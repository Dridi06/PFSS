import assert from "node:assert/strict";
import { estimateDevelopmentSignal } from "../asi-core/development-signal.mjs";

const sparse = estimateDevelopmentSignal([{ score: 70, observedAt: "2025-01-01" }]);
assert.equal(sparse.available, false);
assert.equal(sparse.signal, null);

const rising = estimateDevelopmentSignal([
  { score: 50, observedAt: "2024-01-01", source: "scout-a" },
  { score: 58, observedAt: "2024-07-01", source: "scout-a" },
  { score: 66, observedAt: "2025-01-01", source: "scout-b" },
  { score: 74, observedAt: "2025-07-01", source: "scout-b" },
]);
assert.equal(rising.available, true);
assert.ok(rising.signal > 50);
assert.ok(rising.confidenceScore > 0);
assert.equal(rising.observationCount, 4);

const flat = estimateDevelopmentSignal([
  { score: 70, observedAt: "2024-01-01" },
  { score: 70, observedAt: "2024-07-01" },
  { score: 70, observedAt: "2025-01-01" },
  { score: 70, observedAt: "2025-07-01" },
]);
assert.equal(flat.slopePerYear, 0);
assert.equal(flat.signal, 50);
console.log("ASI development signal smoke passed.");
