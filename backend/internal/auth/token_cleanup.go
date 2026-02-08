package auth

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func StartTokenCleanup(pool *pgxpool.Pool, interval time.Duration) {
	if interval <= 0 {
		return
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			if _, err := pool.Exec(ctx, `delete from email_verifications where consumed_at is not null or expires_at < now()`); err != nil {
				log.Printf("token cleanup failed (email_verifications): %v", err)
			}
			if _, err := pool.Exec(ctx, `delete from email_change_requests where consumed_at is not null or expires_at < now()`); err != nil {
				log.Printf("token cleanup failed (email_change_requests): %v", err)
			}
			if _, err := pool.Exec(ctx, `delete from password_reset_tokens where consumed_at is not null or expires_at < now()`); err != nil {
				log.Printf("token cleanup failed (password_reset_tokens): %v", err)
			}
			if _, err := pool.Exec(ctx, `delete from oauth_states where consumed_at is not null or expires_at < now()`); err != nil {
				log.Printf("token cleanup failed (oauth_states): %v", err)
			}
			cancel()
		}
	}()
}
