/**
 * ASI Recruitment Engine — deterministic, explainable ranking baseline.
 * This is decision support, not a claim of validated predictive performance.
 * Missing inputs stay missing; scout opinion is never silently overwritten.
 */

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const isScore = (value) => Number.isFinite(value) && value >= 0 && value <= 100;

const DEFAULT_WEIGHTS = Object.freeze({
  performance: 0.24,
  tacticalFit: 0.26,
  potential: 0.18,
  scoutAssessment: 0.14,
  economicFit: 0.10,
  physicalFit: 0.08,
});

function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("en") : "";
}

function passesHardConstraints(player, constraints = {}) {
  const reasons = [];
  if (Number.isFinite(constraints.ageMin) || Number.isFinite(constraints.ageMax)) {
    if (!Number.isFinite(player.age)) reasons.push("Alter unbekannt");
    else if (Number.isFinite(constraints.ageMin) && player.age < constraints.ageMin) reasons.push("Unter Altersgrenze");
    else if (Number.isFinite(constraints.ageMax) && player.age > constraints.ageMax) reasons.push("Über Altersgrenze");
  }
  if (constraints.positions?.length) {
    const wanted = constraints.positions.map(normalizeText);
    const actual = (player.positions ?? []).map(normalizeText);
    if (!actual.some((position) => wanted.includes(position))) reasons.push("Position passt nicht");
  }
  if (Number.isFinite(constraints.budgetMax)) {
    if (!Number.isFinite(player.estimatedCost)) reasons.push("Kosten unbekannt – Budget nicht verifizierbar");
    else if (player.estimatedCost > constraints.budgetMax) reasons.push("Über Budget");
  }
  if (constraints.foot && constraints.foot !== "either") {
    if (!player.preferredFoot) reasons.push("Starker Fuß unbekannt");
    else if (normalizeText(player.preferredFoot) !== normalizeText(constraints.foot)) reasons.push("Starker Fuß passt nicht");
  }
  return { passes: reasons.length === 0, reasons };
}

function scoreDimensions(player, weights) {
  const dimensions = player.dimensions ?? {};
  const entries = Object.entries(weights).filter(([key, weight]) =>
    Number.isFinite(weight) && weight > 0 && isScore(dimensions[key])
  );
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight === 0) return { score: null, coverage: 0, breakdown: {} };

  const breakdown = {};
  let weighted = 0;
  for (const [key, weight] of entries) {
    const contribution = (weight / totalWeight) * dimensions[key];
    weighted += contribution;
    breakdown[key] = {
      value: dimensions[key],
      configuredWeight: weight,
      normalizedWeight: weight / totalWeight,
      contribution,
      sourceRefs: Array.isArray(player.dimensionEvidence?.[key])
        ? player.dimensionEvidence[key]
        : [],
    };
  }
  const configuredWeight = Object.values(weights).reduce((sum, weight) => sum + Math.max(0, weight || 0), 0);
  const availableWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  return {
    score: Math.round(weighted * 10) / 10,
    coverage: configuredWeight > 0 ? Math.round((availableWeight / configuredWeight) * 100) : 0,
    breakdown,
  };
}

function confidenceFor(player, coverage) {
  const evidence = player.evidenceQuality ?? {};
  const signals = [
    isScore(evidence.sourceReliability) ? evidence.sourceReliability : null,
    isScore(evidence.recency) ? evidence.recency : null,
    isScore(evidence.identityConfidence) ? evidence.identityConfidence : null,
    isScore(evidence.sampleAdequacy) ? evidence.sampleAdequacy : null,
    isScore(coverage) ? coverage : null,
  ].filter((value) => value !== null);
  if (!signals.length) return { score: null, label: "Nicht ausreichend belegt" };
  const score = Math.round(signals.reduce((sum, value) => sum + value, 0) / signals.length);
  return {
    score,
    label: score >= 80 ? "Hoch" : score >= 60 ? "Mittel" : "Niedrig",
  };
}

/**
 * Rank candidates for a specific brief.
 * Player input contract:
 * { id, name, sourceScope: "internal"|"external", age, positions, preferredFoot,
 *   estimatedCost, dimensions: {performance,tacticalFit,potential,scoutAssessment,economicFit,physicalFit},
 *   dimensionEvidence: { [dimension]: string[] }, evidenceQuality: {...},
 *   scoutAssessments: [{ scoutId, rating, observedAt, context, note }] }
 */
export function rankRecruitmentCandidates(players, brief = {}) {
  if (!Array.isArray(players)) throw new TypeError("players must be an array");
  const weights = { ...DEFAULT_WEIGHTS, ...(brief.weights ?? {}) };
  const ranked = players.map((player) => {
    const constraint = passesHardConstraints(player, brief.constraints);
    const scored = scoreDimensions(player, weights);
    const confidence = confidenceFor(player, scored.coverage);
    const reasons = [];
    const warnings = [...constraint.reasons];

    if (scored.score === null) warnings.push("Keine bewertbaren Dimensionen vorhanden");
    if (scored.coverage < 70) warnings.push("Geringe Datenabdeckung");
    if (confidence.score === null || confidence.score < 60) warnings.push("Aussagekraft der Daten begrenzt");
    if (player.sourceScope !== "internal" && player.sourceScope !== "external") {
      warnings.push("Datenherkunft nicht klassifiziert");
    }
    if (Array.isArray(player.scoutAssessments) && player.scoutAssessments.length > 0) {
      reasons.push(`${player.scoutAssessments.length} dokumentierte Scout-Beobachtung(en) vorhanden`);
    }
    for (const [key, value] of Object.entries(scored.breakdown)) {
      if (value.value >= 80) reasons.push(`${key}: starke Ausprägung (${value.value}/100)`);
    }

    return {
      playerId: player.id,
      playerName: player.name ?? "Unbekannter Spieler",
      sourceScope: player.sourceScope ?? "unclassified",
      eligible: constraint.passes && scored.score !== null,
      suitabilityScore: constraint.passes ? scored.score : null,
      evidenceConfidence: confidence,
      dataCoverage: scored.coverage,
      breakdown: scored.breakdown,
      scoutAssessments: Array.isArray(player.scoutAssessments) ? player.scoutAssessments : [],
      reasons,
      warnings,
      hardConstraintFailures: constraint.reasons,
    };
  });

  return ranked.sort((a, b) => {
    if (a.eligible !== b.eligible) return Number(b.eligible) - Number(a.eligible);
    if (a.suitabilityScore === null) return 1;
    if (b.suitabilityScore === null) return -1;
    if (a.suitabilityScore !== b.suitabilityScore) return b.suitabilityScore - a.suitabilityScore;
    return (b.evidenceConfidence.score ?? -1) - (a.evidenceConfidence.score ?? -1);
  });
}

export const ASI_RECRUITMENT_DEFAULT_WEIGHTS = DEFAULT_WEIGHTS;
