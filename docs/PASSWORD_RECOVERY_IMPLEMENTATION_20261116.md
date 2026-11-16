# PFMS password recovery implementation — 16 November 2026

## Scope
Implemented on `feature/pfss-complete-platform-build` only. The production branch and production Supabase project were not changed. Render auto-deploy remains disabled; no deployment was triggered.

## User flow
1. The login screen's “Passwort vergessen?” action opens a dedicated full-screen recovery view.
2. The user enters the account email address on that view.
3. The browser calls Supabase Auth `resetPasswordForEmail` and redirects to the existing application URL, avoiding a new redirect-allowlist path.
4. The email's one-time recovery link returns the user to the application. Supabase's `PASSWORD_RECOVERY` event opens a dedicated password-reset view.
5. The user enters and confirms a new password (minimum 8 characters); Supabase Auth `updateUser({ password })` stores it.
6. On success the local session is signed out, the recovery URL fragment is cleared, and the login screen confirms the password was changed.

## Security
- The public response is deliberately identical whether an address exists or not. This prevents account enumeration. Supabase Auth's anti-enumeration behavior is relied upon.
- No password is stored in PFMS application tables or logged.
- Recovery is handled by Supabase Auth using its one-time, expiring recovery link/session.
- Existing password-change dialog remains available for authenticated account settings.
- The flow uses the existing runtime Supabase publishable key; no service-role or secret key is introduced.

## Files changed
- `index.html`: dedicated email-request and password-reset screens.
- `app.js`: recovery navigation, request submission, recovery callback handling, password confirmation and update.
- `styles.css`: matching responsive black/gold styling.
- `tests/password-recovery-contract-smoke.mjs`: regression contract checks.
- `package.json`: adds the regression check to syntax and distribution test commands.

## Validation / deployment
The contract test is wired into `npm test` and the branch's GitHub Actions quality workflow. A live end-to-end email test still requires a real staging test account and working Supabase Auth SMTP/template configuration. Render deployment has intentionally not been started; manual staging deployment remains a separate gated step.
