# Auth Implementation Plan (V1)

## Target architecture

1. Eleventy builds static output into `SITE_OUTPUT_DIR`.
2. Node/Express server handles authentication and sessions.
3. Server verifies Google ID token and checks `ALLOWED_EMAILS`.
4. Server serves static output only to authenticated sessions.

## Environment variables

- `GOOGLE_CLIENT_ID` (required)
- `SESSION_SECRET` (required, >= 16 chars)
- `ALLOWED_EMAILS` (required, comma-separated)
- `SUPPORT_CONTACT_EMAIL` (optional)
- `SESSION_TTL_HOURS` (optional, default `8`)
- `AUTH_HOST` (optional, default `127.0.0.1`)
- `AUTH_PORT` (optional, default `8082`)
- `TRUST_PROXY` (optional, default `0`; set `1` behind HTTPS reverse proxy)

Existing build vars stay supported:

- `FAMILY_DATA_DIR`
- `FAMILY_ROOT_PERSON`
- `SITE_OUTPUT_DIR`
- `AVATARS_SUBDIR`
- `ELEVENTY_PATH_PREFIX`

## Delivery phases

## Phase A: Requirements and ADR

- Document confirmed constraints and non-goals.
- Record security assumptions and acceptance criteria.

## Phase B: Server scaffold

- Add secure server process and scripts.
- Add `/login`, `/auth/google`, `/not-allowed`, `/logout`, `/api/session`.
- Gate static output behind auth middleware.

## Phase C: Production hardening

- Add reverse-proxy notes (`X-Forwarded-*`, TLS termination).
- Add optional CSRF checks for auth endpoint.
- Add security headers and rate limiting.

## Phase D: Deployment migration

- Move from GitHub Pages deployment to self-host deployment.
- Keep GitHub Actions for build/test/deploy orchestration.

## Acceptance checklist

1. Anonymous GET `/` redirects to `/login`.
2. Anonymous GET `/avatars/*` returns 401 or redirect, never image bytes.
3. Allowlisted email receives session and can load tree.
4. Non-allowlisted email lands on `/not-allowed`.
5. Session expires after configured TTL.
6. `npm run build` output remains unchanged and reusable by secure server.
