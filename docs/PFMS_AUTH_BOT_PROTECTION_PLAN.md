# PFMS Authentication & Bot-Protection Hardening

Status: implementation workstream opened; staging verification required before release.

## Security objective

Protect the Professional Football Management System sign-in and registration flows against automated abuse, credential attacks, account enumeration, session theft, and unauthorized account activation. No system can honestly be described as "hacking-proof"; the release criterion is layered, tested risk reduction.

## Current baseline (source review)

- Username sign-in is handled by the `username-login` Edge Function.
- That function uses an Upstash sliding-window limit of 5 failed attempts per normalized username per 15 minutes, with an HMAC digest for the Redis key.
- It fails closed if the Upstash URL/token or a 32+ character HMAC key is missing.
- The email sign-in path currently calls Supabase Auth directly from the browser.
- Registration currently calls Supabase Auth signUp directly from the browser.
- The repository contains auth/session lifecycle smoke tests, but these are source-contract tests, not live attack simulations.
- No Turnstile/CAPTCHA verification was found in the current registration flow.

## Required implementation layers

### 1. Registration abuse protection
- Move public registration behind a dedicated server-side Edge Function.
- Require Cloudflare Turnstile verification server-side; never trust a client-side success flag.
- Verify hostname/action and reject expired, replayed, malformed, or unsuccessful challenges.
- Add shared Redis rate limits for registration by trusted platform-derived client IP and keyed email digest. Do not trust arbitrary caller-supplied `X-Forwarded-For` values.
- Enforce request body size, strict schema validation, normalized email/username, and generic public errors.
- Preserve existing invitation and owner-bootstrap rules; never allow client metadata to grant privileged roles.
- Keep owner bootstrap as a separate, one-time guarded flow.

### 2. Sign-in abuse protection
- Route email and username sign-in through server-side rate-limited endpoints, or enforce equivalent provider-side limits in Supabase Auth and verify them under load.
- Retain account-keyed failure throttling and add trusted-IP/network throttling to reduce distributed username/password guessing.
- Use progressive challenge (Turnstile) on suspicious traffic rather than blocking ordinary users unnecessarily.
- Avoid permanent account lockout that attackers could weaponize for denial of service.
- Keep responses indistinguishable for unknown accounts and incorrect passwords.

### 3. Account assurance
- Require email confirmation before account activation.
- Ensure pending/unapproved users cannot access organization, scout, player, storage, or administrative data.
- Add secure password reset controls and rate limits; keep the existing generic reset response.
- Apply a documented password policy and reject known-compromised passwords where supported by the identity provider.
- Require MFA for platform administrators and privileged organization roles before production launch.

### 4. Session and browser security
- Review token persistence and refresh-token rotation/reuse detection in Supabase Auth.
- Set short, appropriate access-token lifetime and session inactivity/absolute limits where supported.
- Re-authenticate before sensitive actions (role changes, ownership transfer, credential changes, exports).
- Enforce HTTPS, strict CSP, HSTS, secure referrer policy, and minimal third-party scripts.
- Review XSS sinks and ensure no access/refresh tokens are written to logs, URLs, analytics, or local application storage.

### 5. Monitoring and response
- Log security events without passwords, raw tokens, or unnecessary personal data.
- Alert on registration spikes, repeated failures, challenge failures, password-reset abuse, and privilege changes.
- Add temporary IP/network throttling and operational procedures for incident response.
- Define retention and access controls for security logs.

## Required secrets / configuration (staging first)

Create these only in the dedicated staging Edge Function environment; never commit values:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `PFMS_RATE_LIMIT_HMAC_KEY` (random, at least 32 bytes; independent from all other secrets)
- `TURNSTILE_SECRET_KEY`
- `PFMS_TURNSTILE_EXPECTED_HOSTNAME` (exact staging hostname)
- Public Turnstile site key exposed only to the staging frontend as a public configuration value.

Do not paste secret values into chat, source files, screenshots, GitHub commits, or browser-visible configuration. Rotate any secret that has been exposed.

## Release acceptance tests

- Registration without a challenge is rejected.
- Invalid, expired, replayed, wrong-hostname, and wrong-action challenges are rejected.
- Valid challenge plus valid invitation/registration data succeeds.
- Registration limits work across multiple Edge Function instances and reset as designed.
- Email and username login limits resist distributed guessing without leaking account existence.
- Unknown email, unknown username, and wrong password produce equivalent public errors.
- Password reset responses do not reveal account existence and are rate-limited.
- Unconfirmed, pending, suspended, and deleted users cannot access protected data.
- MFA is required for privileged roles.
- Session revocation, refresh-token reuse, logout, and account switching are tested.
- Cross-tenant negative tests prove one organization cannot access another organization's records or files.
- Browser/mobile accessibility and challenge fallback are tested.
- Staging tests include normal users, VPN/mobile network changes, and controlled bot-like bursts.

## Deployment boundaries

- This branch is based on the existing development branch and must remain separate until reviewed.
- Do not apply migrations, deploy Edge Functions, change Auth provider settings, or touch production as part of source-only preparation.
- The staging environment must be configured and verified before any live security setting is changed.
- A passing source test is not evidence of a passing live security test.
