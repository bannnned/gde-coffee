package auth

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func StartSessionCleanup(ctx context.Context, pool *pgxpool.Pool, interval time.Duration) {
	if interval <= 0 {
		return
	}

	logger := slog.Default().With("worker_name", "session_cleanup")
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			logger.Info("worker stopped")
			return
		case <-ticker.C:
			qctx, cancel := context.WithTimeout(ctx, 10*time.Second)
			_, err := pool.Exec(qctx, `delete from sessions where revoked_at is not null or expires_at < now()`)
			cancel()
			if err != nil && ctx.Err() == nil {
				logger.Error("cleanup failed", "error", err)
			}
		}
	}
}
