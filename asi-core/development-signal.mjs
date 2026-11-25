/**
 * Transparent player-development signal calculator.
 * Not a machine-learned forecast. Requires longitudinal, comparable observations.
 * No score is returned when the sample is insufficient.
 */

const finite = (v) => Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function parseObservation(item) {
  if (!item || !finite(item.score) || item.score < 1 || item.score > 100) return null;
  const date = new Date(item.observedAt);
  if (!Number.isFinite(date.getTime())) return null;
  return { score: item.score, time: date.getTime(), source: item.source ?? "unspecified" };
}

export function estimateDevelopmentSignal(observations, options = {}) {
  if (!Array.isArray(observations)) throw new TypeError("observations must be an array");
  const minimum = Number.isInteger(options.minimumObservations) ? Math.max(3, options.minimumObservations) : 4;
  const data = observations.map(parseObservation).filter(Boolean).sort((a, b) => a.time - b.time);
  const unique = data.filter((item, index) => index === 0 || item.time !== data[index - 1].time);
  if (unique.length < minimum) {
    return {
      available: false,
      signal: null,
      confidence: "insufficient",
      observationCount: unique.length,
      reason: `At least ${minimum} dated, valid observations are required`,
    };
  }

  const first = unique[0];
  const last = unique.at(-1);
  const elapsedYears = (last.time - first.time) / (365.25 * 24 * 60 * 60 * 1000);
  if (elapsedYears < 0.5) {
    return {
      available: false, signal: null, confidence: "insufficient",
      observationCount: unique.length,
      reason: "Observation period must cover at least six months",
    };
  }

  const meanTime = unique.reduce((sum, x) => sum + x.time, 0) / unique.length;
  const meanScore = unique.reduce((sum, x) => sum + x.score, 0) / unique.length;
  const numerator = unique.reduce((sum, x) => sum + (x.time - meanTime) * (x.score - meanScore), 0);
  const denominator = unique.reduce((sum, x) => sum + (x.time - meanTime) ** 2, 0);
  if (!denominator) {
    return { available: false, signal: null, confidence: "insufficient", observationCount: unique.length, reason: "Observation dates are not sufficiently distributed" };
  }
  const slopePerYear = numerator / denominator * (365.25 * 24 * 60 * 60 * 1000);
  const residuals = unique.map((x) => x.score - (meanScore + numerator / denominator * (x.time - meanTime)));
  const rmse = Math.sqrt(residuals.reduce((sum, x) => sum + x * x, 0) / unique.length);
  const signal = Math.round(clamp(50 + slopePerYear * 2, 0, 100) * 10) / 10;
  const sourceCount = new Set(unique.map((x) => x.source)).size;
  const confidenceScore = Math.round(clamp(
    35 + Math.min(unique.length, 8) * 5 + Math.min(sourceCount, 3) * 5 - rmse * 2,
    0, 90
  ));
  return {
    available: true,
    signal,
    slopePerYear: Math.round(slopePerYear * 100) / 100,
    confidenceScore,
    confidence: confidenceScore >= 70 ? "moderate" : "low",
    observationCount: unique.length,
    sourceCount,
    rmse: Math.round(rmse * 100) / 100,
    periodYears: Math.round(elapsedYears * 100) / 100,
    explanation: "Linear trend across dated observations; signal is not a future performance guarantee.",
  };
}
