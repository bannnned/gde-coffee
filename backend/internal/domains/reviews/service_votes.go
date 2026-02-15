package reviews

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

func (s *Service) AddHelpfulVote(
	ctx context.Context,
	userID string,
	reviewID string,
	idempotencyKey string,
) (idempotentResult, error) {
	hash := requestHash(struct {
		UserID   string `json:"user_id"`
		ReviewID string `json:"review_id"`
	}{UserID: userID, ReviewID: reviewID})
	scope := IdempotencyScopeHelpfulVote + ":" + userID

	return s.repository.RunIdempotent(ctx, scope, idempotencyKey, hash, func(tx pgx.Tx) (int, map[string]interface{}, error) {
		var reviewAuthorID, cafeID string
		err := tx.QueryRow(
			ctx,
			`select user_id::text, cafe_id::text
			   from reviews
			  where id = $1::uuid and status = 'published'`,
			reviewID,
		).Scan(&reviewAuthorID, &cafeID)
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil, ErrNotFound
		}
		if err != nil {
			return 0, nil, err
		}

		if reviewAuthorID == userID {
			return 0, nil, ErrForbidden
		}

		voterRep, err := s.lookupUserReputationScoreTx(ctx, tx, userID)
		if err != nil {
			return 0, nil, err
		}
		weight := voteWeightFromReputation(voterRep)

		var voteID string
		err = tx.QueryRow(
			ctx,
			`insert into helpful_votes (review_id, voter_user_id, weight)
			 values ($1::uuid, $2::uuid, $3)
			 on conflict (review_id, voter_user_id) do nothing
			 returning id::text`,
			reviewID,
			userID,
			weight,
		).Scan(&voteID)

		alreadyExists := false
		if errors.Is(err, pgx.ErrNoRows) {
			alreadyExists = true
			err = tx.QueryRow(
				ctx,
				`select id::text, weight
				   from helpful_votes
				  where review_id = $1::uuid and voter_user_id = $2::uuid`,
				reviewID,
				userID,
			).Scan(&voteID, &weight)
			if err != nil {
				return 0, nil, err
			}
		} else if err != nil {
			return 0, nil, err
		}

		if !alreadyExists {
			payload := map[string]interface{}{
				"vote_id":   voteID,
				"review_id": reviewID,
				"cafe_id":   cafeID,
			}
			dedupeKey := fmt.Sprintf("%s:%s:%s", scope, idempotencyKey, EventHelpfulAdded)
			if err := s.repository.EnqueueEventTx(ctx, tx, EventHelpfulAdded, cafeID, dedupeKey, payload); err != nil {
				return 0, nil, err
			}
		}

		response := map[string]interface{}{
			"vote_id":        voteID,
			"review_id":      reviewID,
			"weight":         weight,
			"already_exists": alreadyExists,
		}
		return 200, response, nil
	})
}
