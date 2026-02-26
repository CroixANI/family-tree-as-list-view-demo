# Authentication Flow (Sequence Diagram)

This document shows how secure mode gates the generated static site behind Google sign-in and allowlisted emails.

## Main sequence

```mermaid
sequenceDiagram
  autonumber
  actor U as Browser (User)
  participant B as Backend (Express)
  participant G as Google Identity Services

  U->>B: GET /
  B-->>U: 302 Redirect /login?next=/

  U->>B: GET /login
  B-->>U: 200 Login HTML + JS
  U->>G: Sign in via Google popup
  G-->>U: ID token credential

  U->>B: POST /auth/google { credential, nextPath }
  B->>G: verifyIdToken(idToken, audience=GOOGLE_CLIENT_ID)
  G-->>B: token payload (email, email_verified, sub, ...)

  alt Email verified and in ALLOWED_EMAILS
    B->>B: regenerate session + set req.session.user
    B-->>U: 200 { ok: true, redirect: nextPath }
    U->>B: GET nextPath (usually /) with session cookie
    B-->>U: 200 output/index.html
    U->>B: GET /avatars/*.jpg, /styles.css, /app.js ...
    B-->>U: 200 static files (auth middleware passed)
  else Email denied
    B-->>U: 403 { redirect: /not-allowed }
    U->>B: GET /not-allowed
    B-->>U: 403 Not allowed page + support contact
  end
```

## Why anonymous users cannot access static files

1. `GET /` is protected by `requireAuth` and redirects to `/login` when there is no session.
2. After that, the app applies `app.use(requireAuth, ...)` globally before `express.static(outputDir)`.
3. Because static serving is mounted after auth middleware, direct requests to built assets (including avatars) are also blocked until the session exists.
4. Session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production, with TTL from `SESSION_TTL_HOURS`.

## Public vs protected routes

- Public:
  - `/login`
  - `POST /auth/google`
  - `/not-allowed`
  - `/health`
  - `/auth-assets/*` (CSS/JS for login/not-allowed pages)
- Protected:
  - `/`
  - `/api/session`
  - all generated static files from `SITE_OUTPUT_DIR` (for example `/avatars/*`, CSS, JS, HTML pages)

## Important deployment note

This protection works only when traffic goes through the secure Node server.

If the `output/` folder is also published as a public static host (for example pure GitHub Pages), that public endpoint bypasses authentication.
