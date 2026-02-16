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
	if len(req.Positions) == 0 && strings.TrimSpace(req.DrinkID) == "" && strings.TrimSpace(req.Drink) == "" {
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
	if len(state.Positions) == 0 && strings.TrimSpace(state.DrinkID) == "" && strings.TrimSpace(state.DrinkName) == "" {
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

	positionRows, err := tx.Query(ctx, sqlSelectReviewPositions, state.ReviewID)
	if err != nil {
		return state, err
	}
	defer positionRows.Close()

	positions := make([]reviewPositionState, 0, 4)
	for positionRows.Next() {
		var item reviewPositionState
		if err := positionRows.Scan(&item.Position, &item.DrinkID, &item.DrinkName); err != nil {
			return state, err
		}
		item.DrinkID = normalizeDrinkToken(item.DrinkID)
		item.DrinkName = normalizeDrinkText(item.DrinkName)
		positions = append(positions, item)
	}
	if err := positionRows.Err(); err != nil {
		return state, err
	}
	state.Positions = positions
	if len(state.Positions) > 0 {
		state.DrinkID = state.Positions[0].DrinkID
		state.DrinkName = state.Positions[0].DrinkName
	} else if state.DrinkID != "" || state.DrinkName != "" {
		state.Positions = []reviewPositionState{
			{
				Position:  1,
				DrinkID:   state.DrinkID,
				DrinkName: state.DrinkName,
			},
		}
	}
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

func (s *Service) replaceReviewPositionsTx(
	ctx context.Context,
	tx pgx.Tx,
	reviewID string,
	positions []reviewPositionState,
) error {
	if _, err := tx.Exec(ctx, sqlDeleteReviewPositions, reviewID); err != nil {
		return err
	}
	for idx, item := range positions {
		drinkID := normalizeDrinkToken(item.DrinkID)
		drinkName := normalizeDrinkText(item.DrinkName)
		if drinkID == "" && drinkName == "" {
			continue
		}
		if _, err := tx.Exec(
			ctx,
			sqlInsertReviewPosition,
			reviewID,
			idx+1,
			drinkID,
			drinkName,
		); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) resolveReviewPositionsTx(
	ctx context.Context,
	tx pgx.Tx,
	input []ReviewPositionDTO,
	userID string,
) ([]ReviewPositionDTO, error) {
	normalized := normalizeReviewPositions(input)
	if len(normalized) == 0 {
		return nil, ErrInvalidDrink
	}

	resolved := make([]ReviewPositionDTO, 0, len(normalized))
	for _, item := range normalized {
		choice, err := s.resolveDrinkInputTx(ctx, tx, item.DrinkID, item.Drink, userID)
		if err != nil {
			return nil, err
		}
		resolved = append(resolved, ReviewPositionDTO{
			DrinkID: choice.ID,
			Drink:   choice.Name,
		})
	}

	// Re-normalize after resolution to collapse aliases to one canonical drink_id.
	resolved = normalizeReviewPositions(resolved)
	if len(resolved) == 0 {
		return nil, ErrInvalidDrink
	}
	return resolved, nil
}

func mapReviewPositionDTOToState(input []ReviewPositionDTO) []reviewPositionState {
	positions := make([]reviewPositionState, 0, len(input))
	for idx, item := range input {
		positions = append(positions, reviewPositionState{
			Position:  idx + 1,
			DrinkID:   normalizeDrinkToken(item.DrinkID),
			DrinkName: normalizeDrinkText(item.Drink),
		})
	}
	return positions
}
