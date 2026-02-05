# Coffee Quest

Backend + frontend for a coffee discovery app.

## Stack
- Backend: Go (Gin), Postgres (pgxpool)
- Frontend: React (see `frontend/`)
- API base: `/api`

## Backend overview
The backend serves:
- API endpoints under `/api`
- Frontend static files via `serveStaticOrIndex` (SPA fallback)

### Health
- `GET /_health` — light liveness check (always 200)
- `GET /_health/deep` — DB connectivity check
- `GET /api/health` — API health JSON

### Cafes
- `GET /api/cafes` — search cafes near a point
  - Required query params: `lat`, `lng`, `radius_m`
  - Optional: `sort` (`distance` or `work`), `limit`, `amenities` (comma-separated)
  - Constraints: `lat` in `[-90,90]`, `lng` in `[-180,180]`, `radius_m <= 50000`

### Auth (cookie sessions)
- `POST /api/auth/register` — create local user + session
  - body: `{ "email": "...", "password": "...", "display_name"?: "..." }`
- `POST /api/auth/login` — login and set session cookie
  - body: `{ "email": "...", "password": "..." }`
- `POST /api/auth/logout` — revoke session and clear cookie
- `GET /api/auth/me` — current user by session
- `GET /api/auth/identities` — linked providers (requires auth)

See `backend/docs/auth.md` and `backend/docs/auth-identities.md` for curl examples and identities details.

## Environment
Common env vars (backend):
- `PORT` (defaults to `8080` in main)
- `DATABASE_URL` (or `DATABASE_URL_2`, `DATABASE_URL_3` fallback)
- `PUBLIC_DIR` (default `/app/public`)
- `COOKIE_SECURE` (true/false; default true in prod)
- `SESSION_SLIDING_HOURS` (default `12`)
- `LOGIN_RATE_LIMIT` (default `10`)
- `LOGIN_RATE_WINDOW` (default `5m`)

CORS:
- `CORS_ALLOW_ORIGINS`
- `CORS_ALLOW_METHODS`
- `CORS_ALLOW_HEADERS`
- `CORS_ALLOW_CREDENTIALS`
- `CORS_MAX_AGE`

## Migrations
SQL migrations live in `backend/migrations/`.

Current:
- `000001_init` (cafes)
- `000002_auth` (users, local_credentials, sessions)
- `000003_identities` (OAuth-ready identities)

## Notes
- Sessions are stored server-side in Postgres with HttpOnly cookies.
- `/api/cafes` uses SQL haversine (no PostGIS required).
- Auth is local only for now; identities table prepares for OAuth providers.
