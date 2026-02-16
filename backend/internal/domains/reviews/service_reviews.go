package reviews

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

func (s *Service) PublishReview(
	ctx context.Context,
	userID string,
	idempotencyKey string,
	req PublishReviewRequest,
) (idempotentResult, error) {
	return s.CreateReview(ctx, userID, idempotencyKey, req)
}

func (s *Service) CreateReview(
	ctx context.Context,
	userID string,
	idempotencyKey string,
	req PublishReviewRequest,
) (idempotentResult, error) {
	request := sanitizePublishReviewRequest(req)
	if err := validateCreateReviewRequest(request); err != nil {
		return idempotentResult{}, err
	}

	hash := requestHash(struct {
		UserID string               `json:"user_id"`
		Req    PublishReviewRequest `json:"req"`
	}{UserID: userID, Req: request})
	scope := IdempotencyScopeReviewCreate + ":" + userID

	return s.repository.RunIdempotent(ctx, scope, idempotencyKey, hash, func(tx pgx.Tx) (int, map[string]interface{}, error) {
		if !s.allowReviewCreate(userID) {
			return 0, nil, ErrRateLimited
		}

		var cafeExists bool
		if err := tx.QueryRow(ctx, sqlCheckCafeExists, request.CafeID).Scan(&cafeExists); err != nil {
			return 0, nil, err
		}
		if !cafeExists {
			return 0, nil, ErrNotFound
		}

		var existingReviewID, existingStatus string
		err := tx.QueryRow(ctx, sqlSelectReviewByUserCafeForUpdate, userID, request.CafeID).Scan(&existingReviewID, &existingStatus)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			// continue
		case err != nil:
			return 0, nil, err
		default:
			return 0, nil, ErrAlreadyExists
		}

		if looksLikeSpamSummary(request.Summary) {
			return 0, nil, ErrSpamDetected
		}

		summaryFinger := summaryFingerprint(request.Summary)
		isDuplicate, err := s.isDuplicateSummaryTx(ctx, tx, userID, "", summaryFinger)
		if err != nil {
			return 0, nil, err
		}
		if isDuplicate {
			return 0, nil, ErrDuplicateContent
		}

		resolvedPositions, err := s.resolveReviewPositionsTx(ctx, tx, request.Positions, userID)
		if err != nil {
			return 0, nil, err
		}
		request.Positions = resolvedPositions
		request.DrinkID = resolvedPositions[0].DrinkID
		request.Drink = resolvedPositions[0].Drink

		var (
			reviewID  string
			updatedAt time.Time
		)
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

		if err := s.upsertReviewAttributesTx(ctx, tx, reviewID, request, summaryFinger, request.Drink); err != nil {
			return 0, nil, err
		}
		if err := s.replaceReviewPhotosTx(ctx, tx, reviewID, request.Photos); err != nil {
			return 0, nil, err
		}
		if err := s.replaceReviewPositionsTx(
			ctx,
			tx,
			reviewID,
			mapReviewPositionDTOToState(request.Positions),
		); err != nil {
			return 0, nil, err
		}

		payload := map[string]interface{}{
			"review_id": reviewID,
			"user_id":   userID,
			"cafe_id":   request.CafeID,
		}
		// Dedupe key intentionally includes idempotency key so transport retries
		// cannot enqueue the same business event twice.
		dedupeKey := fmt.Sprintf("%s:%s:%s", scope, idempotencyKey, EventReviewCreated)
		if err := s.repository.EnqueueEventTx(ctx, tx, EventReviewCreated, request.CafeID, dedupeKey, payload); err != nil {
			return 0, nil, err
		}

		response := map[string]interface{}{
			"review_id":  reviewID,
			"cafe_id":    request.CafeID,
			"event_type": EventReviewCreated,
			"created":    true,
			"updated_at": updatedAt.UTC().Format(time.RFC3339),
		}
		return 201, response, nil
	})
}

func (s *Service) UpdateReview(
	ctx context.Context,
	userID string,
	reviewID string,
	idempotencyKey string,
	req UpdateReviewRequest,
) (idempotentResult, error) {
	hash := requestHash(struct {
		UserID   string              `json:"user_id"`
		ReviewID string              `json:"review_id"`
		Req      UpdateReviewRequest `json:"req"`
	}{UserID: userID, ReviewID: reviewID, Req: req})
	scope := IdempotencyScopeReviewUpdate + ":" + userID

	return s.repository.RunIdempotent(ctx, scope, idempotencyKey, hash, func(tx pgx.Tx) (int, map[string]interface{}, error) {
		if !s.allowReviewUpdate(userID) {
			return 0, nil, ErrRateLimited
		}

		state, err := s.loadReviewStateForUpdateTx(ctx, tx, reviewID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return 0, nil, ErrNotFound
			}
			return 0, nil, err
		}
		if state.UserID != userID {
			return 0, nil, ErrForbidden
		}

		next := state
		if req.Rating != nil {
			next.Rating = *req.Rating
		}
		if req.Positions != nil {
			next.Positions = mapReviewPositionDTOToState(normalizeReviewPositions(*req.Positions))
		} else if req.DrinkID != nil || req.Drink != nil {
			legacyDrinkID := ""
			legacyDrinkName := ""
			if req.DrinkID != nil {
				legacyDrinkID = *req.DrinkID
			}
			if req.Drink != nil {
				legacyDrinkName = *req.Drink
			}
			next.Positions = mapReviewPositionDTOToState(normalizeReviewPositions([]ReviewPositionDTO{
				{
					DrinkID: legacyDrinkID,
					Drink:   legacyDrinkName,
				},
			}))
		}
		if len(next.Positions) > 0 {
			next.DrinkID = next.Positions[0].DrinkID
			next.DrinkName = next.Positions[0].DrinkName
		}
		if req.TasteTags != nil {
			next.TasteTags = normalizeTags(*req.TasteTags)
		}
		if req.Summary != nil {
			next.Summary = strings.TrimSpace(*req.Summary)
		}
		if req.Photos != nil {
			next.Photos = normalizePhotos(*req.Photos)
		}

		if err := validateEffectiveReviewState(next, req.Summary != nil); err != nil {
			return 0, nil, err
		}
		if req.Positions != nil || req.DrinkID != nil || req.Drink != nil {
			rawPositions := make([]ReviewPositionDTO, 0, len(next.Positions))
			for _, item := range next.Positions {
				rawPositions = append(rawPositions, ReviewPositionDTO{
					DrinkID: item.DrinkID,
					Drink:   item.DrinkName,
				})
			}
			resolved, err := s.resolveReviewPositionsTx(ctx, tx, rawPositions, userID)
			if err != nil {
				return 0, nil, err
			}
			next.Positions = mapReviewPositionDTOToState(resolved)
			next.DrinkID = resolved[0].DrinkID
			next.DrinkName = resolved[0].Drink
		}
		if req.Summary != nil && looksLikeSpamSummary(next.Summary) {
			return 0, nil, ErrSpamDetected
		}

		summaryFinger := summaryFingerprint(next.Summary)
		isDuplicate, err := s.isDuplicateSummaryTx(ctx, tx, userID, state.ReviewID, summaryFinger)
		if err != nil {
			return 0, nil, err
		}
		if isDuplicate {
			return 0, nil, ErrDuplicateContent
		}

		updatedAt, err := s.updateReviewCoreTx(ctx, tx, state.ReviewID, next.Rating, next.Summary)
		if err != nil {
			return 0, nil, err
		}
		next.UpdatedAt = updatedAt

		if err := s.upsertReviewAttributesTx(ctx, tx, state.ReviewID, PublishReviewRequest{
			CafeID:    state.CafeID,
			Rating:    next.Rating,
			DrinkID:   next.DrinkID,
			Drink:     next.DrinkName,
			TasteTags: next.TasteTags,
			Summary:   next.Summary,
			Photos:    next.Photos,
		}, summaryFinger, next.DrinkName); err != nil {
			return 0, nil, err
		}
		if req.Photos != nil {
			if err := s.replaceReviewPhotosTx(ctx, tx, state.ReviewID, next.Photos); err != nil {
				return 0, nil, err
			}
		}
		if req.Positions != nil || req.DrinkID != nil || req.Drink != nil {
			if err := s.replaceReviewPositionsTx(ctx, tx, state.ReviewID, next.Positions); err != nil {
				return 0, nil, err
			}
		}

		payload := map[string]interface{}{
			"review_id": state.ReviewID,
			"user_id":   userID,
			"cafe_id":   state.CafeID,
		}
		dedupeKey := fmt.Sprintf("%s:%s:%s", scope, idempotencyKey, EventReviewUpdated)
		if err := s.repository.EnqueueEventTx(ctx, tx, EventReviewUpdated, state.CafeID, dedupeKey, payload); err != nil {
			return 0, nil, err
		}

		response := map[string]interface{}{
			"review_id":  state.ReviewID,
			"cafe_id":    state.CafeID,
			"event_type": EventReviewUpdated,
			"created":    false,
			"updated_at": updatedAt.UTC().Format(time.RFC3339),
		}
		return 200, response, nil
	})
}
