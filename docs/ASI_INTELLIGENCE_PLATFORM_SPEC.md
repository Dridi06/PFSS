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

## Recruitment intelligence implementation update

- Product scope is now explicitly a unified recruitment intelligence platform: internal authorized database candidates and lawful external candidates are ranked in one brief-specific workflow.
- Human scout observations and ratings remain separately attributed, immutable in history, and visible beside AI-derived dimensions.
- Added a deterministic, explainable ranking baseline at `asi-core/recruitment-engine.mjs`. It applies hard constraints, configurable weights, missing-data handling, evidence coverage, evidence confidence, reason/warning output and source-scope labels.
- Added `tests/asi-recruitment-engine-smoke.mjs` and wired it into syntax and distribution test scripts.
- This is a rules-based engineering baseline, not a trained or validated predictive model. It does not yet perform external research, fetch internal database records, calculate real football metrics, or forecast future player performance.
- Next implementation gates: validate actual ASI table contracts; connect authorized internal search; build scout observation workflow; add source adapters only after rights review; then build calibrated, backtested potential models.
- Repository separation remains a release prerequisite: current work is isolated on an ASI feature branch in the legacy PFSS repository. It is not yet a separate GitHub repository or separately deployed product. Do not deploy the legacy PFMS service.

## Implemented intelligence modules (2026-11-25)

### Explainable recruitment ranking
- `asi-core/recruitment-engine.mjs` combines internal and external candidates under a role/search brief.
- Applies hard constraints, configurable dimension weights, missing-data handling, evidence coverage, confidence, source references and explanation output.
- Scout observations remain attributed and are not overwritten by algorithmic scores.

### Provider and licensing layer
- `asi-core/providers.mjs` contains adapters for OpenLigaDB and Wikidata.
- OpenLigaDB is restricted to fixtures/results/competition metadata; Wikidata is restricted to identity and biographical facts.
- Provider registry stores license, attribution, share-alike and commercial-use metadata.
- Both adapters are disabled by default; automated persistence is disabled; all identity/evidence remains unconfirmed pending review.
- No scraping, paywall bypass, or unlicensed performance-data extraction is implemented.

### Evidence-first research workflow
- `asi-core/research-workflow.mjs` creates identity suggestions and detects conflicting claims.
- Exact normalized name equality is only a pending match (0.70 confidence), never an automatic identity merge.
- External research bundles explicitly report `persistence: not_performed`.

### Development and model evaluation
- `asi-core/development-signal.mjs` calculates a transparent longitudinal trend only when at least four valid dated observations cover at least six months. It is not a trained future-performance model.
- `asi-core/model-evaluation.mjs` calculates MAE, RMSE, bias and median absolute error only when the minimum paired sample threshold is met.

### Validation
- Contract smoke tests cover ranking, provider licensing metadata, adapter normalization, missing data, identity matching, conflict detection, development trends and regression evaluation.
- Tests are wired into `npm run check:syntax` and `npm run test:dist`.
- GitHub Actions is the authoritative execution environment for this branch; current run status must be checked before declaring the new commits validated.

### Still not implemented
- Authenticated ASI user interface and backend API integration.
- Persistence pipeline into the existing ASI tables with ownership-safe RLS and admin review workflow.
- Additional permitted sources and robust data refresh scheduling.
- Video ingestion/analysis and match event analytics.
- Proper training datasets, time-based backtests, calibration, bias testing and approved production prediction models.
- Dedicated ASI repository, separate hosting service, staging environment and end-to-end browser acceptance.


## Standalone ASI workspace foundation (2026-11-25)

- Added a separate browser workspace under `asi/`; it does not modify or load the PFMS interface.
- Authentication uses Supabase Auth with persistent sessions, password-reset request flow and a publishable browser key only.
- The workspace reads the authorized player catalogue, stores owner-scoped candidate records, and writes attributed scout observations through existing RLS policies.
- Candidate records remain separate from canonical players. The UI does not bypass identity review or invoke promotion automatically.
- Added an isolated build script `scripts/build-asi.mjs` that writes to `dist-asi/`, validates the exact ASI project reference, and rejects secret/service-role keys. The default CI build uses placeholders and cannot connect to a real database.
- Added workspace contract smoke tests and wired the ASI build into CI.
- This is an initial functional workspace shell, not a production-ready product: role-specific admin review, durable evidence capture, automated research jobs, video analytics, model training and browser E2E remain outstanding.
- No Supabase schema migration, database write, Edge Function deployment, Render deployment or production change was performed for this workspace milestone.
