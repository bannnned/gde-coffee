package reviews

import (
	"context"
	"log"
	"strings"
	"time"
)

const (
	reviewPhotoCleanupBatchSize      = 100
	reviewPhotoCleanupReadyRetention = "3 days"
	reviewPhotoCleanupStaleRetention = "12 hours"

	sqlSelectReviewPhotoUploadsForCleanup = `select
	id::text,
	coalesce(temp_object_key, ''),
	status
from review_photo_uploads
where (
	(status in ('ready', 'failed') and updated_at < now() - interval '3 days')
	or (status in ('pending', 'processing') and updated_at < now() - interval '12 hours')
)
order by updated_at asc
limit $1`

	sqlDeleteReviewPhotoUploadByID = `delete from review_photo_uploads where id = $1::uuid`
)

func (s *Service) StartPhotoCleanupWorker(ctx context.Context, pollInterval time.Duration) {
	if pollInterval <= 0 {
		pollInterval = 15 * time.Minute
	}

	log.Printf("reviews photo cleanup worker started: interval=%s", pollInterval)
	for {
		select {
		case <-ctx.Done():
			log.Printf("reviews photo cleanup worker stopped")
			return
		default:
		}

		cleanupCtx, cancel := context.WithTimeout(ctx, 40*time.Second)
		removed, err := s.cleanupReviewPhotoUploadsBatch(cleanupCtx, reviewPhotoCleanupBatchSize)
		cancel()
		if err != nil {
			log.Printf("reviews photo cleanup error: %v", err)
			time.Sleep(pollInterval)
			continue
		}
		// If a full batch was removed, process next chunk immediately.
		if removed >= reviewPhotoCleanupBatchSize {
			continue
		}
		time.Sleep(pollInterval)
	}
}

func (s *Service) cleanupReviewPhotoUploadsBatch(ctx context.Context, limit int) (int, error) {
	if limit <= 0 {
		limit = reviewPhotoCleanupBatchSize
	}

	rows, err := s.repository.Pool().Query(ctx, sqlSelectReviewPhotoUploadsForCleanup, limit)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type cleanupItem struct {
		ID            string
		TempObjectKey string
		Status        string
	}
	items := make([]cleanupItem, 0, limit)
	for rows.Next() {
		var item cleanupItem
		if err := rows.Scan(&item.ID, &item.TempObjectKey, &item.Status); err != nil {
			return 0, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	removed := 0
	for _, item := range items {
		tempKey := strings.TrimSpace(item.TempObjectKey)
		if tempKey != "" && s.mediaService != nil && s.mediaService.Enabled() {
			if err := s.mediaService.DeleteObject(ctx, tempKey); err != nil {
				// Keep row for retry if object delete failed (network/permissions).
				continue
			}
		}
		if _, err := s.repository.Pool().Exec(ctx, sqlDeleteReviewPhotoUploadByID, item.ID); err != nil {
			return removed, err
		}
		removed++
	}
	return removed, nil
}
