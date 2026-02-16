package reviews

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

func validateCreateReviewRequest(req PublishReviewRequest) error {
	if strings.TrimSpace(req.CafeID) == "" {
		return ErrConflict
	}
	if req.Rating < 1 || req.Rating > 5 {
		return ErrConflict
	}
	if strings.TrimSpace(req.DrinkID) == "" && strings.TrimSpace(req.Drink) == "" {
		return ErrConflict
	}
	if utfRuneLen(req.Summary) < minReviewSummaryLength {
		return ErrConflict
	}
	for _, photo := range req.Photos {
		if !validPhotoURL(photo) {
			return ErrConflict
		}
	}
	return nil
}

func validateEffectiveReviewState(state cafeReviewState, enforceSummaryMin bool) error {
	if state.Rating < 1 || state.Rating > 5 {
		return ErrConflict
	}
	if strings.TrimSpace(state.DrinkID) == "" && strings.TrimSpace(state.DrinkName) == "" {
		return ErrConflict
	}
	if enforceSummaryMin && utfRuneLen(state.Summary) < minReviewSummaryLength {
		return ErrConflict
	}
	for _, photo := range state.Photos {
		if !validPhotoURL(photo) {
			return ErrConflict
		}
	}
	return nil
}

func (s *Service) allowReviewCreate(userID string) bool {
	if s.createLimiter == nil {
		return true
	}
	return s.createLimiter.Allow(strings.TrimSpace(userID))
}

func (s *Service) allowReviewUpdate(userID string) bool {
	if s.updateLimiter == nil {
		return true
	}
	return s.updateLimiter.Allow(strings.TrimSpace(userID))
}

func (s *Service) isDuplicateSummaryTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
	excludeReviewID string,
	fingerprint string,
) (bool, error) {
	if strings.TrimSpace(fingerprint) == "" {
		return false, nil
	}
	var exists bool
	err := tx.QueryRow(ctx, sqlExistsDuplicateSummary, userID, fingerprint, strings.TrimSpace(excludeReviewID)).Scan(&exists)
	return exists, err
}

func (s *Service) loadReviewStateForUpdateTx(ctx context.Context, tx pgx.Tx, reviewID string) (cafeReviewState, error) {
	var state cafeReviewState
	err := tx.QueryRow(ctx, sqlSelectReviewForUpdateByID, reviewID).Scan(
		&state.ReviewID,
		&state.UserID,
		&state.CafeID,
		&state.Rating,
		&state.Summary,
		&state.DrinkID,
		&state.DrinkName,
		&state.TasteTags,
	)
	if err != nil {
		return state, err
	}

	rows, err := tx.Query(ctx, sqlSelectReviewPhotos, state.ReviewID)
	if err != nil {
		return state, err
	}
	defer rows.Close()

	photos := make([]string, 0, 4)
	for rows.Next() {
		var photoURL string
		if err := rows.Scan(&photoURL); err != nil {
			return state, err
		}
		photos = append(photos, strings.TrimSpace(photoURL))
	}
	if err := rows.Err(); err != nil {
		return state, err
	}
	state.Photos = photos
	state.PhotoCount = len(photos)
	return state, nil
}

func (s *Service) updateReviewCoreTx(
	ctx context.Context,
	tx pgx.Tx,
	reviewID string,
	rating int,
	summary string,
) (time.Time, error) {
	var updatedAt time.Time
	err := tx.QueryRow(ctx, sqlUpdateReview, reviewID, rating, summary).Scan(&updatedAt)
	return updatedAt, err
}

func (s *Service) upsertReviewAttributesTx(
	ctx context.Context,
	tx pgx.Tx,
	reviewID string,
	req PublishReviewRequest,
	summaryFinger string,
	drinkName string,
) error {
	summaryLen := utfRuneLen(req.Summary)
	_, err := tx.Exec(
		ctx,
		sqlUpsertReviewAttributes,
		reviewID,
		req.DrinkID,
		drinkName,
		req.TasteTags,
		summaryLen,
		summaryFinger,
		len(req.Photos),
	)
	return err
}

func (s *Service) replaceReviewPhotosTx(
	ctx context.Context,
	tx pgx.Tx,
	reviewID string,
	photos []string,
) error {
	if _, err := tx.Exec(ctx, sqlDeleteReviewPhotos, reviewID); err != nil {
		return err
	}
	for idx, photoURL := range photos {
		if _, err := tx.Exec(ctx, sqlInsertReviewPhoto, reviewID, photoURL, idx+1); err != nil {
			return err
		}
	}
	return nil
}
