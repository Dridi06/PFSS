# PFSS-Test foundation – execution runbook

## Safety boundary

This package targets **PFSS-Test** only (project ref `oolvpbzbqiojioazsoun`).
Do not run it against the original Supabase project or production. Render production
must remain untouched. The branch is `foundation/permissions-v1`.

The test project was previously inspected and returned zero rows for application
tables in the `public` schema. This runbook assumes that isolated empty state.
If any application tables now exist, stop and inventory them before proceeding.

## Migration order

Run these files in Supabase SQL Editor for PFSS-Test, one at a time, in this order:

1. `20261113_pfss_core_tenant_foundation.sql`
2. `20261113_pfss_organization_bootstrap_rpc.sql`
3. `20261113_pfss_tenant_mutation_hardening.sql`
4. `20261113_pfss_profile_integrity.sql`
5. `20261113_pfss_updated_at_triggers.sql`
6. `20261113_pfss_admin_and_invitation_rpcs.sql`
7. `20261113_pfss_tenant_storage_and_audit_hardening.sql`

Copy the complete contents from this branch's `supabase/migrations/` directory.
Wait for a successful result after each file. If any migration fails, stop; do not
continue with later files. Preserve the exact error text for diagnosis.

Do **not** run earlier experimental migrations that create the competing
`organizations`, `organization_memberships`, `pfms_organizations`, or
`pfms_memberships` models. The new foundation uses `pfss_organizations` and
`pfss_memberships` as its canonical tenant model.

## First administrator

After the migrations succeed, create or register the intended administrator
account through Supabase Auth. Confirm its Auth user UUID in Authentication →
Users. Then run this statement in PFSS-Test SQL Editor, replacing the UUID:

```sql
update public.profiles
set role = 'admin', status = 'approved'
where id = 'REPLACE_WITH_AUTH_USER_UUID'::uuid;

select id, username, role, status
from public.profiles
where id = 'REPLACE_WITH_AUTH_USER_UUID'::uuid;
```

Do not promote an account unless its UUID has been verified in the PFSS-Test
project. This is a one-time bootstrap operation, not a browser feature.

## Frontend test configuration

The branch now loads `pfss-config.js` before `app.js`. It is deliberately
pinned to the PFSS-Test URL. Replace only
`REPLACE_WITH_PFSS_TEST_PUBLISHABLE_KEY` with the **publishable/anon** key from
PFSS-Test → Project Settings → API Keys. Never use a service-role or secret key.
Do not put credentials into chat or commit service-role secrets.

The test key is public by design, but it must belong to PFSS-Test. Production
uses a separate deployment/configuration and must not be changed as part of this
test workflow.

## Read-only verification after migration

Run the following query in PFSS-Test SQL Editor:

```sql
select
  to_regclass('public.profiles') as profiles,
  to_regclass('public.pfss_organizations') as organizations,
  to_regclass('public.pfss_memberships') as memberships,
  to_regclass('public.pfss_players') as players,
  to_regclass('public.pfss_scouting_reports') as reports,
  to_regclass('public.pfss_invitations') as invitations,
  to_regclass('public.pfss_audit_log') as audit_log,
  to_regprocedure('public.pfss_create_organization(text,text,text)') as create_org_rpc,
  to_regprocedure('public.pfss_admin_list_profiles()') as admin_list_rpc,
  to_regprocedure('public.pfms_create_legacy_invitation(uuid,text,integer)') as invitation_rpc;

select schemaname, tablename, rowsecurity
from pg_tables
join pg_class on pg_class.relname = pg_tables.tablename
where schemaname = 'public'
  and tablename like 'pfss_%'
order by tablename;

select id, name, public, file_size_limit
from storage.buckets
where id = 'pfss-tenant-private';
```

Expected: all named tables and RPC signatures are non-null; RLS is true for
application tables; the storage bucket exists and `public=false`.

## Tests still required after the user's execution

- Verify signup + email confirmation + login and username login.
- Verify administrator list/update profile RPCs.
- Verify organization creation and initial owner membership.
- Verify invite creation, single-use redemption, expiry and replay rejection.
- Verify RLS isolation with two separate test users and two organizations.
- Verify private storage read/write/delete boundaries.
- Run the release-gate SQL and GitHub Actions.
- Test the actual staging deployment in desktop and mobile browsers.
- Restore a backup into a separate disposable database.

A successful migration is not proof of runtime security or production readiness.
No production release is authorized by this runbook.
