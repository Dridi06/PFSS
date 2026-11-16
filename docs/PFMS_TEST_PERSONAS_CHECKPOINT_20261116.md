# PFMS Staging Test Personas Checkpoint — 2026-11-16

## Environment
- Target: Supabase staging project `oolvpbzbqiojioazsoun` (PFFS-Test, EU West).
- Production project and production Render service were not accessed or modified.
- Development branch: `feature/pfss-complete-platform-build`.

## Created test fixture roster
A dedicated table `public.pfms_test_personas` was created in staging. It contains 41 synthetic test-persona fixtures, with no email addresses and no login credentials.

| Role | Count |
|---|---:|
| scout | 5 |
| verein | 5 |
| trainer | 5 |
| co_trainer | 5 |
| agentur | 5 |
| agenturscout | 5 |
| betreuer | 5 |
| spieler | 5 |
| admin | 1 |
| **Total** | **41** |

Each row is constrained to `is_test = true` and `login_enabled = false`. Test keys are deterministic by role and ordinal (for example, `scout-01`).

## Security controls
- RLS enabled and FORCE RLS enabled on `public.pfms_test_personas`.
- All table privileges revoked from `anon` and `authenticated`.
- Verification query returned zero client grants.
- The fixtures are not real rows in `public.profiles`, `auth.users`, or membership tables.
- Existing data was preserved.

## Verification snapshot
- Test personas: 41.
- Supabase Auth users: 1 (unchanged).
- Public profiles: 1 (unchanged).
- RLS enabled and forced: true.
- anon/authenticated grants: 0.

## Important limitations
These are isolated test fixtures, not authenticated PFMS accounts. They cannot log in and are not yet visible through the application UI. The `profiles.id` foreign key requires a corresponding Auth user; inserting fake profiles or bypassing that relationship would corrupt the authorization model. Actual login, registration, role-based UI and end-to-end permission tests still require a secure Auth test-user provisioning route and a browser test runner.

## Next safe steps
1. Add an admin-only staging fixture viewer or an automated test harness that reads the fixtures without exposing them to ordinary clients.
2. Provision actual staging Auth users through Supabase Auth Admin API or normal email confirmation flow, when an approved secure route is available.
3. Test each role's effective permissions with isolated authenticated sessions.
4. Keep production untouched; do not apply migrations or deploy production as part of this checkpoint.
