package reviews

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"sort"
	"strings"
	"time"

	"backend/internal/reputation"

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
	coalesce(ra.taste_tags, '{}'::text[]),
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

	sqlSelectUserReputationEvents = `select
	id,
	event_type,
	points::float8,
	created_at
from reputation_events
where user_id = $1::uuid
order by created_at asc, id asc`

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

type cafeSemanticTag struct {
	Key          string  `json:"key"`
	Label        string  `json:"label"`
	Type         string  `json:"type"`
	Category     string  `json:"category"`
	Score        float64 `json:"score"`
	SupportCount int     `json:"support_count"`
	Source       string  `json:"source"`
}

type ratingRecalculateOptions struct {
	ForceAISummary bool
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

func (s *Service) ForceRecalculateCafeRatingSnapshot(
	ctx context.Context,
	cafeID string,
) (map[string]interface{}, error) {
	if err := s.recalculateCafeRatingSnapshotWithOptions(ctx, cafeID, ratingRecalculateOptions{
		ForceAISummary: true,
	}); err != nil {
		return nil, err
	}
	return s.loadCafeRatingSnapshot(ctx, cafeID)
}

func (s *Service) recalculateCafeRatingSnapshot(ctx context.Context, cafeID string) error {
	return s.recalculateCafeRatingSnapshotWithOptions(ctx, cafeID, ratingRecalculateOptions{})
}

func (s *Service) recalculateCafeRatingSnapshotWithOptions(
	ctx context.Context,
	cafeID string,
	options ratingRecalculateOptions,
) error {
	type reviewInput struct {
		ReviewID         string
		AuthorUserID     string
		AuthorName       string
		Rating           float64
		Summary          string
		DrinkID          string
		TasteTags        []string
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
			&item.TasteTags,
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

	previousSnapshot, previousSnapshotErr := s.loadCafeRatingSnapshot(ctx, cafeID)
	previousAIState := extractAISummaryState(previousSnapshot, previousSnapshotErr)
	nowUTC := time.Now().UTC()
	shouldAttemptAI, aiAttemptReason, nextAllowedAt := decideAISummaryAttempt(
		s.aiSummaryCfg,
		previousAIState,
		options.ForceAISummary,
		nowUTC,
	)

	globalMean, err := s.globalMeanRating(ctx)
	if err != nil {
		return err
	}
	ratingFormulaVersion := s.versioning.RatingFormula
	qualityFormulaVersion := s.versioning.QualityFormula

	if len(reviews) == 0 {
		aiStatus := "skipped"
		aiReason := "no_reviews"
		if options.ForceAISummary {
			aiReason = "no_reviews_manual"
		}
		aiSummaryPayload := map[string]interface{}{
			"enabled": s.aiSummaryCfg.Enabled,
			"status":  aiStatus,
			"reason":  aiReason,
		}
		if !nextAllowedAt.IsZero() {
			aiSummaryPayload["next_allowed_at"] = nextAllowedAt.UTC().Format(time.RFC3339)
		}
		if !previousAIState.GeneratedAt.IsZero() {
			aiSummaryPayload["last_generated_at"] = previousAIState.GeneratedAt.UTC().Format(time.RFC3339)
		}
		components := map[string]interface{}{
			"global_mean":             roundFloat(globalMean, 4),
			"reason":                  "no_reviews",
			"bayesian_m":              ratingBayesianM,
			"trust_coeff_a":           ratingTrustCoeffVerifiedShare,
			"trust_coeff_b":           ratingTrustCoeffAuthorRepNorm,
			"trust_coeff_c":           ratingTrustCoeffFraudRisk,
			"verified_share":          0.0,
			"author_rep_avg_norm":     0.0,
			"trust":                   1.0,
			"best_review":             nil,
			"descriptive_tags":        []cafeSemanticTag{},
			"descriptive_tags_source": "rules_v1",
			"specific_tags":           []cafeSemanticTag{},
			"ai_summary":              aiSummaryPayload,
			"rating_formula":          ratingFormulaVersion,
			"quality_formula":         qualityFormulaVersion,
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
	aiSignals := make([]aiReviewSignal, 0, len(reviews))
	specificTagStats := map[string]*cafeSemanticTag{}

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
		tagWeight := scoreWeightForTagSignals(
			item.HelpfulScore,
			qualityScore,
			item.VisitVerified,
			item.ConfirmedReports,
		)
		appendSpecificTagSignal(specificTagStats, "drink:"+item.DrinkID, item.DrinkID, "drink", tagWeight)
		for _, tasteTag := range item.TasteTags {
			appendSpecificTagSignal(specificTagStats, "taste:"+tasteTag, tasteTag, "taste", tagWeight)
		}
		aiSignals = append(aiSignals, aiReviewSignal{
			ReviewID:      item.ReviewID,
			Rating:        item.Rating,
			Summary:       item.Summary,
			TasteTags:     item.TasteTags,
			HelpfulScore:  item.HelpfulScore,
			VisitVerified: item.VisitVerified,
			CreatedAt:     item.CreatedAt,
		})

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
	descriptiveTags := buildDescriptiveCafeTags(
		reviewsCount,
		verifiedReviewsCount,
		ratingsMean,
		verifiedShare,
		fraudRisk,
	)
	descriptiveTagsSource := "rules_v1"
	aiSummaryPayload := map[string]interface{}{
		"enabled": s.aiSummaryCfg.Enabled,
		"status":  "disabled",
	}

	if !s.aiSummaryCfg.Enabled {
		aiSummaryPayload["reason"] = "disabled"
	} else if !shouldAttemptAI {
		if previousAIState.Reusable {
			descriptiveTags = previousAIState.DescriptiveTags
			descriptiveTagsSource = "timeweb_ai_v1"
			aiSummaryPayload = cloneMap(previousAIState.Payload)
			aiSummaryPayload["enabled"] = true
			aiSummaryPayload["status"] = "cooldown"
			aiSummaryPayload["reason"] = aiAttemptReason
			if !nextAllowedAt.IsZero() {
				aiSummaryPayload["next_allowed_at"] = nextAllowedAt.UTC().Format(time.RFC3339)
			}
		} else {
			aiSummaryPayload["status"] = "fallback_rules"
			aiSummaryPayload["reason"] = aiAttemptReason
			if !nextAllowedAt.IsZero() {
				aiSummaryPayload["next_allowed_at"] = nextAllowedAt.UTC().Format(time.RFC3339)
			}
		}
	} else {
		aiSummaryPayload["status"] = "fallback_rules"
		aiSummaryPayload["reason"] = "ai_error"
		aiSummaryResult, aiErr := s.generateAIReviewSummary(ctx, cafeID, aiSignals)
		if aiErr == nil && aiSummaryResult != nil && len(aiSummaryResult.Tags) > 0 {
			descriptiveTags = buildAIDescriptiveCafeTags(aiSummaryResult.Tags, reviewsCount)
			descriptiveTagsSource = "timeweb_ai_v1"
			aiSummaryPayload = map[string]interface{}{
				"enabled":         true,
				"status":          "ok",
				"summary_short":   aiSummaryResult.SummaryShort,
				"tags":            aiSummaryResult.Tags,
				"used_reviews":    aiSummaryResult.UsedReviews,
				"generated_at":    nowUTC.Format(time.RFC3339),
				"cadence_hours":   int(aiSummaryCadence / time.Hour),
				"next_allowed_at": nowUTC.Add(aiSummaryCadence).Format(time.RFC3339),
				"force":           options.ForceAISummary,
			}
		} else if aiErr != nil {
			aiSummaryPayload["reason"] = truncateText(aiErr.Error(), 140)
			if previousAIState.Reusable {
				descriptiveTags = previousAIState.DescriptiveTags
				descriptiveTagsSource = "timeweb_ai_v1"
				aiSummaryPayload["status"] = "fallback_previous"
			}
		}
	}
	specificTags := buildTopSpecificCafeTags(specificTagStats, 8)

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
		"global_mean":             roundFloat(globalMean, 4),
		"ratings_mean":            roundFloat(ratingsMean, 4),
		"bayesian_base":           roundFloat(base, 4),
		"bayesian_m":              ratingBayesianM,
		"verified_share":          roundFloat(verifiedShare, 4),
		"author_rep_avg_norm":     roundFloat(authorRepAvgNorm, 4),
		"trust":                   roundFloat(trust, 4),
		"trust_coeff_a":           ratingTrustCoeffVerifiedShare,
		"trust_coeff_b":           ratingTrustCoeffAuthorRepNorm,
		"trust_coeff_c":           ratingTrustCoeffFraudRisk,
		"fraud_risk":              roundFloat(fraudRisk, 4),
		"flagged_reviews":         flaggedReviewsCount,
		"confirmed_reports":       confirmedReports,
		"rating_formula":          ratingFormulaVersion,
		"quality_formula":         qualityFormulaVersion,
		"verified_reviews":        verifiedReviewsCount,
		"published_reviews":       reviewsCount,
		"best_review":             bestReviewPayload,
		"descriptive_tags":        descriptiveTags,
		"descriptive_tags_source": descriptiveTagsSource,
		"specific_tags":           specificTags,
		"ai_summary":              aiSummaryPayload,
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
	descriptiveTags := sanitizeCafeSemanticTags(components["descriptive_tags"], "descriptive")
	specificTags := sanitizeCafeSemanticTags(components["specific_tags"], "specific")

	response := map[string]interface{}{
		"cafe_id":                cafeID,
		"formula_version":        formulaVersion,
		"rating":                 rating,
		"reviews_count":          reviewsCount,
		"verified_reviews_count": verifiedReviewsCount,
		"verified_share":         roundFloat(verifiedShare, 4),
		"fraud_risk":             fraudRisk,
		"best_review":            bestReview,
		"descriptive_tags":       descriptiveTags,
		"specific_tags":          specificTags,
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

func scoreWeightForTagSignals(helpfulScore float64, qualityScore float64, visitVerified bool, confirmedReports int) float64 {
	weight := 1.0 + clamp(helpfulScore, 0, 10)/4.0 + clamp(qualityScore, 0, 100)/180.0
	if visitVerified {
		weight += 0.6
	}
	if confirmedReports > 0 {
		weight -= clamp(float64(confirmedReports)*0.25, 0, 0.8)
	}
	if weight < 0.3 {
		return 0.3
	}
	return roundFloat(weight, 4)
}

func appendSpecificTagSignal(
	target map[string]*cafeSemanticTag,
	rawKey string,
	rawLabel string,
	category string,
	weight float64,
) {
	key := normalizeSemanticTagToken(rawKey)
	label := normalizeSemanticTagLabel(rawLabel)
	if key == "" || label == "" {
		return
	}
	current, ok := target[key]
	if !ok {
		target[key] = &cafeSemanticTag{
			Key:          key,
			Label:        label,
			Type:         "specific",
			Category:     category,
			Score:        weight,
			SupportCount: 1,
			Source:       "rules_v1",
		}
		return
	}
	current.SupportCount++
	current.Score = roundFloat(current.Score+weight, 4)
}

func buildTopSpecificCafeTags(target map[string]*cafeSemanticTag, limit int) []cafeSemanticTag {
	if limit <= 0 || len(target) == 0 {
		return []cafeSemanticTag{}
	}
	items := make([]cafeSemanticTag, 0, len(target))
	for _, item := range target {
		if item == nil {
			continue
		}
		next := *item
		next.Score = roundFloat(next.Score, 3)
		items = append(items, next)
	}
	sort.SliceStable(items, func(i, j int) bool {
		if !almostEqual(items[i].Score, items[j].Score) {
			return items[i].Score > items[j].Score
		}
		if items[i].SupportCount != items[j].SupportCount {
			return items[i].SupportCount > items[j].SupportCount
		}
		return items[i].Label < items[j].Label
	})
	if len(items) > limit {
		items = items[:limit]
	}
	return items
}

func buildDescriptiveCafeTags(
	reviewsCount int,
	verifiedReviewsCount int,
	ratingsMean float64,
	verifiedShare float64,
	fraudRisk float64,
) []cafeSemanticTag {
	tags := make([]cafeSemanticTag, 0, 4)
	appendTag := func(key, label, category string, score float64, support int) {
		tags = append(tags, cafeSemanticTag{
			Key:          key,
			Label:        label,
			Type:         "descriptive",
			Category:     category,
			Score:        roundFloat(score, 3),
			SupportCount: support,
			Source:       "rules_v1",
		})
	}

	if ratingsMean >= 4.4 && reviewsCount >= 5 {
		appendTag("stable_quality", "стабильное качество", "quality", ratingsMean, reviewsCount)
	}
	if verifiedShare >= 0.35 && verifiedReviewsCount >= 3 {
		appendTag(
			"verified_visits",
			"проверенные визиты",
			"trust",
			verifiedShare*100,
			verifiedReviewsCount,
		)
	}
	if reviewsCount >= 15 {
		appendTag("many_reviews", "много отзывов", "social_proof", float64(reviewsCount), reviewsCount)
	}
	if fraudRisk <= 0.08 && reviewsCount >= 8 {
		appendTag(
			"reliable_feedback",
			"надежные отзывы",
			"trust",
			(1-fraudRisk)*100,
			reviewsCount,
		)
	}

	if len(tags) == 0 {
		return []cafeSemanticTag{}
	}
	sort.SliceStable(tags, func(i, j int) bool {
		if !almostEqual(tags[i].Score, tags[j].Score) {
			return tags[i].Score > tags[j].Score
		}
		return tags[i].Label < tags[j].Label
	})
	return tags
}

func sanitizeCafeSemanticTags(raw interface{}, fallbackType string) []cafeSemanticTag {
	if raw == nil {
		return []cafeSemanticTag{}
	}

	rawItems, ok := raw.([]interface{})
	if !ok {
		return []cafeSemanticTag{}
	}

	result := make([]cafeSemanticTag, 0, len(rawItems))
	for _, item := range rawItems {
		rec, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		key := normalizeSemanticTagToken(toStringSafe(rec["key"]))
		label := normalizeSemanticTagLabel(toStringSafe(rec["label"]))
		if key == "" || label == "" {
			continue
		}
		tagType := normalizeSemanticTagToken(toStringSafe(rec["type"]))
		if tagType == "" {
			tagType = fallbackType
		}
		category := normalizeSemanticTagToken(toStringSafe(rec["category"]))
		if category == "" {
			category = "other"
		}
		result = append(result, cafeSemanticTag{
			Key:          key,
			Label:        label,
			Type:         tagType,
			Category:     category,
			Score:        roundFloat(toFloatSafe(rec["score"]), 3),
			SupportCount: int(math.Max(0, math.Round(toFloatSafe(rec["support_count"])))),
			Source:       normalizeSemanticTagToken(toStringSafe(rec["source"])),
		})
	}
	return result
}

func normalizeSemanticTagToken(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return ""
	}
	parts := strings.Fields(trimmed)
	return strings.Join(parts, " ")
}

func normalizeSemanticTagLabel(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	parts := strings.Fields(trimmed)
	if len(parts) == 0 {
		return ""
	}
	return strings.Join(parts, " ")
}

func toStringSafe(value interface{}) string {
	cast, ok := value.(string)
	if !ok {
		return ""
	}
	return cast
}

func toFloatSafe(value interface{}) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	case int32:
		return float64(typed)
	default:
		return 0
	}
}

func (s *Service) lookupUserReputationScore(ctx context.Context, userID string) (float64, error) {
	return s.lookupUserReputationScoreQuery(ctx, s.repository.Pool(), userID)
}

func (s *Service) lookupUserReputationScoreTx(ctx context.Context, tx pgx.Tx, userID string) (float64, error) {
	return s.lookupUserReputationScoreQuery(ctx, tx, userID)
}

func (s *Service) lookupUserReputationScoreQuery(ctx context.Context, q queryer, userID string) (float64, error) {
	rows, err := q.Query(ctx, sqlSelectUserReputationEvents, userID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	events := make([]reputation.ScoreEvent, 0, 64)
	for rows.Next() {
		var (
			id        int64
			eventType string
			points    float64
			createdAt time.Time
		)
		if err := rows.Scan(&id, &eventType, &points, &createdAt); err != nil {
			return 0, err
		}
		events = append(events, reputation.ScoreEvent{
			ID:        id,
			EventType: eventType,
			Points:    points,
			CreatedAt: createdAt,
		})
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	return reputation.ComputeScore(events, time.Now().UTC()), nil
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
