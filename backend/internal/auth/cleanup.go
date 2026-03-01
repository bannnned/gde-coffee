package auth

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func StartSessionCleanup(ctx context.Context, pool *pgxpool.Pool, interval time.Duration) {
	if interval <= 0 {
		return
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("session cleanup worker stopped")
			return
		case <-ticker.C:
			qctx, cancel := context.WithTimeout(ctx, 10*time.Second)
			_, err := pool.Exec(qctx, `delete from sessions where revoked_at is not null or expires_at < now()`)
			cancel()
			if err != nil && ctx.Err() == nil {
				log.Printf("session cleanup failed: %v", err)
			}
		}
	}
}
