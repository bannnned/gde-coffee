# Cafe Photo Backfill

Backfill rewrites existing `cafe_photos` objects through the same optimizer pipeline as new uploads:
- resize/recompress heavy originals
- normalize storage path to `cafes/<cafe_id>/<kind>/optimized/...`
- generate responsive variants (`_w640`, `_w1024`, `_w1536`)
- optionally generate format variants via external encoder (`webp`, `avif`)

## Run

```bash
cd backend
go run ./cmd/backfill_cafe_photos --dry-run
go run ./cmd/backfill_cafe_photos --limit 500
go run ./cmd/backfill_cafe_photos --kind cafe
go run ./cmd/backfill_cafe_photos --cafe-id <uuid>
```

Flags:
- `--dry-run` only logs planned changes, does not write to S3 and does not update DB row metadata.
- `--limit` max number of rows in one run (`0` means all rows).
- `--kind` filter by `cafe` or `menu`.
- `--cafe-id` process one cafe only.

Required env:
- `DATABASE_URL` (or `DATABASE_URL_2`, `DATABASE_URL_3`)
- all S3 env vars used by backend (`S3_*`)
- optional encoder env: `PHOTO_FORMAT_ENCODER_*`
