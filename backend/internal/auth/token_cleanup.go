package auth

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func StartTokenCleanup(ctx context.Context, pool *pgxpool.Pool, interval time.Duration) {
	if interval <= 0 {
		return
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("token cleanup worker stopped")
			return
		case <-ticker.C:
			qctx, cancel := context.WithTimeout(ctx, 20*time.Second)
			if _, err := pool.Exec(qctx, `delete from email_verifications where consumed_at is not null or expires_at < now()`); err != nil && ctx.Err() == nil {
				log.Printf("token cleanup failed (email_verifications): %v", err)
			}
			if _, err := pool.Exec(qctx, `delete from email_change_requests where consumed_at is not null or expires_at < now()`); err != nil && ctx.Err() == nil {
				log.Printf("token cleanup failed (email_change_requests): %v", err)
			}
			if _, err := pool.Exec(qctx, `delete from password_reset_tokens where consumed_at is not null or expires_at < now()`); err != nil && ctx.Err() == nil {
				log.Printf("token cleanup failed (password_reset_tokens): %v", err)
			}
			if _, err := pool.Exec(qctx, `delete from oauth_states where consumed_at is not null or expires_at < now()`); err != nil && ctx.Err() == nil {
				log.Printf("token cleanup failed (oauth_states): %v", err)
			}
			cancel()
		}
	}
}
