package reviews

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"backend/internal/reputation"

	"github.com/jackc/pgx/v5"
)

const (
	sqlSelectReviewForModeration = `select
		id::text,
		cafe_id::text,
		user_id::text,
		status
	from reviews
	where id = $1::uuid
	for update`

	sqlRemoveReviewByID = `update reviews
	set status = 'removed',
		updated_at = now()
	where id = $1::uuid
	returning updated_at`
)

const (
	reviewModerationReasonAbuse     = "abuse"
	reviewModerationReasonViolation = "violation"
)

func normalizeReviewModerationReason(raw string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case reviewModerationReasonAbuse:
		return reviewModerationReasonAbuse, true
	case reviewModerationReasonViolation:
		return reviewModerationReasonViolation, true
	default:
		return "", false
	}
}

func (s *Service) RemoveReviewByModerator(
	ctx context.Context,
	moderatorUserID string,
	reviewID string,
	req DeleteReviewRequest,
) (map[string]interface{}, error) {
	if strings.TrimSpace(moderatorUserID) == "" {
		return nil, ErrForbidden
	}
	reason, ok := normalizeReviewModerationReason(req.Reason)
	if !ok {
		return nil, ErrInvalidRemovalReason
	}

	tx, err := s.repository.Pool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var (
		state cafeReviewState
	)
	err = tx.QueryRow(ctx, sqlSelectReviewForModeration, reviewID).Scan(
		&state.ReviewID,
		&state.CafeID,
		&state.UserID,
		&state.Status,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if strings.EqualFold(strings.TrimSpace(state.Status), "removed") {
		return map[string]interface{}{
			"review_id":      state.ReviewID,
			"cafe_id":        state.CafeID,
			"removed":        true,
			"removal_reason": reason,
		}, nil
	}

	var updatedAt time.Time
	if err := tx.QueryRow(ctx, sqlRemoveReviewByID, state.ReviewID).Scan(&updatedAt); err != nil {
		return nil, err
	}

	payload := map[string]interface{}{
		"review_id":      state.ReviewID,
		"user_id":        state.UserID,
		"cafe_id":        state.CafeID,
		"removed":        true,
		"removal_reason": reason,
	}
	if details := strings.TrimSpace(req.Details); details != "" {
		payload["removal_details"] = details
	}
	// Include a monotonic suffix because multiple moderation deletes on different
	// reviews can occur in the same process lifetime and each must enqueue.
	dedupeKey := fmt.Sprintf("review.removed:%s:%d", state.ReviewID, time.Now().UnixNano())
	if err := s.repository.EnqueueEventTx(ctx, tx, EventReviewUpdated, state.CafeID, dedupeKey, payload); err != nil {
		return nil, err
	}

	// Reputation v1: only violation-oriented removals reduce author reputation.
	penaltyMetadata := map[string]interface{}{
		"reason":            reason,
		"moderator_user_id": moderatorUserID,
	}
	if details := strings.TrimSpace(req.Details); details != "" {
		penaltyMetadata["details"] = details
	}
	if err := s.repository.AddReputationEventTx(
		ctx,
		tx,
		state.UserID,
		reputation.EventReviewRemovedPenalty,
		reputation.PointsReviewRemovedPenalty,
		reputation.SourceReviewModeration,
		state.ReviewID,
		penaltyMetadata,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"review_id":      state.ReviewID,
		"cafe_id":        state.CafeID,
		"event_type":     EventReviewUpdated,
		"removed":        true,
		"removal_reason": reason,
		"updated_at":     updatedAt.UTC().Format(time.RFC3339),
	}, nil
}
