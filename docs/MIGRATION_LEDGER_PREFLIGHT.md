# PFMS – Migration ledger preflight

This preflight is a **read-only comparison** between the repository migration files and the output of the Supabase CLI. It does not connect to a database, apply migrations, repair history, or prove that the live schema matches the migrations.

## Run against the dedicated STAGING project only

From the repository root, first confirm the linked project in the Supabase Dashboard and CLI. Then capture the unmodified CLI output and pipe it into the checker:

```bash
supabase migration list | node scripts/verify-migration-ledger.mjs
```

The checker compares the CLI LOCAL column with every timestamped SQL migration in `supabase/migrations`, then checks that the REMOTE column contains only versions present in the branch and forms a chronological prefix of the local migration inventory.

A successful result means only that the reported migration history is structurally consistent with this branch. It does **not** mean that the SQL has been executed successfully, that the remote schema is equivalent, or that RLS, grants, triggers, SECURITY DEFINER functions or tenant isolation are correct.

## Current repository finding (15 November 2026)

The current feature branch contains 64 timestamped SQL files and 48 distinct eight-digit prefixes. Eleven prefixes are duplicated, including `20261110`, `20261111`, `20261112`, `20261115`, `20261116`, `20261117`, `20261118`, `20261121`, `20261122`, `20261201` and `20261205`. The checker deliberately fails closed on duplicate local versions. This is an unresolved migration-history blocker, not proof that any remote migration is already applied or unapplied. Do not rename or reorder existing migration files until the actual isolated staging migration ledger and schema have been reconciled.

## Stop conditions

Stop and investigate if the checker reports any of the following:

- CLI output is missing the expected LOCAL/REMOTE table header.
- Local CLI inventory differs from repository migration files.
- Duplicate local or remote migration versions exist.
- A remote version is absent from the branch.
- Applied remote versions are not a chronological prefix of the branch migration set.

Do not use `migration repair`, `--include-all`, manual ledger edits, or a production project to make the check pass. Resolve the schema and migration-history divergence deliberately, with a verified backup and a reviewed plan.

## Regression coverage

`tests/migration-ledger-preflight-smoke.mjs` exercises a valid prefix, remote-only versions, out-of-order history, duplicate remote versions and malformed CLI output. These tests use synthetic CLI output and never contact Supabase.
