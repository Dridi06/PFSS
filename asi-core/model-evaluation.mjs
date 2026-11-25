/**
 * Prediction evaluation utilities for later use with ASI prediction_records/outcomes.
 * Metrics are descriptive; passing a threshold does not certify a model as production-safe.
 */

export function evaluateRegression(predictions, options = {}) {
  if (!Array.isArray(predictions)) throw new TypeError("predictions must be an array");
  const rows = predictions.filter((row) =>
    Number.isFinite(row?.predicted) && Number.isFinite(row?.observed)
  );
  const minimumSample = Number.isInteger(options.minimumSample) ? Math.max(5, options.minimumSample) : 20;
  if (rows.length < minimumSample) {
    return {
      evaluable: false,
      sampleSize: rows.length,
      minimumSample,
      reason: "Insufficient paired prediction/outcome records",
      mae: null, rmse: null, meanError: null,
    };
  }
  const errors = rows.map((row) => row.predicted - row.observed);
  const mae = errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length;
  const rmse = Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / errors.length);
  const meanError = errors.reduce((sum, value) => sum + value, 0) / errors.length;
  const sorted = errors.map(Math.abs).sort((a, b) => a - b);
  const medianAbsoluteError = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return {
    evaluable: true,
    sampleSize: rows.length,
    mae: round(mae),
    rmse: round(rmse),
    meanError: round(meanError),
    medianAbsoluteError: round(medianAbsoluteError),
    direction: meanError > 0 ? "overprediction" : meanError < 0 ? "underprediction" : "balanced",
    metricsVersion: "asi-regression-metrics-v1",
    warning: "Evaluate by time-based holdout and position/age cohorts before any production use.",
  };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
