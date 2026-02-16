package reviews

import (
	"context"
	"math"
	"sort"
	"strings"
	"time"
)

const (
	ratingDiagnosticsMaxReviews = 500
)

type ratingDiagnosticsReviewInput struct {
	ReviewID         string
	AuthorUserID     string
	AuthorName       string
	Rating           float64
	Summary          string
	DrinkID          string
	TagsCount        int
	SummaryLength    int
	PhotoCount       int
	VisitConfidence  string
	VisitVerified    bool
	ConfirmedReports int
	HelpfulScore     float64
	CreatedAt        time.Time
}

func (s *Service) GetCafeRatingDiagnostics(ctx context.Context, cafeID string) (map[string]interface{}, error) {
	snapshot, err := s.GetCafeRatingSnapshot(ctx, cafeID)
	if err != nil {
		return nil, err
	}

	reviews, err := s.loadRatingDiagnosticsInputs(ctx, cafeID, ratingDiagnosticsMaxReviews)
	if err != nil {
		return nil, err
	}

	globalMean, err := s.globalMeanRating(ctx)
	if err != nil {
		return nil, err
	}
	if fromSnapshot := snapshotComponentFloat(snapshot, "global_mean"); fromSnapshot > 0 {
		globalMean = fromSnapshot
	}

	authorRepCache := map[string]float64{}
	for _, item := range reviews {
		if _, ok := authorRepCache[item.AuthorUserID]; ok {
			continue
		}
		rep, repErr := s.lookupUserReputationScore(ctx, item.AuthorUserID)
		if repErr != nil {
			return nil, repErr
		}
		authorRepCache[item.AuthorUserID] = rep
	}

	type diagnosticsRow struct {
		reviewInput    ratingDiagnosticsReviewInput
		qualityScore   float64
		authorRep      float64
		authorRepNorm  float64
		fraudSuspicion bool
	}

	rows := make([]diagnosticsRow, 0, len(reviews))
	var (
		sumRatings           float64
		sumAuthorRepNorm     float64
		verifiedReviewsCount int
		flaggedReviewsCount  int
		confirmedReports     int
	)

	for _, item := range reviews {
		authorRep := authorRepCache[item.AuthorUserID]
		authorRepNorm := clamp(authorRep/ratingAuthorRepNormMax, 0, 1)
		qualityScore := calculateReviewQualityV1(
			item.DrinkID,
			item.TagsCount,
			item.SummaryLength,
			item.PhotoCount,
			item.VisitConfidence,
			item.ConfirmedReports,
		)

		if item.VisitVerified {
			verifiedReviewsCount++
		}
		if item.ConfirmedReports > 0 {
			flaggedReviewsCount++
		}
		confirmedReports += item.ConfirmedReports
		sumRatings += item.Rating
		sumAuthorRepNorm += authorRepNorm

		rows = append(rows, diagnosticsRow{
			reviewInput:    item,
			qualityScore:   qualityScore,
			authorRep:      authorRep,
			authorRepNorm:  authorRepNorm,
			fraudSuspicion: item.ConfirmedReports > 0,
		})
	}

	reviewsCount := len(rows)
	ratingsMean := 0.0
	verifiedShare := 0.0
	authorRepAvgNorm := 0.0
	fraudRisk := 0.0
	if reviewsCount > 0 {
		ratingsMean = sumRatings / float64(reviewsCount)
		verifiedShare = float64(verifiedReviewsCount) / float64(reviewsCount)
		authorRepAvgNorm = sumAuthorRepNorm / float64(reviewsCount)
		fraudRisk = clamp(float64(flaggedReviewsCount)/float64(reviewsCount), 0, 1)
	}

	// Keep diagnostics in sync with the production formula:
	// base = bayesian_mean(local_mean, global_mean, m)
	// trust = 1 + a*verified_share + b*author_rep_avg_norm - c*fraud_risk
	// final = clamp(base * trust, 1..5)
	base := bayesianMean(ratingsMean, float64(reviewsCount), globalMean, ratingBayesianM)
	trust := 1 +
		(ratingTrustCoeffVerifiedShare * verifiedShare) +
		(ratingTrustCoeffAuthorRepNorm * authorRepAvgNorm) -
		(ratingTrustCoeffFraudRisk * fraudRisk)
	derivedRating := clamp(base*trust, 1, 5)

	snapshotRating := valueFloat(snapshot["rating"])
	ratingDelta := roundFloat(snapshotRating-derivedRating, 4)
	isConsistent := math.Abs(ratingDelta) <= 0.02

	sort.Slice(rows, func(i, j int) bool {
		left := rows[i]
		right := rows[j]
		if !almostEqual(left.reviewInput.HelpfulScore, right.reviewInput.HelpfulScore) {
			return left.reviewInput.HelpfulScore > right.reviewInput.HelpfulScore
		}
		if !almostEqual(left.qualityScore, right.qualityScore) {
			return left.qualityScore > right.qualityScore
		}
		if left.reviewInput.VisitVerified != right.reviewInput.VisitVerified {
			return left.reviewInput.VisitVerified
		}
		if !left.reviewInput.CreatedAt.Equal(right.reviewInput.CreatedAt) {
			return left.reviewInput.CreatedAt.After(right.reviewInput.CreatedAt)
		}
		return left.reviewInput.ReviewID > right.reviewInput.ReviewID
	})

	breakdown := make([]map[string]interface{}, 0, len(rows))
	for _, row := range rows {
		item := row.reviewInput
		breakdown = append(breakdown, map[string]interface{}{
			"review_id":         item.ReviewID,
			"author_user_id":    item.AuthorUserID,
			"author_name":       item.AuthorName,
			"rating":            roundFloat(item.Rating, 2),
			"helpful_score":     roundFloat(item.HelpfulScore, 3),
			"quality_score":     roundFloat(row.qualityScore, 2),
			"author_reputation": roundFloat(row.authorRep, 2),
			"author_rep_norm":   roundFloat(row.authorRepNorm, 4),
			"visit_verified":    item.VisitVerified,
			"visit_confidence":  item.VisitConfidence,
			"confirmed_reports": item.ConfirmedReports,
			"fraud_suspicion":   row.fraudSuspicion,
			"summary_length":    item.SummaryLength,
			"summary_excerpt":   ratingDiagnosticsExcerpt(item.Summary, 220),
			"tags_count":        item.TagsCount,
			"photo_count":       item.PhotoCount,
			"drink_selected":    strings.TrimSpace(item.DrinkID) != "",
			"created_at":        item.CreatedAt.UTC().Format(time.RFC3339),
		})
	}

	warnings := make([]string, 0, 4)
	if reviewsCount < 5 {
		warnings = append(warnings, "Мало отзывов: рейтинг может меняться сильнее обычного.")
	}
	if fraudRisk >= 0.2 {
		warnings = append(warnings, "Высокая доля отзывов с подтверждёнными жалобами.")
	}
	if !isConsistent {
		warnings = append(warnings, "Снимок рейтинга расходится с пересчётом: проверьте очередь событий и воркер.")
	}

	return map[string]interface{}{
		"cafe_id":                cafeID,
		"formula_version":        snapshot["formula_version"],
		"computed_at":            snapshot["computed_at"],
		"snapshot_rating":        roundFloat(snapshotRating, 2),
		"derived_rating":         roundFloat(derivedRating, 2),
		"rating_delta":           ratingDelta,
		"is_consistent":          isConsistent,
		"reviews_count":          reviewsCount,
		"verified_reviews_count": verifiedReviewsCount,
		"verified_share":         roundFloat(verifiedShare, 4),
		"fraud_risk":             roundFloat(fraudRisk, 4),
		"components": map[string]interface{}{
			"ratings_mean":        roundFloat(ratingsMean, 4),
			"global_mean":         roundFloat(globalMean, 4),
			"bayesian_m":          ratingBayesianM,
			"bayesian_base":       roundFloat(base, 4),
			"author_rep_avg_norm": roundFloat(authorRepAvgNorm, 4),
			"trust":               roundFloat(trust, 4),
			"trust_coeff_a":       ratingTrustCoeffVerifiedShare,
			"trust_coeff_b":       ratingTrustCoeffAuthorRepNorm,
			"trust_coeff_c":       ratingTrustCoeffFraudRisk,
			"flagged_reviews":     flaggedReviewsCount,
			"confirmed_reports":   confirmedReports,
		},
		"best_review": snapshot["best_review"],
		"warnings":    warnings,
		"reviews":     breakdown,
	}, nil
}

func (s *Service) loadRatingDiagnosticsInputs(
	ctx context.Context,
	cafeID string,
	limit int,
) ([]ratingDiagnosticsReviewInput, error) {
	if limit <= 0 || limit > ratingDiagnosticsMaxReviews {
		limit = ratingDiagnosticsMaxReviews
	}

	sql := sqlSelectCafeReviewInputs + `
 order by r.created_at desc, r.id desc
 limit $2`
	rows, err := s.repository.Pool().Query(ctx, sql, cafeID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]ratingDiagnosticsReviewInput, 0, minInt(32, limit))
	for rows.Next() {
		var item ratingDiagnosticsReviewInput
		if err := rows.Scan(
			&item.ReviewID,
			&item.AuthorUserID,
			&item.AuthorName,
			&item.Rating,
			&item.Summary,
			&item.DrinkID,
			&item.TagsCount,
			&item.SummaryLength,
			&item.PhotoCount,
			&item.VisitConfidence,
			&item.VisitVerified,
			&item.ConfirmedReports,
			&item.HelpfulScore,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func ratingDiagnosticsExcerpt(value string, maxRunes int) string {
	clean := strings.TrimSpace(value)
	if clean == "" || maxRunes <= 0 {
		return ""
	}
	runes := []rune(clean)
	if len(runes) <= maxRunes {
		return clean
	}
	return strings.TrimSpace(string(runes[:maxRunes])) + "…"
}

func snapshotComponentFloat(snapshot map[string]interface{}, key string) float64 {
	components, ok := snapshot["components"].(map[string]interface{})
	if !ok || components == nil {
		return 0
	}
	return valueFloat(components[key])
}

func valueFloat(value interface{}) float64 {
	switch cast := value.(type) {
	case float64:
		return cast
	case float32:
		return float64(cast)
	case int:
		return float64(cast)
	case int32:
		return float64(cast)
	case int64:
		return float64(cast)
	default:
		return 0
	}
}
