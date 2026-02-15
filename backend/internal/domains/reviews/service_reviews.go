package reviews

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	sqlCheckCafeExists = `select exists(select 1 from cafes where id = $1::uuid)`

	sqlSelectReviewForUpdateByUserCafe = `select id::text
   from reviews
  where user_id = $1::uuid and cafe_id = $2::uuid
  for update`

	sqlInsertReview = `insert into reviews (user_id, cafe_id, rating, summary, status)
 values ($1::uuid, $2::uuid, $3, $4, 'published')
 returning id::text, updated_at`

	sqlInsertReviewAttributes = `insert into review_attributes (review_id, drink_name, taste_tags, summary_length, photo_count)
 values ($1::uuid, $2, $3::text[], $4, $5)`

	sqlUpdateReview = `update reviews
    set rating = $2,
        summary = $3,
        status = 'published',
        updated_at = now()
  where id = $1::uuid
  returning updated_at`

	sqlUpsertReviewAttributes = `insert into review_attributes (review_id, drink_name, taste_tags, summary_length, photo_count)
 values ($1::uuid, $2, $3::text[], $4, $5)
 on conflict (review_id)
 do update set drink_name = excluded.drink_name,
               taste_tags = excluded.taste_tags,
               summary_length = excluded.summary_length,
               photo_count = excluded.photo_count,
               updated_at = now()`
)

func (s *Service) PublishReview(
	ctx context.Context,
	userID string,
	idempotencyKey string,
	req PublishReviewRequest,
) (idempotentResult, error) {
	request := sanitizePublishReviewRequest(req)
	hash := requestHash(struct {
		UserID string               `json:"user_id"`
		Req    PublishReviewRequest `json:"req"`
	}{UserID: userID, Req: request})
	scope := IdempotencyScopeReviewPublish + ":" + userID

	return s.repository.RunIdempotent(ctx, scope, idempotencyKey, hash, func(tx pgx.Tx) (int, map[string]interface{}, error) {
		var cafeExists bool
		if err := tx.QueryRow(ctx, sqlCheckCafeExists, request.CafeID).Scan(&cafeExists); err != nil {
			return 0, nil, err
		}
		if !cafeExists {
			return 0, nil, ErrNotFound
		}

		var (
			reviewID   string
			updatedAt  time.Time
			eventType  string
			isCreated  bool
			summaryLen = utfRuneLen(request.Summary)
		)

		err := tx.QueryRow(
			ctx,
			sqlSelectReviewForUpdateByUserCafe,
			userID,
			request.CafeID,
		).Scan(&reviewID)

		switch {
		case errors.Is(err, pgx.ErrNoRows):
			err = tx.QueryRow(
				ctx,
				sqlInsertReview,
				userID,
				request.CafeID,
				request.Rating,
				request.Summary,
			).Scan(&reviewID, &updatedAt)
			if err != nil {
				return 0, nil, err
			}

			if _, err := tx.Exec(
				ctx,
				sqlInsertReviewAttributes,
				reviewID,
				request.DrinkName,
				request.TasteTags,
				summaryLen,
				request.PhotoCount,
			); err != nil {
				return 0, nil, err
			}

			eventType = EventReviewCreated
			isCreated = true
		case err != nil:
			return 0, nil, err
		default:
			err = tx.QueryRow(
				ctx,
				sqlUpdateReview,
				reviewID,
				request.Rating,
				request.Summary,
			).Scan(&updatedAt)
			if err != nil {
				return 0, nil, err
			}

			if _, err := tx.Exec(
				ctx,
				sqlUpsertReviewAttributes,
				reviewID,
				request.DrinkName,
				request.TasteTags,
				summaryLen,
				request.PhotoCount,
			); err != nil {
				return 0, nil, err
			}

			eventType = EventReviewUpdated
		}

		payload := map[string]interface{}{
			"review_id": reviewID,
			"user_id":   userID,
			"cafe_id":   request.CafeID,
		}
		// Dedupe key intentionally includes idempotency key so a transport retry
		// cannot enqueue the same business event twice.
		dedupeKey := fmt.Sprintf("%s:%s:%s", scope, idempotencyKey, eventType)
		if err := s.repository.EnqueueEventTx(ctx, tx, eventType, request.CafeID, dedupeKey, payload); err != nil {
			return 0, nil, err
		}

		response := map[string]interface{}{
			"review_id":  reviewID,
			"cafe_id":    request.CafeID,
			"event_type": eventType,
			"created":    isCreated,
			"updated_at": updatedAt.UTC().Format(time.RFC3339),
		}

		if isCreated {
			return 201, response, nil
		}
		return 200, response, nil
	})
}
