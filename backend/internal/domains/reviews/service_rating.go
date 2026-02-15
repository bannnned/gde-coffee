package reviews

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
)

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
		Rating           float64
		AgeDays          float64
		DrinkName        string
		TagsCount        int
		SummaryLength    int
		PhotoCount       int
		VisitConfidence  string
		ConfirmedReports int
	}

	reviews := make([]reviewInput, 0, 32)
	rows, err := s.repository.Pool().Query(
		ctx,
		`select
			r.id::text,
			r.user_id::text,
			r.rating::float8,
			extract(epoch from (now() - r.updated_at)) / 86400.0 as age_days,
			coalesce(ra.drink_name, ''),
			coalesce(cardinality(ra.taste_tags), 0),
			coalesce(ra.summary_length, 0),
			coalesce(ra.photo_count, 0),
			coalesce(vv.confidence, 'none'),
			coalesce((
				select count(*)
				  from abuse_reports ar
				 where ar.review_id = r.id and ar.status = 'confirmed'
			), 0)
		from reviews r
		left join review_attributes ra on ra.review_id = r.id
		left join visit_verifications vv on vv.review_id = r.id
		where r.cafe_id = $1::uuid and r.status = 'published'`,
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
			&item.Rating,
			&item.AgeDays,
			&item.DrinkName,
			&item.TagsCount,
			&item.SummaryLength,
			&item.PhotoCount,
			&item.VisitConfidence,
			&item.ConfirmedReports,
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

	if len(reviews) == 0 {
		return s.saveCafeRatingSnapshot(ctx, cafeID, 0, 0, 0, 0, map[string]interface{}{
			"global_mean": globalMean,
			"reason":      "no_reviews",
		})
	}

	authorRepCache := map[string]float64{}
	uniqueAuthors := make([]string, 0, len(reviews))
	seenAuthors := map[string]struct{}{}
	for _, item := range reviews {
		if _, ok := seenAuthors[item.AuthorUserID]; ok {
			continue
		}
		seenAuthors[item.AuthorUserID] = struct{}{}
		uniqueAuthors = append(uniqueAuthors, item.AuthorUserID)
	}
	sort.Strings(uniqueAuthors)
	for _, userID := range uniqueAuthors {
		rep, err := s.lookupUserReputationScore(ctx, userID)
		if err != nil {
			return err
		}
		authorRepCache[userID] = rep
	}

	var (
		sumWeightedRatings   float64
		sumWeights           float64
		verifiedReviewsCount int
		confirmedReports     int
	)

	for _, item := range reviews {
		authorRep := authorRepCache[item.AuthorUserID]
		visitScore := visitScoreFromConfidence(item.VisitConfidence)
		if visitScore >= 0.7 {
			verifiedReviewsCount++
		}

		qualityScore := calculateReviewQualityV1(
			item.DrinkName,
			item.TagsCount,
			item.SummaryLength,
			item.PhotoCount,
			item.VisitConfidence,
			item.ConfirmedReports,
		)
		confirmedReports += item.ConfirmedReports

		// rating_v1 weight model:
		// w_i = time_i * quality_i * author_i * visit_i
		// This makes fresh, detailed and trustworthy reviews influence ranking more.
		timeWeight := math.Exp(-math.Ln2 * clamp(item.AgeDays, 0, 3650) / 180.0)
		qualityWeight := 0.8 + 0.4*(qualityScore/100.0)
		authorWeight := 0.85 + 0.3*(authorRep/1000.0)
		visitWeight := 1.0 + 0.15*visitScore
		weight := timeWeight * qualityWeight * authorWeight * visitWeight

		sumWeights += weight
		sumWeightedRatings += weight * item.Rating
	}

	mu := globalMean
	if sumWeights > 0 {
		mu = sumWeightedRatings / sumWeights
	}

	// Bayesian smoothing keeps low-sample cafes from jumping too high/low.
	const m = 20.0
	base := (sumWeights/(sumWeights+m))*mu + (m/(sumWeights+m))*globalMean

	fraudRisk := clamp(float64(confirmedReports)/float64(len(reviews)), 0, 1)
	final := clamp(base-0.6*fraudRisk, 1, 5)

	components := map[string]interface{}{
		"global_mean":       roundFloat(globalMean, 4),
		"weighted_mean":     roundFloat(mu, 4),
		"effective_reviews": roundFloat(sumWeights, 4),
		"bayesian_base":     roundFloat(base, 4),
		"fraud_risk":        roundFloat(fraudRisk, 4),
		"confirmed_reports": confirmedReports,
		"formula_version":   RatingFormulaVersion,
		"verified_reviews":  verifiedReviewsCount,
		"published_reviews": len(reviews),
	}

	return s.saveCafeRatingSnapshot(ctx, cafeID, final, len(reviews), verifiedReviewsCount, fraudRisk, components)
}

func (s *Service) saveCafeRatingSnapshot(
	ctx context.Context,
	cafeID string,
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
		`insert into cafe_rating_snapshots (
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
			updated_at = now()`,
		cafeID,
		RatingFormulaVersion,
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
		`select formula_version,
		        rating::float8,
		        reviews_count,
		        verified_reviews_count,
		        fraud_risk::float8,
		        components,
		        computed_at
		   from cafe_rating_snapshots
		  where cafe_id = $1::uuid`,
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

	return map[string]interface{}{
		"cafe_id":                cafeID,
		"formula_version":        formulaVersion,
		"rating":                 rating,
		"reviews_count":          reviewsCount,
		"verified_reviews_count": verifiedReviewsCount,
		"fraud_risk":             fraudRisk,
		"components":             components,
		"computed_at":            computedAt.UTC().Format(time.RFC3339),
	}, nil
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
		`select coalesce(sum(
			case
				when created_at >= now() - interval '365 days' then points::numeric
				else points::numeric * 0.5
			end
		), 0)::float8
		from reputation_events
		where user_id = $1::uuid`,
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
		`select coalesce(avg(rating)::float8, 4.0)
		   from reviews
		  where status = 'published'`,
	).Scan(&mean)
	if err != nil {
		return 0, err
	}
	return clamp(mean, 1, 5), nil
}
