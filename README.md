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
- `POST /api/auth/email/verify/request` — send email verification (requires auth)
- `GET /api/auth/email/verify/confirm` — confirm verification by token
- `POST /api/auth/password/reset/request` — request password reset
- `POST /api/auth/password/reset/confirm` — confirm password reset
- `GET /api/auth/github/start` — login via GitHub (OAuth)
- `GET /api/auth/github/callback` — GitHub OAuth callback
- `GET /api/auth/github/link/start` — link GitHub to current user (requires auth)
- `GET /api/auth/github/link/callback` — GitHub link callback
- `GET /api/auth/yandex/start` — login via Yandex (OAuth)
- `GET /api/auth/yandex/callback` — Yandex OAuth callback
- `GET /api/auth/yandex/link/start` — link Yandex to current user (requires auth)
- `GET /api/auth/yandex/link/callback` — Yandex link callback
### Account
- `POST /api/account/email/change/request` — request email change (requires auth)
- `GET /api/account/email/change/confirm` — confirm email change by token

See `backend/docs/auth.md`, `backend/docs/auth-identities.md`, and `backend/docs/account-security.md` for curl examples and details.

## Environment
Common env vars (backend):
- `PORT` (defaults to `8080` in main)
- `DATABASE_URL` (or `DATABASE_URL_2`, `DATABASE_URL_3` fallback)
- `PUBLIC_DIR` (default `/app/public`)
- `COOKIE_SECURE` (true/false; default true in prod)
- `SESSION_SLIDING_HOURS` (default `12`)
- `LOGIN_RATE_LIMIT` (default `10`)
- `LOGIN_RATE_WINDOW` (default `5m`)
- `PUBLIC_BASE_URL` (default `https://gde-kofe.ru`)
- `TOKEN_TTL_MINUTES_VERIFY` (default `60`)
- `TOKEN_TTL_MINUTES_EMAIL_CHANGE` (default `60`)
- `TOKEN_TTL_MINUTES_PASSWORD_RESET` (default `30`)
- `SMTP_HOST` (default `smtp.timeweb.ru`)
- `SMTP_PORT` (default `465`)
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `MAIL_REPLY_TO` (optional)
- `SMTP_TIMEOUT` (default `10s`)
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_OAUTH_SCOPE` (default `read:user user:email`)
- `YANDEX_CLIENT_ID`
- `YANDEX_CLIENT_SECRET`
- `YANDEX_OAUTH_SCOPE` (default `login:email login:info`)
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
- `000004_account_security` (email verify/change/reset tokens)
- `000005_postgis` (geography column + GiST index)
- `000006_oauth_states` (OAuth state storage)
- `000007_oauth_state_redirect` (stores redirect_uri for OAuth state)

## Notes
- Sessions are stored server-side in Postgres with HttpOnly cookies.
- `/api/cafes` uses PostGIS `geography` (requires `postgis` extension).
- Auth is local only for now; identities table prepares for OAuth providers.

### PostGIS quick check
```sql
EXPLAIN ANALYZE
WITH params AS (SELECT ST_SetSRID(ST_MakePoint(30.3, 59.9), 4326)::geography AS p)
SELECT id
FROM public.cafes, params
WHERE geog IS NOT NULL AND ST_DWithin(geog, params.p, 1000)
ORDER BY ST_Distance(geog, params.p)
LIMIT 10;
```
