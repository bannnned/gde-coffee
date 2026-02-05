package auth

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func StartSessionCleanup(pool *pgxpool.Pool, interval time.Duration) {
	if interval <= 0 {
		return
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			_, err := pool.Exec(ctx, `delete from sessions where revoked_at is not null or expires_at < now()`)
			cancel()
			if err != nil {
				log.Printf("session cleanup failed: %v", err)
			}
		}
	}()
}
