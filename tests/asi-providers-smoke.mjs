import assert from "node:assert/strict";
import {
  PROVIDERS, normalizeProviderEvidence, providerReadiness,
  searchOpenLigaDB, searchWikidataPlayer,
} from "../asi-core/providers.mjs";

assert.equal(providerReadiness("openligadb", "commercial").allowed, true);
assert.equal(providerReadiness("wikidata", "commercial").allowed, true);
assert.equal(providerReadiness("openligadb").autoIngestEnabled, false);
assert.equal(PROVIDERS.openligadb.shareAlike, true);
assert.equal(PROVIDERS.wikidata.license, "CC0-1.0");

const evidence = normalizeProviderEvidence({
  provider: "wikidata",
  subject: "Example player",
  claims: [{ claimType: "birth_date", title: "Birth date", value: "2000-01-01", sourceUrl: "https://www.wikidata.org/entity/Q1" }],
});
assert.equal(evidence[0].reviewStatus, "pending");
assert.equal(evidence[0].verificationStatus, "unconfirmed");
assert.throws(() => normalizeProviderEvidence({
  provider: "wikidata", subject: "x",
  claims: [{ claimType: "x", title: "x", value: "x", sourceUrl: "http://example.org" }],
}), /HTTPS/);

const openLiga = await searchOpenLigaDB({
  league: "bl1", season: 2025,
  fetchImpl: async () => new Response(JSON.stringify([{
    matchID: 1, leagueName: "Bundesliga", leagueSeason: 2025,
    matchDateTime: "2025-08-01T20:30:00",
    team1: { teamName: "Home" }, team2: { teamName: "Away" },
    matchResults: [{ pointsTeam1: 2, pointsTeam2: 1 }],
  }]), { status: 200, headers: { "content-type": "application/json" } }),
});
assert.equal(openLiga[0].homeScore, 2);
assert.equal(openLiga[0].license, "ODbL-1.0");

const wiki = await searchWikidataPlayer({
  name: 'Alex "Test"',
  fetchImpl: async (url) => {
    assert.ok(String(url).includes("query="));
    return new Response(JSON.stringify({ results: { bindings: [{
      item: { value: "https://www.wikidata.org/entity/Q1" },
      itemLabel: { value: "Alex Test" },
      birthDate: { value: "2000-01-01T00:00:00Z" },
      nationalityLabel: { value: "Germany" },
    }] } }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
assert.equal(wiki[0].birthDate, "2000-01-01T00:00:00Z");
assert.equal(wiki[0].identityStatus, "pending");
console.log("ASI provider registry and adapter smoke passed.");
