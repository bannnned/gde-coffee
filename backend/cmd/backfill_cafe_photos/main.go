package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"backend/internal/config"
	"backend/internal/domains/photos"
	"backend/internal/media"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

type cafePhotoRow struct {
	ID        string
	CafeID    string
	Kind      string
	ObjectKey string
	MimeType  string
	SizeBytes int64
}

func main() {
	var (
		limit  = flag.Int("limit", 0, "Maximum number of cafe photo rows to process (0 = all).")
		kind   = flag.String("kind", "", "Only process one kind: cafe|menu.")
		cafeID = flag.String("cafe-id", "", "Only process a single cafe id.")
		dryRun = flag.Bool("dry-run", false, "Run optimization without DB updates.")
	)
	flag.Parse()

	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "error", err)
		os.Exit(1)
	}
	if !cfg.Media.S3Enabled {
		slog.Error("S3 must be enabled for backfill")
		os.Exit(1)
	}

	dbURL, err := resolveDatabaseURL()
	if err != nil {
		slog.Error("fatal error", "error", err)
		os.Exit(1)
	}
	pool, err := connectDB(dbURL)
	if err != nil {
		slog.Error("db connect failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	s3, err := media.NewS3Service(context.Background(), media.Config{
		Enabled:         cfg.Media.S3Enabled,
		Endpoint:        cfg.Media.S3Endpoint,
		Region:          cfg.Media.S3Region,
		Bucket:          cfg.Media.S3Bucket,
		AccessKeyID:     cfg.Media.S3AccessKeyID,
		SecretAccessKey: cfg.Media.S3SecretAccessKey,
		PublicBaseURL:   cfg.Media.S3PublicBaseURL,
		UsePathStyle:    cfg.Media.S3UsePathStyle,
		PresignTTL:      cfg.Media.S3PresignTTL,
	})
	if err != nil {
		slog.Error("s3 init failed", "error", err)
		os.Exit(1)
	}
	if s3 == nil || !s3.Enabled() {
		slog.Error("s3 service is not enabled")
		os.Exit(1)
	}

	normalizedKind := strings.TrimSpace(strings.ToLower(*kind))
	if normalizedKind != "" {
		if _, err := photos.NormalizePhotoKind(normalizedKind); err != nil {
			slog.Error("invalid kind", "error", err)
			os.Exit(1)
		}
	}

	rows, err := loadCafePhotos(context.Background(), pool, normalizedKind, strings.TrimSpace(*cafeID), *limit)
	if err != nil {
		slog.Error("load cafe photos failed", "error", err)
		os.Exit(1)
	}
	if len(rows) == 0 {
		slog.Info("nothing to process")
		return
	}
	slog.Info("loaded cafe photos", "count", len(rows))

	type stats struct {
		processed          int
		updated            int
		unchanged          int
		failed             int
		totalVariants      int
		totalSavedBytes    int64
		totalOriginalBytes int64
	}
	s := stats{}

	for idx, row := range rows {
		s.processed++
		s.totalOriginalBytes += row.SizeBytes

		ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
		var meta photos.OptimizedCafePhotoMeta
		if *dryRun {
			meta, err = photos.PreviewCafePhotoOptimization(
				ctx,
				s3,
				cfg.Media,
				row.CafeID,
				row.Kind,
				row.ObjectKey,
				row.MimeType,
				row.SizeBytes,
			)
		} else {
			meta, err = photos.OptimizeAndPersistCafePhoto(
				ctx,
				s3,
				cfg.Media,
				row.CafeID,
				row.Kind,
				row.ObjectKey,
				row.MimeType,
				row.SizeBytes,
			)
		}
		cancel()
		if err != nil {
			s.failed++
			slog.Warn("row optimization failed", "row_id", row.ID, "error", err)
			continue
		}

		s.totalVariants += meta.GeneratedVariants
		s.totalSavedBytes += maxInt64(row.SizeBytes-meta.SizeBytes, 0)

		changed := strings.TrimSpace(meta.ObjectKey) != strings.TrimSpace(row.ObjectKey) ||
			photos.NormalizeContentType(meta.MimeType) != photos.NormalizeContentType(row.MimeType) ||
			meta.SizeBytes != row.SizeBytes

		if *dryRun {
			if changed {
				slog.Info("dry-run change detected",
					"row_id", row.ID,
					"old_key", row.ObjectKey,
					"new_key", meta.ObjectKey,
					"old_size", row.SizeBytes,
					"new_size", meta.SizeBytes,
					"variants", meta.GeneratedVariants,
				)
			}
			continue
		}

		if !changed {
			s.unchanged++
			if (idx+1)%50 == 0 {
				slog.Info("backfill progress", "current", idx+1, "total", len(rows), "unchanged", s.unchanged, "updated", s.updated, "failed", s.failed)
			}
			continue
		}

		updateCtx, updateCancel := context.WithTimeout(context.Background(), 8*time.Second)
		_, err = pool.Exec(
			updateCtx,
			`update cafe_photos
			    set object_key = $2, mime_type = $3, size_bytes = $4
			  where id = $1::uuid`,
			row.ID,
			meta.ObjectKey,
			photos.NormalizeContentType(meta.MimeType),
			meta.SizeBytes,
		)
		updateCancel()
		if err != nil {
			s.failed++
			slog.Warn("row update failed", "row_id", row.ID, "error", err)
			if meta.ObjectKey != row.ObjectKey {
				cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
				_ = s3.DeleteObject(cleanupCtx, meta.ObjectKey)
				cleanupCancel()
			}
			continue
		}

		s.updated++
		if (idx+1)%25 == 0 || idx == len(rows)-1 {
			slog.Info("backfill progress", "current", idx+1, "total", len(rows), "unchanged", s.unchanged, "updated", s.updated, "failed", s.failed)
		}
	}

	slog.Info("backfill complete",
		"processed", s.processed,
		"updated", s.updated,
		"unchanged", s.unchanged,
		"failed", s.failed,
		"variants", s.totalVariants,
		"bytes_saved", s.totalSavedBytes,
		"mb_saved", fmt.Sprintf("%.2f", float64(s.totalSavedBytes)/(1024*1024)),
	)
}

func loadCafePhotos(
	ctx context.Context,
	pool *pgxpool.Pool,
	kind string,
	cafeID string,
	limit int,
) ([]cafePhotoRow, error) {
	clauses := make([]string, 0, 2)
	args := make([]any, 0, 3)

	if strings.TrimSpace(kind) != "" {
		args = append(args, kind)
		clauses = append(clauses, fmt.Sprintf("kind = $%d", len(args)))
	}
	if strings.TrimSpace(cafeID) != "" {
		args = append(args, cafeID)
		clauses = append(clauses, fmt.Sprintf("cafe_id = $%d::uuid", len(args)))
	}

	query := `select id::text, cafe_id::text, kind, object_key, mime_type, size_bytes
	            from cafe_photos`
	if len(clauses) > 0 {
		query += " where " + strings.Join(clauses, " and ")
	}
	query += " order by created_at asc, id asc"
	if limit > 0 {
		args = append(args, limit)
		query += fmt.Sprintf(" limit $%d", len(args))
	}

	queryCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	rows, err := pool.Query(queryCtx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]cafePhotoRow, 0, 256)
	for rows.Next() {
		var row cafePhotoRow
		if err := rows.Scan(
			&row.ID,
			&row.CafeID,
			&row.Kind,
			&row.ObjectKey,
			&row.MimeType,
			&row.SizeBytes,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func resolveDatabaseURL() (string, error) {
	for _, key := range []string{"DATABASE_URL", "DATABASE_URL_2", "DATABASE_URL_3"} {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value, nil
		}
	}
	return "", fmt.Errorf("DATABASE_URL or DATABASE_URL_2 or DATABASE_URL_3 is required")
}

func connectDB(dbURL string) (*pgxpool.Pool, error) {
	cfgPool, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, err
	}
	cfgPool.MinConns = 1
	cfgPool.MaxConns = 5
	cfgPool.ConnConfig.ConnectTimeout = 15 * time.Second

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	return pgxpool.NewWithConfig(ctx, cfgPool)
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
