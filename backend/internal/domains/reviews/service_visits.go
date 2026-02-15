package reviews

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

const sqlUpsertVisitVerification = `insert into visit_verifications (review_id, user_id, cafe_id, confidence, verified_at, dwell_seconds)
 values (
	$1::uuid,
	$2::uuid,
	$3::uuid,
	$4,
	case when $4 = 'none' then null else now() end,
	$5
 )
 on conflict (review_id)
 do update set confidence = excluded.confidence,
               verified_at = case
								when excluded.confidence = 'none' then null
								else coalesce(visit_verifications.verified_at, now())
							  end,
               dwell_seconds = greatest(visit_verifications.dwell_seconds, excluded.dwell_seconds),
               updated_at = now()
 returning id::text`

func (s *Service) VerifyVisit(
	ctx context.Context,
	userID string,
	reviewID string,
	idempotencyKey string,
	req VerifyVisitRequest,
) (idempotentResult, error) {
	confidence := normalizeConfidence(req.Confidence)
	dwellSeconds := req.DwellSeconds
	if dwellSeconds < 0 {
		dwellSeconds = 0
	}

	hash := requestHash(struct {
		UserID      string `json:"user_id"`
		ReviewID    string `json:"review_id"`
		Confidence  string `json:"confidence"`
		DwellSecond int    `json:"dwell_seconds"`
	}{UserID: userID, ReviewID: reviewID, Confidence: confidence, DwellSecond: dwellSeconds})
	scope := IdempotencyScopeCheckIn + ":" + userID

	return s.repository.RunIdempotent(ctx, scope, idempotencyKey, hash, func(tx pgx.Tx) (int, map[string]interface{}, error) {
		var reviewAuthorID, cafeID string
		err := tx.QueryRow(
			ctx,
			sqlSelectPublishedReviewAuthorAndCafe,
			reviewID,
		).Scan(&reviewAuthorID, &cafeID)
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil, ErrNotFound
		}
		if err != nil {
			return 0, nil, err
		}

		if reviewAuthorID != userID {
			return 0, nil, ErrForbidden
		}

		var verificationID string
		err = tx.QueryRow(
			ctx,
			sqlUpsertVisitVerification,
			reviewID,
			userID,
			cafeID,
			confidence,
			dwellSeconds,
		).Scan(&verificationID)
		if err != nil {
			return 0, nil, err
		}

		if confidence != "none" {
			payload := map[string]interface{}{
				"visit_verification_id": verificationID,
				"review_id":             reviewID,
				"cafe_id":               cafeID,
			}
			dedupeKey := fmt.Sprintf("%s:%s:%s", scope, idempotencyKey, EventVisitVerified)
			if err := s.repository.EnqueueEventTx(ctx, tx, EventVisitVerified, cafeID, dedupeKey, payload); err != nil {
				return 0, nil, err
			}
		}

		response := map[string]interface{}{
			"verification_id": verificationID,
			"review_id":       reviewID,
			"confidence":      confidence,
		}
		return 200, response, nil
	})
}
