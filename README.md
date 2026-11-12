# PFMS / PFSS – Professional Football Management System

PFMS is the platform shell for football organisations, teams, agencies and scouts. PFSS is the scouting workspace within the project.

## Current architecture

- Static web frontend: HTML, CSS and JavaScript.
- Authentication and data services: Supabase Auth, Postgres and Row Level Security.
- Server-side workflows: Supabase Edge Functions.
- Hosting: Render (staging and production are separate deployments).
- Database backup target: Cloudflare R2 through an encrypted GitHub Actions workflow.

## Development

The active development branch for the current foundation work is `foundation/permissions-v1`.

Open `index.html` through a local static web server for frontend work. The application requires its configured Supabase project and public client key for authenticated functionality. Never place service-role or secret keys in browser code.

## Automated checks

GitHub Actions runs `scripts/pfss-validate.mjs` on pushes and pull requests. It checks JavaScript syntax, duplicate HTML IDs and local HTML resource references.

These are static checks only. They do not replace browser/device testing, database policy tests, security review or a successful backup restore.

## Important project rules

1. Keep production hosting and production data separate from staging.
2. Never run a database migration against production without a live schema inventory, a tested migration plan and explicit approval.
3. Do not treat preview/demo workspace modules as connected production functionality.
4. Verify Row Level Security on the server for every data operation; hiding a navigation item is not authorization.
5. Treat player data, especially data about minors, as confidential.
6. Test database backups by restoring them into a separate environment.

See `docs/SECURITY_AUDIT_2026-11-12.md` and `docs/IMPLEMENTATION_AND_RELEASE_PLAN.md` for findings and the release checklist.
