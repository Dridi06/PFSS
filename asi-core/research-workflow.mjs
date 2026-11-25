/**
 * ASI evidence-first research workflow.
 * Provider responses are suggestions only; nothing is written to canonical player data.
 */

import { searchWikidataPlayer, searchOpenLigaDB, PROVIDERS } from "./providers.mjs";

function clean(value, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizedName(value) {
  return clean(value, 180).normalize("NFKC").toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function compareIdentity(candidate, externalResults) {
  const target = normalizedName(candidate?.name);
  return (externalResults ?? []).map((result) => {
    const externalName = normalizedName(result.label);
    const exact = Boolean(target && externalName && target === externalName);
    return {
      ...result,
      identityStatus: exact ? "pending_exact_name_match" : "ambiguous",
      identityMatchMethod: exact ? "normalized_exact_name" : "no_exact_name_match",
      identityConfidence: exact ? 0.7 : null,
      requiresHumanConfirmation: true,
    };
  });
}

export function detectFactConflicts(claims) {
  const byType = new Map();
  for (const claim of claims ?? []) {
    if (!claim?.claimType || !claim?.value) continue;
    const key = String(claim.claimType);
    const value = String(claim.value).trim().toLocaleLowerCase("en");
    if (!byType.has(key)) byType.set(key, new Map());
    const group = byType.get(key);
    if (!group.has(value)) group.set(value, []);
    group.get(value).push(claim);
  }
  return [...byType.entries()]
    .filter(([, values]) => values.size > 1)
    .map(([claimType, values]) => ({
      claimType,
      status: "conflicting",
      variants: [...values.entries()].map(([value, sources]) => ({
        value,
        sourceCount: sources.length,
        sourceUrls: sources.map((source) => source.sourceUrl).filter(Boolean),
      })),
      automaticResolution: false,
    }));
}

export async function researchPlayerIdentity({
  candidate,
  fetchImpl = fetch,
  wikidataEnabled = true,
  competition = null,
}) {
  if (!candidate || !clean(candidate.name)) throw new Error("candidate.name is required");
  const tasks = [];
  if (wikidataEnabled) {
    tasks.push(searchWikidataPlayer({ name: candidate.name, fetchImpl })
      .then((rows) => ({ provider: "wikidata", status: "completed", rows }))
      .catch((error) => ({ provider: "wikidata", status: "failed", rows: [], errorCode: error.message })));
  }
  if (competition?.league && Number.isInteger(competition.season)) {
    tasks.push(searchOpenLigaDB({ ...competition, fetchImpl })
      .then((rows) => ({ provider: "openligadb", status: "completed", rows }))
      .catch((error) => ({ provider: "openligadb", status: "failed", rows: [], errorCode: error.message })));
  }
  const providerRuns = await Promise.all(tasks);
  const identityRows = providerRuns.find((run) => run.provider === "wikidata")?.rows ?? [];
  const identitySuggestions = compareIdentity(candidate, identityRows);
  return {
    candidate: { name: clean(candidate.name), birthYear: candidate.birthYear ?? null },
    providers: providerRuns.map(({ provider, status, errorCode, rows }) => ({
      provider, status, errorCode: errorCode ?? null, resultCount: rows.length,
      license: PROVIDERS[provider].license,
    })),
    identitySuggestions,
    competitionContext: providerRuns.find((run) => run.provider === "openligadb")?.rows ?? [],
    conflicts: detectFactConflicts(identitySuggestions.map((row) => ({
      claimType: "birth_date",
      value: row.birthDate,
      sourceUrl: row.sourceUrl,
    })).filter((row) => row.value)),
    persistence: "not_performed",
    approvalRequired: true,
    warnings: [
      "External identity matches are suggestions and require human confirmation.",
      "OpenLigaDB supplies competition fixtures/results, not player-level performance data.",
      "No external claims were persisted or used to overwrite canonical player records.",
    ],
  };
}
