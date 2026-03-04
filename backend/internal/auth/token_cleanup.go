package auth

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func StartTokenCleanup(ctx context.Context, pool *pgxpool.Pool, interval time.Duration) {
	if interval <= 0 {
		return
	}

	logger := slog.Default().With("worker_name", "token_cleanup")
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			logger.Info("worker stopped")
			return
		case <-ticker.C:
			qctx, cancel := context.WithTimeout(ctx, 20*time.Second)
			if _, err := pool.Exec(qctx, `delete from email_verifications where consumed_at is not null or expires_at < now()`); err != nil && ctx.Err() == nil {
				logger.Error("cleanup failed", "table", "email_verifications", "error", err)
			}
			if _, err := pool.Exec(qctx, `delete from email_change_requests where consumed_at is not null or expires_at < now()`); err != nil && ctx.Err() == nil {
				logger.Error("cleanup failed", "table", "email_change_requests", "error", err)
			}
			if _, err := pool.Exec(qctx, `delete from password_reset_tokens where consumed_at is not null or expires_at < now()`); err != nil && ctx.Err() == nil {
				logger.Error("cleanup failed", "table", "password_reset_tokens", "error", err)
			}
			if _, err := pool.Exec(qctx, `delete from oauth_states where consumed_at is not null or expires_at < now()`); err != nil && ctx.Err() == nil {
				logger.Error("cleanup failed", "table", "oauth_states", "error", err)
			}
			cancel()
		}
	}
}
