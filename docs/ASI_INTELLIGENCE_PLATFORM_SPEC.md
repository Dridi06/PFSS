# ASI — Advanced Scouting Intelligence
## Implementation baseline and target architecture

**Status:** Engineering workstream opened; database foundation exists in the dedicated `myScoutingDatabase` Supabase project. This document distinguishes deployed database capabilities from code that is not yet implemented.

## Product contract

ASI is a research, verification, analysis, valuation and controlled-import station. It is not a stand-alone market-value calculator.

1. Discover a player from a name, club, birth year, position or supplied profile URL.
2. Collect only data from sources whose terms and permitted purposes allow the intended use.
3. Preserve every claim with source URL, publisher, publication/event date, retrieval time, source class and raw evidence excerpt.
4. Resolve identity before attributing a claim to a player.
5. Normalize facts and detect contradictory, stale, duplicate and low-confidence claims.
6. Calculate descriptive metrics only from sourced inputs; mark missing values as unknown, never zero or guessed.
7. Produce a versioned analysis with methodology, confidence, data coverage and caveats.
8. Let an authorized user explicitly approve one atomic import into `players`.
9. Keep a full input snapshot and an audit trail so an import can be explained and corrected.

## System boundaries

- **Research orchestration:** provider adapters, query planning, rate limiting, retry/backoff and run status.
- **Source registry:** `asi_external_sources` holds source type, licence state and permitted purposes. A source must not be used merely because it is technically reachable.
- **Evidence ledger:** `asi_external_evidence` is the fact-level record. Health-sensitive or specially classified material must remain blocked unless the corresponding legal gate is approved. Injury/health data must not be scraped or inferred.
- **Identity resolution:** existing canonical identity registry and audited identity RPCs are retained; ambiguous identity blocks automatic attribution.
- **Verification:** source quality, recency, independent corroboration, conflicting claims and reviewer decisions remain separately visible.
- **Analytics:** separate observed performance, role fit, projection and market intelligence. Do not collapse them into an unexplained single score.
- **Import:** candidate remains separate from the scouting catalogue until a deliberate user action. Promotion is transactional and idempotency-protected.

## Scoring contract

Every metric must carry:
- value and unit;
- sample size and time window;
- competition/level context where available;
- source/evidence references;
- calculation version;
- confidence and coverage;
- missingness and caveats.

A confidence score describes evidence quality, not player quality. A performance score is meaningful only relative to position, age band, competition level and minutes/sample size. Predictions must show horizon and uncertainty interval and must be backtested before being presented as validated.

## Existing staging database inventory

The connected `myScoutingDatabase` project already contains:
- candidates, research runs, external sources and evidence;
- evidence reviews and contract snapshots;
- player analyses and scout observations;
- model versions/evaluations, prediction records/outcomes and training runs;
- canonical player identity, links and audit tables.

RLS is enabled on ASI tables. The current security advisor still reports pre-existing findings: RLS-enabled support-ticket tables without policies, five authenticated-executable SECURITY DEFINER functions (three ASI identity RPCs plus scout heartbeat/login RPCs), and leaked-password protection disabled. These are tracked as separate security remediation items and must be reviewed, not blindly changed.

## Implemented in this workstream

- Atomic candidate-to-player promotion RPC in migration `asi_candidate_atomic_promotion`.
- Promotion validates actor permissions, candidate ownership, candidate state, required fields, position values, identity confidence, source presence, unresolved blocking conflicts and duplicate player records.
- Player creation, immutable analysis snapshot and candidate status transition occur in one transaction.
- Promotion uses SECURITY INVOKER and relies on existing RLS policies; no service-role key is exposed.

## Not yet complete / external dependencies

- Provider adapters and lawful API credentials/licences are not present in the inspected repository/configuration. Without them, ASI cannot honestly claim automated multi-source live research.
- The ASI UI, research queue worker, provider integrations, fact-normalization/conflict resolver, statistical feature pipeline, calibrated prediction models, and end-to-end browser tests remain to be built.
- The existing Render static build currently hard-pins its staging target to the separate `PFFS-Test` project. The ASI schema is in `myScoutingDatabase`. Do not repoint the existing PFMS staging service or deploy ASI until a separate, explicitly configured ASI staging target is created and verified.
- Production is out of scope and must remain untouched.

## Acceptance criteria

1. A player can be researched from at least two independently licensed sources.
2. Every imported claim is traceable to evidence and retrieval time.
3. Contradictions and identity ambiguity are visible and block promotion when material.
4. No missing metric is silently imputed as zero.
5. Scores are reproducible from versioned formulas and show sample size, context and confidence.
6. Candidate promotion creates exactly one player and an immutable snapshot; a second attempt is rejected without a duplicate.
7. RLS tests prove cross-user candidate, evidence, analysis and player isolation.
8. Staging deployment is verified against the dedicated ASI project; production configuration and data are unchanged.
