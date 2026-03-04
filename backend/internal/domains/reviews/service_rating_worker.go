package reviews

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
)

const sqlSelectAllCafeIDsForRatingRebuild = `select id::text
from cafes
order by id asc`

const (
	defaultRatingRebuildBatchSize             = 25
	defaultRatingRebuildLeaderLockKey         = 740051
	sqlSelectCafeIDsForRatingRebuildFromStart = `select id::text
from cafes
order by id asc
limit $1`
	sqlSelectCafeIDsForRatingRebuildAfterCursor = `select id::text
from cafes
where id > $1::uuid
order by id asc
limit $2`
)

func (s *Service) StartRatingRebuildWorker(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 15 * time.Minute
	}
	batchSize := parseIntWithFallback("REVIEWS_RATING_REBUILD_BATCH_SIZE", defaultRatingRebuildBatchSize)
	if batchSize <= 0 {
		batchSize = defaultRatingRebuildBatchSize
	}
	lockKey := int64(parseIntWithFallback("REVIEWS_RATING_REBUILD_LOCK_KEY", defaultRatingRebuildLeaderLockKey))
	if lockKey == 0 {
		lockKey = defaultRatingRebuildLeaderLockKey
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	logger := slog.Default().With("worker_name", "reviews_rating_rebuild")

	logger.Info("worker started", "interval", interval, "batch", batchSize, "lock_key", lockKey)
	defer logger.Info("worker stopped")

	cursor := ""
	rebuild := func() {
		// Batch rebuild keeps snapshots healthy without creating periodic load spikes.
		runCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
		defer cancel()
		locked, err := s.withRatingRebuildLeaderLock(runCtx, lockKey, func() error {
			processed, failed, nextCursor, wrapped, rebuildErr := s.rebuildCafeRatingSnapshotsBatch(runCtx, batchSize, cursor)
			if rebuildErr != nil {
				logger.Error("rebuild failed",
					"processed", processed,
					"failed", failed,
					"cursor", cursor,
					"error", rebuildErr,
				)
				return rebuildErr
			}
			cursor = nextCursor
			if failed > 0 {
				logger.Warn("rebuild completed with errors",
					"processed", processed,
					"failed", failed,
					"cursor", cursor,
					"wrapped", wrapped,
				)
				return nil
			}
			logger.Info("rebuild completed",
				"processed", processed,
				"cursor", cursor,
				"wrapped", wrapped,
			)
			return nil
		})
		if err != nil {
			logger.Error("rebuild lock failed", "lock_key", lockKey, "error", err)
			return
		}
		if !locked {
			logger.Info("rebuild skipped, another instance holds lock", "lock_key", lockKey)
		}
	}

	rebuild()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			rebuild()
		}
	}
}

func (s *Service) withRatingRebuildLeaderLock(
	ctx context.Context,
	lockKey int64,
	run func() error,
) (bool, error) {
	conn, err := s.repository.Pool().Acquire(ctx)
	if err != nil {
		return false, err
	}
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	var locked bool
	if err := tx.QueryRow(ctx, `select pg_try_advisory_xact_lock($1::bigint)`, lockKey).Scan(&locked); err != nil {
		return false, err
	}
	if !locked {
		return false, nil
	}

	if err := run(); err != nil {
		return true, err
	}
	if err := tx.Commit(ctx); err != nil {
		return true, err
	}
	return true, nil
}

func (s *Service) fetchCafeIDsForRatingRebuildBatch(
	ctx context.Context,
	cursor string,
	limit int,
) ([]string, error) {
	if limit <= 0 {
		limit = defaultRatingRebuildBatchSize
	}

	var (
		rows pgx.Rows
		err  error
	)
	if cursor == "" {
		rows, err = s.repository.Pool().Query(ctx, sqlSelectCafeIDsForRatingRebuildFromStart, limit)
	} else {
		rows, err = s.repository.Pool().Query(ctx, sqlSelectCafeIDsForRatingRebuildAfterCursor, cursor, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]string, 0, limit)
	for rows.Next() {
		var cafeID string
		if err := rows.Scan(&cafeID); err != nil {
			return nil, err
		}
		ids = append(ids, cafeID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ids, nil
}

func (s *Service) rebuildCafeRatingSnapshotsBatch(
	ctx context.Context,
	limit int,
	cursor string,
) (processed int, failed int, nextCursor string, wrapped bool, err error) {
	if limit <= 0 {
		limit = defaultRatingRebuildBatchSize
	}

	ids, err := s.fetchCafeIDsForRatingRebuildBatch(ctx, cursor, limit)
	if err != nil {
		return 0, 0, cursor, false, err
	}

	usedCursor := cursor != ""
	if len(ids) == 0 && usedCursor {
		ids, err = s.fetchCafeIDsForRatingRebuildBatch(ctx, "", limit)
		if err != nil {
			return 0, 0, cursor, true, err
		}
		usedCursor = false
		wrapped = true
	}

	processed = 0
	failed = 0
	nextCursor = cursor
	for _, cafeID := range ids {
		processed++
		cafeCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
		rebuildErr := s.recalculateCafeRatingSnapshot(cafeCtx, cafeID)
		cancel()
		if rebuildErr != nil {
			failed++
			slog.Warn("rating rebuild cafe failed", "worker_name", "reviews_rating_rebuild", "cafe_id", cafeID, "error", rebuildErr)
		}
		nextCursor = cafeID
	}

	if processed == 0 {
		nextCursor = ""
		return processed, failed, nextCursor, wrapped, nil
	}

	if usedCursor && processed < limit {
		nextCursor = ""
	}

	return processed, failed, nextCursor, wrapped, nil
}
