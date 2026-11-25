# ASI — Human Scout + Recruitment Intelligence
## Product and engineering specification

**Status:** Product direction approved; implementation specification.
**Product:** Independent football scouting and analysis platform. ASI is not a PFMS feature.
**Primary outcome:** Identify the best-fit player for a club, squad, role or agency brief — from both the user's private database and lawful external sources — including early identification of exceptional emerging talent.

## 1. Product principle

ASI combines three complementary intelligence layers:

1. **Human scouting intelligence:** the scout's first-hand observations, ratings, notes, video timestamps and confidence.
2. **Evidence intelligence:** sourced facts and statistics from the internal player database and permitted external providers.
3. **Model intelligence:** reproducible performance, role-fit, potential and recruitment models.

ASI must not replace the scout's eye. It must preserve the scout's independent judgement, make it more useful, challenge it with evidence where appropriate, and surface players the scout may have overlooked.

## 2. Unified player universe

Search and analysis operate across two scopes in one workflow:

- **Private/internal universe:** all players the account or organization is authorized to access, including historical observations, ratings, reports, saved candidates and previous analyses.
- **External universe:** players discoverable through registered sources whose licence and terms explicitly permit the intended research and (if applicable) commercial use.

The engine must deduplicate and resolve identities before combining records. It must retain source ownership, organization boundaries and access controls. A private scout report must never leak to another tenant or be used to train a shared model without a separate lawful basis and explicit product policy.

## 3. Human scout input — first-class evidence

A scout can create or update a first-hand assessment. The input should support:

- overall scout rating and optional category ratings;
- position and role observed;
- match/session date, competition, opponent and minutes observed;
- observation context (live, full match video, highlights, second-hand report);
- free-text strengths, weaknesses and tactical notes;
- confidence in the assessment and familiarity with the player;
- evidence attachments or video timestamps where permitted;
- author, organization, creation time and edit history.

Human assessments are stored as attributed observations, not silently merged into objective statistics. The original rating and every revision remain auditable.

ASI should compare scout opinions with other scouts and available evidence, showing agreement, disagreement and sample limitations. It must not automatically overwrite a scout rating with an AI score. The scout remains the decision-maker.

## 4. Player evaluation — keep dimensions separate

For every player, ASI may calculate distinct, explainable outputs:

- **Observed performance:** what the sourced match data and documented observations show.
- **Scout assessment:** what a named scout observed and rated.
- **Role / tactical fit:** suitability for a defined role, formation, coach style and team requirements.
- **Potential / development projection:** a probabilistic forecast over an explicit time horizon.
- **Recruitment feasibility:** age, contract and cost information only where sourced and lawfully available.
- **Evidence confidence:** source quality, recency, corroboration, sample size and coverage.

A single **ASI Suitability Score** may rank candidates for a specific recruitment brief, but it must be a transparent, configurable composite of these dimensions. It is not a universal measure of a player's worth. Show component weights, missing data, uncertainty and reasons for ranking. Never present evidence confidence as player quality.

## 5. Recruitment brief and ranking workflow

A user should be able to describe a need in natural language or structured filters, for example:

"Find an under-21 left-footed centre-back for a high defensive line, strong in recovery pace and progressive passing, within our budget."

The workflow:

1. Parse the brief into explicit requirements and preferences.
2. Search the authorized internal player universe first and in parallel search permitted external sources.
3. Resolve identities and merge only verified player records.
4. Apply hard constraints separately from soft preferences.
5. Calculate role fit and suitability with position-, role-, age- and competition-aware context.
6. Rank candidates and show why each player matches or fails.
7. Surface overlooked internal players and emerging external talents.
8. Present risks, missing evidence, data freshness and confidence.
9. Let the scout review, shortlist, reject or request more research.
10. Record the decision and, later, compare predictions with actual outcomes.

The result should explain: best fit now, best development bet, best value candidate, safest option and high-upside/high-risk option where the evidence supports those distinctions.

## 6. Early talent discovery

Potential models must distinguish current ability from future projection. They should look for development signals such as age-adjusted performance, role-adjusted output, progression over time, performance against stronger opposition, minutes and opportunity context. They must control for small samples, league strength, position, team effects and survivorship bias.

Every projection must include:
- forecast horizon (e.g. 12, 24 or 36 months);
- prediction interval or calibrated uncertainty;
- data coverage and sample size;
- comparable cohort / reference population;
- model version and backtest status;
- known limitations and reasons the model may be wrong.

"Hidden gem" or "elite potential" labels are prohibited unless predefined, validated thresholds and adequate evidence support them. Early signals are leads for human review, not guarantees.

## 7. Learning loop and model governance

ASI learns through controlled evaluation, not by silently changing weights after each rating.

- Store immutable, time-stamped input snapshots and model versions.
- Capture scout decisions, later observations and measurable player outcomes where lawfully available.
- Evaluate calibration, ranking quality, false positives and performance across positions, age groups and competitions.
- Compare a candidate model against the current production model on a holdout set.
- Promote a new model only after predefined acceptance thresholds and human approval.
- Keep tenant data isolated. Cross-tenant training requires a separately reviewed lawful basis, contractual terms and privacy controls.
- Allow users to correct inaccurate identity links and source facts with audit history.

## 8. Source, rights and data integrity rules

Maintain a source registry with licence status, permitted purposes, attribution requirements, commercial-use status, retention constraints, rate limits and review date. A source is unavailable to commercial workflows until commercial rights are verified. Do not scrape websites contrary to their terms, bypass access controls, or infer sensitive health/injury data. Missing data stays unknown; estimates are explicitly labelled estimates.

## 9. Product modules

- ASI Core: orchestration, permissions and audit.
- ASI Scout Workspace: first-hand reports and human ratings.
- ASI Database Intelligence: internal search, quality checks and rediscovery.
- ASI Global Discovery: permitted external discovery.
- ASI Identity & Evidence: canonical identity, provenance and conflict resolution.
- ASI Performance Analytics: contextualized metrics.
- ASI Tactical Intelligence: role and system fit.
- ASI Potential Lab: forecasts, validation and model governance.
- ASI Recruitment Engine: briefs, ranking, shortlist and decision support.
- ASI Agency / Club Workspace: tenant isolation, teams, roles and subscription entitlements.

## 10. Non-negotiable product requirements

1. Internal and external players are searchable in one experience, with source scope visible.
2. A human scout rating remains attributed to its author and is never overwritten by AI.
3. AI scores and scout ratings are displayed separately.
4. Every material factual claim is traceable to evidence and retrieval time.
5. Identity ambiguity, contradictory claims and insufficient samples are clearly flagged.
6. No unsupported precision: unknown values are not converted to zero.
7. Ranking is specific to a recruitment brief; no misleading universal "best player" score.
8. Forecasts show uncertainty and validation status.
9. Tenant isolation and RLS are tested for all private scouting data.
10. No deployment or production changes are authorized by this specification.

## 11. Implementation sequence

**Phase A — Product data contract:** finalize player, observation, scout-rating, recruitment-brief, evidence and score schemas.

**Phase B — Unified search:** internal database search, external provider registry, identity resolution and deduplication.

**Phase C — Human scout workspace:** structured observation entry, rating history, evidence attachment and review workflow.

**Phase D — Explainable recruitment ranking:** hard constraints, role-fit model, score breakdown, confidence and shortlist.

**Phase E — Early-potential research:** longitudinal features, forecast baselines, backtesting and model registry.

**Phase F — Commercial readiness:** separate ASI infrastructure, tenant isolation, billing, source rights review, security and operational monitoring.

## 12. Open product detail

The exact scout-rating scale and category rubric should be configurable. Start with a simple overall rating plus optional category scores and free-text evidence; do not force a scout to fill every field after a short observation. Later, calibrate ratings across scouts using shared examples without erasing individual judgement.
