package reviews

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	sqlSelectCafeReviewInputs = `select
	r.id::text,
	r.user_id::text,
	coalesce(nullif(trim(u.display_name), ''), 'Участник') as author_name,
	r.rating::float8,
	r.summary,
	coalesce(nullif(ra.drink_id, ''), coalesce(ra.drink_name, '')),
	coalesce(cardinality(ra.taste_tags), 0),
	coalesce(ra.summary_length, 0),
	coalesce(ra.photo_count, 0),
	coalesce(vv.confidence, 'none'),
	coalesce(vv.verified_at is not null and vv.confidence in ('low', 'medium', 'high'), false) as visit_verified,
	coalesce((
		select count(*)
		  from abuse_reports ar
		 where ar.review_id = r.id and ar.status = 'confirmed'
	), 0),
	coalesce((
		select sum(hv.weight)
		  from helpful_votes hv
		 where hv.review_id = r.id
	), 0)::float8 as helpful_score,
	r.created_at
from reviews r
join users u on u.id = r.user_id
left join review_attributes ra on ra.review_id = r.id
left join visit_verifications vv on vv.review_id = r.id
where r.cafe_id = $1::uuid and r.status = 'published'`

	sqlUpsertCafeRatingSnapshot = `insert into cafe_rating_snapshots (
	cafe_id,
	formula_version,
	rating,
	reviews_count,
	verified_reviews_count,
	fraud_risk,
	components,
	computed_at,
	updated_at
)
values ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, now(), now())
on conflict (cafe_id)
do update set
	formula_version = excluded.formula_version,
	rating = excluded.rating,
	reviews_count = excluded.reviews_count,
	verified_reviews_count = excluded.verified_reviews_count,
	fraud_risk = excluded.fraud_risk,
	components = excluded.components,
	computed_at = excluded.computed_at,
	updated_at = now()`

	sqlSelectCafeRatingSnapshot = `select formula_version,
        rating::float8,
        reviews_count,
        verified_reviews_count,
        fraud_risk::float8,
        components,
        computed_at
   from cafe_rating_snapshots
  where cafe_id = $1::uuid`

	sqlSelectUserReputationWeightedSum = `select coalesce(sum(
	case
		when created_at >= now() - interval '365 days' then points::numeric
		else points::numeric * 0.5
	end
), 0)::float8
from reputation_events
where user_id = $1::uuid`

	sqlSelectGlobalMeanRating = `select coalesce(avg(rating)::float8, 4.0)
   from reviews
  where status = 'published'`
)

const (
	// rating_v2 parameters (agreed defaults):
	// - bayesian_m controls smoothing strength for small-N cafes.
	// - trust coefficients shape the multiplier:
	//   trust = 1 + a*verified_share + b*author_rep_avg_norm - c*fraud_risk.
	ratingBayesianM               = 20.0
	ratingTrustCoeffVerifiedShare = 0.25
	ratingTrustCoeffAuthorRepNorm = 0.20
	ratingTrustCoeffFraudRisk     = 0.35
	ratingAuthorRepNormMax        = 300.0
)

type bestReviewCandidate struct {
	ReviewID      string
	AuthorName    string
	Rating        float64
	Summary       string
	HelpfulScore  float64
	QualityScore  float64
	VisitVerified bool
	CreatedAt     time.Time
}

func (s *Service) GetCafeRatingSnapshot(ctx context.Context, cafeID string) (map[string]interface{}, error) {
	snapshot, err := s.loadCafeRatingSnapshot(ctx, cafeID)
	if err == nil {
		return snapshot, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	if err := s.recalculateCafeRatingSnapshot(ctx, cafeID); err != nil {
		return nil, err
	}
	return s.loadCafeRatingSnapshot(ctx, cafeID)
}

func (s *Service) recalculateCafeRatingSnapshot(ctx context.Context, cafeID string) error {
	type reviewInput struct {
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

	reviews := make([]reviewInput, 0, 32)
	rows, err := s.repository.Pool().Query(
		ctx,
		sqlSelectCafeReviewInputs,
		cafeID,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var item reviewInput
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
			return err
		}
		reviews = append(reviews, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	globalMean, err := s.globalMeanRating(ctx)
	if err != nil {
		return err
	}
	ratingFormulaVersion := s.versioning.RatingFormula
	qualityFormulaVersion := s.versioning.QualityFormula

	if len(reviews) == 0 {
		components := map[string]interface{}{
			"global_mean":         roundFloat(globalMean, 4),
			"reason":              "no_reviews",
			"bayesian_m":          ratingBayesianM,
			"trust_coeff_a":       ratingTrustCoeffVerifiedShare,
			"trust_coeff_b":       ratingTrustCoeffAuthorRepNorm,
			"trust_coeff_c":       ratingTrustCoeffFraudRisk,
			"verified_share":      0.0,
			"author_rep_avg_norm": 0.0,
			"trust":               1.0,
			"best_review":         nil,
			"rating_formula":      ratingFormulaVersion,
			"quality_formula":     qualityFormulaVersion,
		}
		for key, value := range s.versioningSnapshot() {
			components[key] = value
		}
		return s.saveCafeRatingSnapshot(ctx, cafeID, ratingFormulaVersion, 0, 0, 0, 0, components)
	}

	authorRepCache := map[string]float64{}
	for _, item := range reviews {
		if _, ok := authorRepCache[item.AuthorUserID]; ok {
			continue
		}
		rep, err := s.lookupUserReputationScore(ctx, item.AuthorUserID)
		if err != nil {
			return err
		}
		authorRepCache[item.AuthorUserID] = rep
	}

	var (
		sumRatings           float64
		sumAuthorRepNorm     float64
		verifiedReviewsCount int
		flaggedReviewsCount  int
		confirmedReports     int
		bestReview           *bestReviewCandidate
	)

	for _, item := range reviews {
		authorRep := authorRepCache[item.AuthorUserID]
		if item.VisitVerified {
			verifiedReviewsCount++
		}
		if item.ConfirmedReports > 0 {
			flaggedReviewsCount++
		}

		qualityScore, resolvedQualityFormula := s.calculateReviewQualityScore(
			item.DrinkID,
			item.TagsCount,
			item.SummaryLength,
			item.PhotoCount,
			item.VisitConfidence,
			item.ConfirmedReports,
		)
		qualityFormulaVersion = resolvedQualityFormula
		confirmedReports += item.ConfirmedReports

		sumRatings += item.Rating
		sumAuthorRepNorm += clamp(authorRep/ratingAuthorRepNormMax, 0, 1)

		candidate := bestReviewCandidate{
			ReviewID:      item.ReviewID,
			AuthorName:    item.AuthorName,
			Rating:        item.Rating,
			Summary:       item.Summary,
			HelpfulScore:  item.HelpfulScore,
			QualityScore:  qualityScore,
			VisitVerified: item.VisitVerified,
			CreatedAt:     item.CreatedAt,
		}
		if bestReview == nil || isBetterBestReviewCandidate(candidate, *bestReview) {
			next := candidate
			bestReview = &next
		}
	}

	reviewsCount := len(reviews)
	ratingsMean := sumRatings / float64(reviewsCount)
	verifiedShare := float64(verifiedReviewsCount) / float64(reviewsCount)
	authorRepAvgNorm := sumAuthorRepNorm / float64(reviewsCount)
	fraudRisk := clamp(float64(flaggedReviewsCount)/float64(reviewsCount), 0, 1)

	// rating_v2 formula:
	// 1) base = bayesian_mean(cafe_ratings, global_mean, m)
	// 2) trust = 1 + a*verified_share + b*author_rep_avg_norm - c*fraud_risk
	// 3) final = clamp(base * trust, 1.0, 5.0)
	base := 0.0
	trust := 1.0
	final := 0.0
	switch ratingFormulaVersion {
	case RatingFormulaV2:
		base = bayesianMean(ratingsMean, float64(reviewsCount), globalMean, ratingBayesianM)
		trust = 1 +
			(ratingTrustCoeffVerifiedShare * verifiedShare) +
			(ratingTrustCoeffAuthorRepNorm * authorRepAvgNorm) -
			(ratingTrustCoeffFraudRisk * fraudRisk)
		final = clamp(base*trust, 1, 5)
	case RatingFormulaV3:
		// rating_v3 is gated and not implemented yet; fallback to stable v2.
		ratingFormulaVersion = RatingFormulaV2
		base = bayesianMean(ratingsMean, float64(reviewsCount), globalMean, ratingBayesianM)
		trust = 1 +
			(ratingTrustCoeffVerifiedShare * verifiedShare) +
			(ratingTrustCoeffAuthorRepNorm * authorRepAvgNorm) -
			(ratingTrustCoeffFraudRisk * fraudRisk)
		final = clamp(base*trust, 1, 5)
	default:
		ratingFormulaVersion = RatingFormulaV2
		base = bayesianMean(ratingsMean, float64(reviewsCount), globalMean, ratingBayesianM)
		trust = 1 +
			(ratingTrustCoeffVerifiedShare * verifiedShare) +
			(ratingTrustCoeffAuthorRepNorm * authorRepAvgNorm) -
			(ratingTrustCoeffFraudRisk * fraudRisk)
		final = clamp(base*trust, 1, 5)
	}

	var bestReviewPayload interface{} = nil
	if bestReview != nil {
		bestReviewPayload = map[string]interface{}{
			"id":             bestReview.ReviewID,
			"author_name":    bestReview.AuthorName,
			"rating":         roundFloat(bestReview.Rating, 2),
			"summary":        bestReview.Summary,
			"helpful_score":  roundFloat(bestReview.HelpfulScore, 3),
			"quality_score":  roundFloat(bestReview.QualityScore, 2),
			"visit_verified": bestReview.VisitVerified,
			"created_at":     bestReview.CreatedAt.UTC().Format(time.RFC3339),
		}
	}

	components := map[string]interface{}{
		"global_mean":         roundFloat(globalMean, 4),
		"ratings_mean":        roundFloat(ratingsMean, 4),
		"bayesian_base":       roundFloat(base, 4),
		"bayesian_m":          ratingBayesianM,
		"verified_share":      roundFloat(verifiedShare, 4),
		"author_rep_avg_norm": roundFloat(authorRepAvgNorm, 4),
		"trust":               roundFloat(trust, 4),
		"trust_coeff_a":       ratingTrustCoeffVerifiedShare,
		"trust_coeff_b":       ratingTrustCoeffAuthorRepNorm,
		"trust_coeff_c":       ratingTrustCoeffFraudRisk,
		"fraud_risk":          roundFloat(fraudRisk, 4),
		"flagged_reviews":     flaggedReviewsCount,
		"confirmed_reports":   confirmedReports,
		"rating_formula":      ratingFormulaVersion,
		"quality_formula":     qualityFormulaVersion,
		"verified_reviews":    verifiedReviewsCount,
		"published_reviews":   reviewsCount,
		"best_review":         bestReviewPayload,
	}
	for key, value := range s.versioningSnapshot() {
		components[key] = value
	}

	return s.saveCafeRatingSnapshot(
		ctx,
		cafeID,
		ratingFormulaVersion,
		final,
		reviewsCount,
		verifiedReviewsCount,
		fraudRisk,
		components,
	)
}

func (s *Service) saveCafeRatingSnapshot(
	ctx context.Context,
	cafeID string,
	formulaVersion string,
	rating float64,
	reviewsCount int,
	verifiedReviewsCount int,
	fraudRisk float64,
	components map[string]interface{},
) error {
	componentsJSON, err := json.Marshal(components)
	if err != nil {
		return err
	}

	_, err = s.repository.Pool().Exec(
		ctx,
		sqlUpsertCafeRatingSnapshot,
		cafeID,
		formulaVersion,
		roundFloat(rating, 2),
		reviewsCount,
		verifiedReviewsCount,
		roundFloat(fraudRisk, 3),
		componentsJSON,
	)
	return err
}

func (s *Service) loadCafeRatingSnapshot(ctx context.Context, cafeID string) (map[string]interface{}, error) {
	var (
		formulaVersion       string
		rating               float64
		reviewsCount         int
		verifiedReviewsCount int
		fraudRisk            float64
		componentsRaw        []byte
		computedAt           time.Time
	)

	err := s.repository.Pool().QueryRow(
		ctx,
		sqlSelectCafeRatingSnapshot,
		cafeID,
	).Scan(
		&formulaVersion,
		&rating,
		&reviewsCount,
		&verifiedReviewsCount,
		&fraudRisk,
		&componentsRaw,
		&computedAt,
	)
	if err != nil {
		return nil, err
	}

	components := map[string]interface{}{}
	if len(componentsRaw) > 0 {
		if err := json.Unmarshal(componentsRaw, &components); err != nil {
			return nil, err
		}
	}

	verifiedShare := 0.0
	if raw, ok := components["verified_share"]; ok {
		if cast, ok := raw.(float64); ok {
			verifiedShare = clamp(cast, 0, 1)
		}
	}
	if verifiedShare == 0 && reviewsCount > 0 && verifiedReviewsCount > 0 {
		verifiedShare = clamp(float64(verifiedReviewsCount)/float64(reviewsCount), 0, 1)
	}

	var bestReview interface{} = nil
	if raw, ok := components["best_review"]; ok {
		bestReview = raw
	}

	response := map[string]interface{}{
		"cafe_id":                cafeID,
		"formula_version":        formulaVersion,
		"rating":                 rating,
		"reviews_count":          reviewsCount,
		"verified_reviews_count": verifiedReviewsCount,
		"verified_share":         roundFloat(verifiedShare, 4),
		"fraud_risk":             fraudRisk,
		"best_review":            bestReview,
		"components":             components,
		"computed_at":            computedAt.UTC().Format(time.RFC3339),
	}
	s.appendVersionMetadata(response)
	return response, nil
}

func bayesianMean(localMean float64, localCount float64, globalMean float64, m float64) float64 {
	total := localCount + m
	if total <= 0 {
		return globalMean
	}
	return ((localCount / total) * localMean) + ((m / total) * globalMean)
}

func isBetterBestReviewCandidate(next bestReviewCandidate, current bestReviewCandidate) bool {
	if !almostEqual(next.HelpfulScore, current.HelpfulScore) {
		return next.HelpfulScore > current.HelpfulScore
	}
	if !almostEqual(next.QualityScore, current.QualityScore) {
		return next.QualityScore > current.QualityScore
	}
	if next.VisitVerified != current.VisitVerified {
		return next.VisitVerified
	}
	if !next.CreatedAt.Equal(current.CreatedAt) {
		return next.CreatedAt.After(current.CreatedAt)
	}
	return next.ReviewID > current.ReviewID
}

func almostEqual(a float64, b float64) bool {
	return math.Abs(a-b) < 0.0000001
}

func (s *Service) lookupUserReputationScore(ctx context.Context, userID string) (float64, error) {
	return s.lookupUserReputationScoreQuery(ctx, s.repository.Pool(), userID)
}

func (s *Service) lookupUserReputationScoreTx(ctx context.Context, tx pgx.Tx, userID string) (float64, error) {
	return s.lookupUserReputationScoreQuery(ctx, tx, userID)
}

func (s *Service) lookupUserReputationScoreQuery(ctx context.Context, q queryer, userID string) (float64, error) {
	var weightedSum float64
	err := q.QueryRow(
		ctx,
		sqlSelectUserReputationWeightedSum,
		userID,
	).Scan(&weightedSum)
	if err != nil {
		return 0, err
	}
	return clamp(100+weightedSum, 0, 1000), nil
}

func (s *Service) globalMeanRating(ctx context.Context) (float64, error) {
	var mean float64
	err := s.repository.Pool().QueryRow(
		ctx,
		sqlSelectGlobalMeanRating,
	).Scan(&mean)
	if err != nil {
		return 0, err
	}
	return clamp(mean, 1, 5), nil
}
