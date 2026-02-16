package reviews

import (
	"context"
	"log"
	"time"
)

const sqlSelectAllCafeIDsForRatingRebuild = `select id::text
from cafes
order by id asc`

func (s *Service) StartRatingRebuildWorker(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 15 * time.Minute
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	log.Printf("reviews rating rebuild worker started: interval=%s", interval)
	defer log.Printf("reviews rating rebuild worker stopped")

	rebuild := func() {
		// Full rebuild keeps snapshots healthy even if some events were delayed.
		runCtx, cancel := context.WithTimeout(ctx, 20*time.Minute)
		defer cancel()
		processed, failed, err := s.rebuildAllCafeRatingSnapshots(runCtx)
		if err != nil {
			log.Printf("reviews rating rebuild failed: processed=%d failed=%d err=%v", processed, failed, err)
			return
		}
		if failed > 0 {
			log.Printf("reviews rating rebuild completed with errors: processed=%d failed=%d", processed, failed)
			return
		}
		log.Printf("reviews rating rebuild completed: processed=%d", processed)
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

func (s *Service) rebuildAllCafeRatingSnapshots(ctx context.Context) (int, int, error) {
	rows, err := s.repository.Pool().Query(ctx, sqlSelectAllCafeIDsForRatingRebuild)
	if err != nil {
		return 0, 0, err
	}
	defer rows.Close()

	processed := 0
	failed := 0
	for rows.Next() {
		var cafeID string
		if err := rows.Scan(&cafeID); err != nil {
			return processed, failed, err
		}
		processed++

		cafeCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
		err := s.recalculateCafeRatingSnapshot(cafeCtx, cafeID)
		cancel()
		if err != nil {
			failed++
			log.Printf("reviews rating rebuild: cafe_id=%s err=%v", cafeID, err)
		}
	}
	if err := rows.Err(); err != nil {
		return processed, failed, err
	}
	return processed, failed, nil
}
