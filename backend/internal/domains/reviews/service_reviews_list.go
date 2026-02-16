package reviews

import (
	"context"
	"encoding/json"
	"time"

	"backend/internal/reputation"
)

func (s *Service) ListCafeReviews(
	ctx context.Context,
	cafeID string,
	sortBy string,
	positionFilter string,
	offset int,
	limit int,
) ([]map[string]interface{}, []map[string]interface{}, bool, int, error) {
	if limit <= 0 {
		limit = defaultReviewListLimit
	}
	if offset < 0 {
		offset = 0
	}

	orderClause, ok := reviewSortOrderClause[sortBy]
	if !ok {
		orderClause = reviewSortOrderClause["new"]
	}

	// Offset cursor stays deterministic because ORDER BY is explicit per sort mode.
	query := sqlListCafeReviewsBase + "\n" + orderClause + "\noffset $2 limit $3"
	fetchLimit := limit + 1

	rows, err := s.repository.Pool().Query(ctx, query, cafeID, offset, fetchLimit, positionFilter)
	if err != nil {
		return nil, nil, false, offset, err
	}
	defer rows.Close()

	result := make([]map[string]interface{}, 0, fetchLimit)
	for rows.Next() {
		var (
			item             cafeReviewState
			authorName       string
			authorRepScore   float64
			tasteTags        []string
			helpfulVotes     int
			helpfulScore     float64
			visitConfidence  string
			visitVerified    bool
			confirmedReports int
			reviewPhotos     []string
			positionsRaw     []byte
		)

		if err := rows.Scan(
			&item.ReviewID,
			&item.UserID,
			&authorName,
			&authorRepScore,
			&item.Rating,
			&item.Summary,
			&item.DrinkID,
			&item.DrinkName,
			&tasteTags,
			&item.PhotoCount,
			&helpfulVotes,
			&helpfulScore,
			&visitConfidence,
			&visitVerified,
			&confirmedReports,
			&item.CreatedAt,
			&item.UpdatedAt,
			&reviewPhotos,
			&positionsRaw,
		); err != nil {
			return nil, nil, false, offset, err
		}

		item.Positions = decodeReviewPositionsJSON(positionsRaw)
		if len(item.Positions) == 0 && (item.DrinkID != "" || item.DrinkName != "") {
			item.Positions = []reviewPositionState{
				{
					Position:  1,
					DrinkID:   item.DrinkID,
					DrinkName: item.DrinkName,
				},
			}
		}

		qualityScore := calculateReviewQualityV1(
			item.DrinkID,
			len(tasteTags),
			utfRuneLen(item.Summary),
			len(reviewPhotos),
			visitConfidence,
			confirmedReports,
		)

		result = append(result, map[string]interface{}{
			"id":                item.ReviewID,
			"user_id":           item.UserID,
			"author_name":       authorName,
			"author_badge":      reputation.BadgeFromScore(authorRepScore),
			"author_trusted":    reputation.IsTrustedParticipant(authorRepScore),
			"rating":            item.Rating,
			"summary":           item.Summary,
			"drink_id":          item.DrinkID,
			"drink_name":        item.DrinkName,
			"positions":         mapReviewPositionsForResponse(item.Positions),
			"taste_tags":        tasteTags,
			"photos":            reviewPhotos,
			"photo_count":       len(reviewPhotos),
			"helpful_votes":     helpfulVotes,
			"helpful_score":     roundFloat(helpfulScore, 3),
			"visit_confidence":  visitConfidence,
			"visit_verified":    visitVerified,
			"quality_score":     qualityScore,
			"confirmed_reports": confirmedReports,
			"created_at":        item.CreatedAt.UTC().Format(time.RFC3339),
			"updated_at":        item.UpdatedAt.UTC().Format(time.RFC3339),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, nil, false, offset, err
	}

	positionOptions, err := s.listCafeReviewPositionOptions(ctx, cafeID)
	if err != nil {
		return nil, nil, false, offset, err
	}

	hasMore := len(result) > limit
	if hasMore {
		result = result[:limit]
	}
	nextOffset := offset + len(result)

	return result, positionOptions, hasMore, nextOffset, nil
}

func decodeReviewPositionsJSON(raw []byte) []reviewPositionState {
	if len(raw) == 0 {
		return nil
	}
	var parsed []reviewPositionState
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil
	}
	for idx := range parsed {
		parsed[idx].DrinkID = normalizeDrinkToken(parsed[idx].DrinkID)
		parsed[idx].DrinkName = normalizeDrinkText(parsed[idx].DrinkName)
	}
	return parsed
}

func mapReviewPositionsForResponse(positions []reviewPositionState) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(positions))
	for idx, item := range positions {
		position := item.Position
		if position <= 0 {
			position = idx + 1
		}
		result = append(result, map[string]interface{}{
			"position":   position,
			"drink_id":   item.DrinkID,
			"drink_name": item.DrinkName,
		})
	}
	return result
}

func (s *Service) listCafeReviewPositionOptions(ctx context.Context, cafeID string) ([]map[string]interface{}, error) {
	rows, err := s.repository.Pool().Query(ctx, sqlListCafeReviewPositionOptions, cafeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	options := make([]map[string]interface{}, 0, 8)
	for rows.Next() {
		var (
			key          string
			label        string
			reviewsCount int
		)
		if err := rows.Scan(&key, &label, &reviewsCount); err != nil {
			return nil, err
		}
		options = append(options, map[string]interface{}{
			"key":           normalizeDrinkText(key),
			"label":         normalizeDrinkText(label),
			"reviews_count": reviewsCount,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return options, nil
}
