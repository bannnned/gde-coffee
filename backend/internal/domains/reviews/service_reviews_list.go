package reviews

import (
	"context"
	"time"
)

func (s *Service) ListCafeReviews(
	ctx context.Context,
	cafeID string,
	sortBy string,
	offset int,
	limit int,
) ([]map[string]interface{}, bool, int, error) {
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
	// Offset-based cursor pagination keeps API simple while preserving stable ordering.
	query := sqlListCafeReviewsBase + "\n" + orderClause + "\noffset $2 limit $3"
	fetchLimit := limit + 1

	rows, err := s.repository.Pool().Query(ctx, query, cafeID, offset, fetchLimit)
	if err != nil {
		return nil, false, offset, err
	}
	defer rows.Close()

	result := make([]map[string]interface{}, 0, fetchLimit)
	for rows.Next() {
		var (
			item             cafeReviewState
			authorName       string
			tasteTags        []string
			helpfulVotes     int
			helpfulScore     float64
			visitConfidence  string
			visitVerified    bool
			confirmedReports int
			reviewPhotos     []string
		)

		if err := rows.Scan(
			&item.ReviewID,
			&item.UserID,
			&authorName,
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
		); err != nil {
			return nil, false, offset, err
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
			"rating":            item.Rating,
			"summary":           item.Summary,
			"drink_id":          item.DrinkID,
			"drink_name":        item.DrinkName,
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
		return nil, false, offset, err
	}

	hasMore := len(result) > limit
	if hasMore {
		result = result[:limit]
	}
	nextOffset := offset + len(result)

	return result, hasMore, nextOffset, nil
}
