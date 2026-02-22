# Docker/Compose Deployment Guide

This guide runs secure mode (Google login + email allowlist) with Docker Compose.

## 1. Prerequisites

- Docker Engine + Docker Compose plugin installed on your server.
- A Linux VPS with ports `80` and `443` open (for TLS mode).
- Domain name pointed to your VPS public IP (for TLS mode).
- Google OAuth Web Client ID configured.

## 2. Clone and configure

```bash
git clone <your-repo-url>
cd family-tree-with-ai-v1
cp .env.example .env
```

Set required values in `.env`:

- `GOOGLE_CLIENT_ID`
- `SESSION_SECRET` (at least 16 chars)
- `ALLOWED_EMAILS` (comma-separated)
- `SUPPORT_CONTACT_EMAIL`

Optional values:

- `FAMILY_DATA_DIR` (default `examples/royal-family-files`)
- `FAMILY_ROOT_PERSON`
- `APP_DOMAIN` (required only for TLS compose overlay)

## 3. Google OAuth settings

In Google Cloud Console for your Web OAuth client:

- Add Authorized JavaScript Origin for local HTTP mode:
  - `http://127.0.0.1:8082`
- Add Authorized JavaScript Origin for production TLS mode:
  - `https://<your-domain>`

## 4. Run mode A: direct app (HTTP, quick test)

```bash
docker compose up -d --build
```

Open:

- `http://<server-ip>:8082`

This mode is suitable for quick testing. Use TLS mode for real family access.

## 5. Run mode B: TLS reverse proxy (recommended for production)

Set domain in `.env`:

```bash
APP_DOMAIN=family.example.com
```

Start app + Caddy:

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
```

Open:

- `https://family.example.com`

Caddy auto-manages certificates once DNS is correctly configured.

## 6. Optional CI image workflow (GHCR)

This repository includes `.github/workflows/docker-image.yml`.
On every push to `main` (or manual run), it builds and publishes:

- `ghcr.io/<owner>/<repo>:latest`
- `ghcr.io/<owner>/<repo>:sha-...`

If you want your VPS to pull prebuilt images (instead of building locally), set in `.env`:

```bash
GHCR_IMAGE=ghcr.io/<owner>/<repo>:latest
```

Then run with the GHCR compose file:

```bash
docker compose -f docker-compose.ghcr.yml -f docker-compose.tls.yml pull
docker compose -f docker-compose.ghcr.yml -f docker-compose.tls.yml up -d
```

## 7. Update workflow on the VPS

When you push new changes:

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
```

If you use GHCR images:

```bash
docker compose -f docker-compose.ghcr.yml -f docker-compose.tls.yml pull
docker compose -f docker-compose.ghcr.yml -f docker-compose.tls.yml up -d
```

## 8. Health checks and logs

```bash
docker compose ps
docker compose logs -f family-tree
docker compose logs -f caddy
```

The app health endpoint is:

- `http://127.0.0.1:8082/health` (inside server/container network)

## 9. Notes

- The secure server gates all static tree files behind authentication.
- On first build, markdown files missing `id` will be updated automatically.
- Ensure the mounted family data folder is writable if IDs still need to be generated.
