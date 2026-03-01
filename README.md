# Coffee Quest

Backend + frontend for a coffee discovery app.

## Stack
- Backend: Go (Gin), Postgres (pgxpool)
- Frontend: React (see `frontend/`)
- API base: `/api`

## Frontend palette system
All app colors are centralized in:
- `frontend/src/theme/palettes.ts` — palette tokens and runtime apply logic
- `frontend/src/index.css` — CSS variable aliases used by components

Palette categories:
- `brand` — CTA/active accents (`--color-brand-*`, `--color-on-accent`)
- `background` — page backgrounds (`--color-bg-*`)
- `surface` — cards/modals/overlays (`--color-surface-*`, `--color-glass-*`)
- `text` — primary/muted/inverse text (`--color-text-*`)
- `border` — borders/dividers (`--color-border-*`)
- `effect` — shadows/attention glow (`--color-shadow-lg`, `--color-attention-*`)
- `status` — semantic states (`--color-status-success|warning|error|info`)
- `map` — map marker/label colors (`--color-map-*`)

Available palettes:
- `coffee`
- `matcha`
- `terracotta`

Core palette colors (light/dark):
- `coffee`: accent `#457E73` / `#5aa294`, bg `#EADCC8` / `#1A1A1A`, text `#1A1A1A` / `#FFFFF0`
- `matcha`: accent `#3f7a4a` / `#68b477`, bg `#e7efd9` / `#141a14`, text `#1d2b1f` / `#f6fff3`
- `terracotta`: accent `#b85c38` / `#d08260`, bg `#f0d8c8` / `#1c1513`, text `#251814` / `#fff7f1`

Runtime palette control:
- Stored key: `coffeeQuest.palette`
- JS helper: `window.gdeCoffeePalette.get() | list() | set(name)`

Map style by color scheme:
- default light style: `/map-styles/light.json` (`frontend/public/map-styles/light.json`)
- default dark style: `/map-styles/dark.json` (`frontend/public/map-styles/dark.json`)
- `VITE_MAP_STYLE_URL_LIGHT` — optional override for light map style URL (`style.json`)
- `VITE_MAP_STYLE_URL_DARK` — optional override for dark map style URL (`style.json`)
- `VITE_MAP_STYLE_URL` — legacy override for both schemes (kept for backward compatibility)
- `VITE_MAP_CITY_LABEL_FONT_STACK` — optional comma-separated font stack for city/place labels
  (example: `Unbounded Regular,Noto Sans Regular,Open Sans Regular`; fonts must exist on the style `glyphs` endpoint)

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
  - Returns `cover_photo_url` only (full photos list is loaded via `GET /api/cafes/:id/photos`)
- `POST /api/cafes/:id/photos/presign` — get S3 presigned upload URL (requires auth)
  - body: `{ "content_type": "image/jpeg|image/png|image/webp|image/avif", "size_bytes": 123456 }`
- `POST /api/cafes/:id/photos/confirm` — confirm uploaded photo and bind it to cafe (requires auth)
  - body: `{ "object_key": "cafes/<cafe_id>/...", "is_cover"?: true, "position"?: 1 }`
- `GET /api/cafes/:id/photos` — list cafe photos
- `PATCH /api/cafes/:id/photos/order` — save photos order (requires auth)
  - body: `{ "photo_ids": ["<id1>", "<id2>", "..."] }`
- `PATCH /api/cafes/:id/photos/:photoID/cover` — set cover photo (requires auth)
- `DELETE /api/cafes/:id/photos/:photoID` — delete photo (requires auth)
- `GET /api/cafes/:id/rating` — get smart rating snapshot (`rating_v1`, counts, fraud risk, components)

### Reviews & trust
- `POST /api/reviews` — create/update own structured review for a cafe (requires auth + `Idempotency-Key`)
  - body: `{ "cafe_id": "...", "rating": 1..5, "drink_name": "...", "taste_tags": ["..."], "summary": "...", "photo_count": 0 }`
  - emits `review.created` or `review.updated`
- `POST /api/reviews/:id/helpful` — mark review as helpful (requires auth + `Idempotency-Key`)
  - emits `vote.helpful_added`
- `POST /api/reviews/:id/visit/verify` — attach visit verification confidence to own review (requires auth + `Idempotency-Key`)
  - body: `{ "confidence": "none|low|medium|high", "dwell_seconds": 0 }`
  - emits `visit.verified` for non-`none`
- `POST /api/reviews/:id/abuse` — report review abuse (requires auth)
  - body: `{ "reason": "...", "details": "..." }`
- `POST /api/abuse-reports/:id/confirm` — confirm abuse report (requires moderator/admin)
  - emits `abuse.confirmed`

Critical actions (`review publish`, `helpful vote`, `visit verify`) are idempotent via `Idempotency-Key`.

### Product metrics (North Star)
- `POST /api/metrics/events` — ingest client telemetry events (optional auth)
  - supported `event_type`: `review_read`, `route_click`, `checkin_start`
  - payload: `{ "events": [{ "event_type": "...", "journey_id": "...", "cafe_id": "...", "anon_id": "...", "client_event_id": "...", "review_id"?: "...", "provider"?: "2gis|yandex", "occurred_at"?: "RFC3339", "meta"?: {} }] }`
- `GET /api/admin/metrics/north-star?days=14&cafe_id=<uuid>` — North Star summary + daily series (admin/moderator), optionally scoped to one cafe
- `GET /api/admin/cafes/search?q=<name>&limit=15` — server-side cafe search by name for admin filters
- Details: `docs/north_star_metrics.md`

### Auth (cookie sessions)
- `POST /api/auth/register` — create local user + session
  - body: `{ "email": "...", "password": "...", "display_name"?: "..." }`
- `POST /api/auth/login` — login and set session cookie
  - body: `{ "email": "...", "password": "..." }`
- `POST /api/auth/logout` — revoke session and clear cookie
- `POST /api/auth/sessions/revoke_all` — revoke all sessions (requires auth)
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
- `POST /api/auth/telegram/start` — get Telegram login state
- `POST /api/auth/telegram/callback` — Telegram login callback
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
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `S3_ENABLED` (`true/false`, auto-enabled if `S3_BUCKET` is set)
- `S3_ENDPOINT` (e.g. `s3.twcstorage.ru`)
- `S3_REGION` (e.g. `ru-1`)
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL` (e.g. `https://img.gde-kofe.ru`)
- `S3_USE_PATH_STYLE` (`true/false`, default `true`)
- `S3_PRESIGN_TTL` (default `15m`)
- `S3_MAX_UPLOAD_BYTES` (default `8388608`)
CORS:
- `CORS_ALLOW_ORIGINS`
- `CORS_ALLOW_METHODS`
- `CORS_ALLOW_HEADERS`
- `CORS_ALLOW_CREDENTIALS`
- `CORS_MAX_AGE`

## Migrations
SQL migrations live in `backend/migrations/`.
They are applied automatically on backend startup (table `schema_migrations`).

Current:
- `000001_init` (cafes)
- `000002_auth` (users, local_credentials, sessions)
- `000003_identities` (OAuth-ready identities)
- `000004_account_security` (email verify/change/reset tokens)
- `000005_postgis` (geography column + GiST index)
- `000006_oauth_states` (OAuth state storage)
- `000007_oauth_state_redirect` (stores redirect_uri for OAuth state)
- `000008_users_email_nullable` (allow oauth users without email)
- `000009_session_version` (session invalidation versioning)
- `000010_cafe_photos` (cafe images metadata for S3 object keys)
- `000015_reviews_stage1` (reviews/reputation/rating snapshots + idempotency keys + domain events queue)
- `000026_product_metrics_events` (North Star telemetry events)

## Server lifecycle
The backend supports graceful shutdown via `SIGINT`/`SIGTERM`.

Shutdown sequence:
1. HTTP server stops accepting new connections, in-flight requests drain (15 s timeout).
2. Background workers receive context cancellation and finish current iteration.
3. `sync.WaitGroup` waits for all goroutines to exit.
4. DB connection pool is closed.

Background workers tracked by the WaitGroup:
- Session cleanup (every 6 h)
- Token cleanup (every 24 h)
- Reviews outbox dispatcher (every 2 s)
- Reviews inbox/reputation processor (every 2 s)
- Review photo cleanup (every 15 min)
- Cafe rating rebuild (every 15 min)
- Mailer stats logger (every 1 h)

All workers accept a shared `context.Context`; cancelling it causes each worker to log its stop message and return.

## Notes
- Sessions are stored server-side in Postgres with HttpOnly cookies.
- `/api/cafes` uses PostGIS `geography` (requires `postgis` extension).
- OAuth providers supported: GitHub, Yandex, Telegram (login/link).

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
