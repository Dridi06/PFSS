/**
 * ASI provider registry and safe adapters.
 * No scraping, browser automation, hidden endpoints, or bypass of access controls.
 * Commercial reuse is enabled only where the recorded license permits it.
 */

export const PROVIDERS = Object.freeze({
  openligadb: Object.freeze({
    key: "openligadb",
    name: "OpenLigaDB",
    baseUrl: "https://www.openligadb.de/api",
    dataScope: ["fixtures", "results", "league_metadata"],
    license: "ODbL-1.0",
    commercialUse: true,
    attribution: "Data: OpenLigaDB (ODbL 1.0)",
    shareAlike: true,
    requiresApiKey: false,
    maxRequestsPerMinute: 60,
    termsUrl: "https://www.openligadb.de/",
    enabledByDefault: false,
    restrictions: [
      "Respect rate limits and fair use",
      "Cache responses and avoid polling",
      "ODbL attribution and share-alike obligations apply to redistributed adapted databases",
      "Provider data does not include player performance scouting metrics",
    ],
  }),
  wikidata: Object.freeze({
    key: "wikidata",
    name: "Wikidata",
    baseUrl: "https://query.wikidata.org/sparql",
    dataScope: ["identity", "birth_facts", "nationality", "career_links"],
    license: "CC0-1.0",
    commercialUse: true,
    attribution: "Wikidata (CC0; attribution recommended)",
    shareAlike: false,
    requiresApiKey: false,
    maxRequestsPerMinute: 5,
    termsUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing",
    enabledByDefault: false,
    restrictions: [
      "Use scoped SPARQL queries and a descriptive User-Agent",
      "Do not treat Wikidata as a source of performance statistics",
      "Identity matches require human or multi-signal verification",
    ],
  }),
});

function safeText(value, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeSparqlLiteral(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')
    .replaceAll("\n", " ").replaceAll("\r", " ");
}

function assertHttpUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Provider URL must use HTTPS");
  return parsed;
}

async function fetchJson(fetchImpl, url, headers = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeProviderEvidence({ provider, subject, claims, retrievedAt = new Date().toISOString() }) {
  const policy = PROVIDERS[provider];
  if (!policy) throw new Error("Unknown provider");
  if (!Array.isArray(claims)) throw new TypeError("claims must be an array");
  return claims.map((claim) => {
    const sourceUrl = safeText(claim.sourceUrl, 2000);
    assertHttpUrl(sourceUrl);
    return {
      provider,
      subject: safeText(subject, 200),
      claimType: safeText(claim.claimType, 80),
      title: safeText(claim.title, 240),
      value: safeText(claim.value, 2000),
      sourceUrl,
      publisher: policy.name,
      license: policy.license,
      attribution: policy.attribution,
      commercialUse: policy.commercialUse,
      shareAlike: policy.shareAlike,
      retrievedAt,
      verificationStatus: "unconfirmed",
      reviewStatus: "pending",
    };
  });
}

export async function searchOpenLigaDB({ league = "bl1", season, fetchImpl = fetch }) {
  if (!/^[a-z0-9_-]{2,12}$/i.test(league)) throw new Error("Invalid league shortcut");
  if (!Number.isInteger(season) || season < 1900 || season > 2200) throw new Error("Invalid season");
  const url = assertHttpUrl(`${PROVIDERS.openligadb.baseUrl}/getmatchdata/${encodeURIComponent(league)}/${season}`);
  const rows = await fetchJson(fetchImpl, url.toString());
  if (!Array.isArray(rows)) throw new Error("Unexpected OpenLigaDB response");
  return rows.map((match) => ({
    provider: "openligadb",
    claimType: "fixture_result",
    matchId: match.matchID ?? null,
    league: safeText(match.leagueName, 120),
    season: match.leagueSeason ?? season,
    date: match.matchDateTime ?? null,
    homeTeam: safeText(match.team1?.teamName, 120),
    awayTeam: safeText(match.team2?.teamName, 120),
    homeScore: Number.isFinite(match.matchResults?.[0]?.pointsTeam1) ? match.matchResults[0].pointsTeam1 : null,
    awayScore: Number.isFinite(match.matchResults?.[0]?.pointsTeam2) ? match.matchResults[0].pointsTeam2 : null,
    sourceUrl: "https://www.openligadb.de/",
    attribution: PROVIDERS.openligadb.attribution,
    license: PROVIDERS.openligadb.license,
    retrievedAt: new Date().toISOString(),
    verificationStatus: "unconfirmed",
  }));
}

export async function searchWikidataPlayer({ name, fetchImpl = fetch }) {
  const cleaned = safeText(name, 100);
  if (cleaned.length < 2) throw new Error("Player name is too short");
  const literal = escapeSparqlLiteral(cleaned);
  const query = `SELECT ?item ?itemLabel ?birthDate ?nationalityLabel WHERE {
    ?item wdt:P106 wd:Q937857;
          rdfs:label ?label.
    FILTER(LANG(?label) = "en")
    FILTER(LCASE(STR(?label)) = LCASE("${literal}"))
    OPTIONAL { ?item wdt:P569 ?birthDate. }
    OPTIONAL { ?item wdt:P27 ?nationality. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de". }
  } LIMIT 10`;
  const url = new URL(PROVIDERS.wikidata.baseUrl);
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  const payload = await fetchJson(fetchImpl, assertHttpUrl(url.toString()).toString(), {
    "User-Agent": "ASI-Scouting-Research/0.1 (contact: project-maintainer)",
  });
  const bindings = payload?.results?.bindings;
  if (!Array.isArray(bindings)) throw new Error("Unexpected Wikidata response");
  return bindings.map((row) => ({
    provider: "wikidata",
    entityUrl: row.item?.value ?? null,
    label: row.itemLabel?.value ?? cleaned,
    birthDate: row.birthDate?.value ?? null,
    nationality: row.nationalityLabel?.value ?? null,
    sourceUrl: row.item?.value ?? "https://www.wikidata.org/",
    license: PROVIDERS.wikidata.license,
    attribution: PROVIDERS.wikidata.attribution,
    retrievedAt: new Date().toISOString(),
    identityStatus: "pending",
    verificationStatus: "unconfirmed",
  }));
}

export function providerReadiness(provider, purpose = "internal") {
  const policy = PROVIDERS[provider];
  if (!policy) return { allowed: false, reason: "unknown_provider" };
  if (purpose === "commercial" && !policy.commercialUse) {
    return { allowed: false, reason: "commercial_rights_not_confirmed" };
  }
  return {
    allowed: true,
    provider: policy.key,
    license: policy.license,
    attributionRequired: true,
    shareAlike: policy.shareAlike,
    humanReviewRequired: true,
    autoIngestEnabled: false,
  };
}
