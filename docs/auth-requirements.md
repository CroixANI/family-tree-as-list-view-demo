# Auth Requirements (V1)

## Context

The family tree is currently generated as static files. V1 auth introduces a server-side gate so tree data is visible only after sign-in.

## Confirmed decisions

- Hosting model: self-hosted web app (not pure GitHub Pages).
- Auth provider: Google first; architecture must allow adding providers later.
- Access model: authentication + allowlist (no role-based authorization in v1).
- Allowlist matching: exact email, case-insensitive.
- Session duration: 8 hours.
- Unauthorized UX: friendly "not allowed" page with support contact email.
- Audit logs: out of scope for v1 (must be possible to add later).
- Screenshot prevention: non-goal for v1.

## Functional requirements

1. Anonymous users cannot load family tree HTML, CSS/JS, or avatar images.
2. User can sign in with Google.
3. Only allowlisted emails can access the site.
4. Denied email sees a dedicated "not allowed" page with contact instructions.
5. Session expires after 8 hours.
6. Logged-in user can log out explicitly.

## Security requirements

1. Google ID token must be verified server-side.
2. Session cookie must be `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
3. Secrets (`SESSION_SECRET`, OAuth secrets when used) must never be committed.
4. Email allowlist check must be case-insensitive.
5. Build output must not be served by a public unauthenticated endpoint.

## Non-goals (v1)

- Preventing screenshots/camera capture.
- Per-user edit permissions (read-only only).
- Audit log storage and reporting.
- Multi-factor authentication.
