package taste

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	inferenceLookbackDays       = 365
	inferenceReviewSignalsLimit = 300
)

type inferenceRepository interface {
	ListInferenceTaxonomy(ctx context.Context) ([]InferenceTaxonomyTag, error)
	ListInferenceReviewSignals(ctx context.Context, userID string, since time.Time, limit int) ([]InferenceReviewSignal, error)
	ListInferenceHypothesisFeedback(ctx context.Context, userID string, since time.Time) ([]InferenceHypothesisFeedback, error)
	ListAllUserTasteHypotheses(ctx context.Context, userID string) ([]TasteHypothesis, error)
	ListUsersNeedingReviewInference(ctx context.Context, limit int) ([]string, error)
	ListUsersNeedingNightlyInference(ctx context.Context, staleBefore time.Time, limit int) ([]string, error)
	TryAcquireUserInferenceLock(ctx context.Context, userID string) (bool, error)
	ReleaseUserInferenceLock(ctx context.Context, userID string)
	TouchUserTasteProfileRecomputed(ctx context.Context, userID string, inferenceVersion string, recomputedAt time.Time) (UserTasteProfile, error)
	ListActiveUserTasteTags(ctx context.Context, userID string) ([]UserTasteTag, error)
	UpsertUserTasteTag(ctx context.Context, params UpsertUserTasteTagParams) (UserTasteTag, error)
	CreateTasteHypothesis(ctx context.Context, params CreateTasteHypothesisParams) (TasteHypothesis, error)
	UpdateTasteHypothesisStatus(ctx context.Context, params UpdateTasteHypothesisStatusParams) (TasteHypothesis, error)
	CreateTasteInferenceRun(ctx context.Context, params CreateTasteInferenceRunParams) (TasteInferenceRun, error)
}

type inferenceMetricRecorder interface {
	InsertTasteProfileRecomputedMetricEvent(
		ctx context.Context,
		userID string,
		runID string,
		trigger string,
		durationMS int,
		changedTags int,
		occurredAt time.Time,
	) error
}

type inferenceAccumulator struct {
	Raw             float64
	Count           int
	ReviewSignals   int
	FeedbackSignals int
}

type inferenceCandidate struct {
	TasteCode       string
	Polarity        string
	Score           float64
	Confidence      float64
	Source          string
	ReviewSignals   int
	FeedbackSignals int
}

func (s *Service) RunInference(ctx context.Context, userID string, trigger string) (TasteInferenceRun, error) {
	if !TasteInferenceEnabledFromEnv() {
		return TasteInferenceRun{}, nil
	}

	normalizedUserID := strings.TrimSpace(userID)
	if normalizedUserID == "" {
		return TasteInferenceRun{}, errValidation("user_id обязателен.")
	}

	repo, err := s.asInferenceRepository()
	if err != nil {
		return TasteInferenceRun{}, err
	}

	locked, err := repo.TryAcquireUserInferenceLock(ctx, normalizedUserID)
	if err != nil {
		return TasteInferenceRun{}, err
	}
	if !locked {
		return TasteInferenceRun{}, ErrInferenceBusy
	}
	defer repo.ReleaseUserInferenceLock(context.Background(), normalizedUserID)

	startedAt := time.Now().UTC()
	lookbackSince := startedAt.Add(-inferenceLookbackDays * 24 * time.Hour)

	inputSnapshot := map[string]any{
		"trigger":           normalizeNonEmpty(trigger, "manual"),
		"lookback_days":     inferenceLookbackDays,
		"inference_version": DefaultInferenceVersion,
	}

	taxonomyList, err := repo.ListInferenceTaxonomy(ctx)
	if err != nil {
		s.recordInferenceFailure(ctx, repo, normalizedUserID, normalizeNonEmpty(trigger, "manual"), startedAt, inputSnapshot, err)
		return TasteInferenceRun{}, err
	}
	taxonomy := mapInferenceTaxonomy(taxonomyList)

	reviewSignals, err := repo.ListInferenceReviewSignals(ctx, normalizedUserID, lookbackSince, inferenceReviewSignalsLimit)
	if err != nil {
		s.recordInferenceFailure(ctx, repo, normalizedUserID, normalizeNonEmpty(trigger, "manual"), startedAt, inputSnapshot, err)
		return TasteInferenceRun{}, err
	}

	hypothesisFeedback, err := repo.ListInferenceHypothesisFeedback(ctx, normalizedUserID, lookbackSince)
	if err != nil {
		s.recordInferenceFailure(ctx, repo, normalizedUserID, normalizeNonEmpty(trigger, "manual"), startedAt, inputSnapshot, err)
		return TasteInferenceRun{}, err
	}

	existingTags, err := repo.ListActiveUserTasteTags(ctx, normalizedUserID)
	if err != nil {
		s.recordInferenceFailure(ctx, repo, normalizedUserID, normalizeNonEmpty(trigger, "manual"), startedAt, inputSnapshot, err)
		return TasteInferenceRun{}, err
	}

	existingHypotheses, err := repo.ListAllUserTasteHypotheses(ctx, normalizedUserID)
	if err != nil {
		s.recordInferenceFailure(ctx, repo, normalizedUserID, normalizeNonEmpty(trigger, "manual"), startedAt, inputSnapshot, err)
		return TasteInferenceRun{}, err
	}

	inputSnapshot["reviews_count"] = len(reviewSignals)
	inputSnapshot["feedback_count"] = len(hypothesisFeedback)
	inputSnapshot["existing_tags_count"] = len(existingTags)
	inputSnapshot["existing_hypotheses_count"] = len(existingHypotheses)

	accumulators := buildInferenceAccumulators(taxonomy, reviewSignals, hypothesisFeedback)
	candidates := buildInferenceCandidates(accumulators, taxonomy, existingTags)

	tagsChanged := 0
	strongCandidates := make([]inferenceCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		reasonJSON, err := json.Marshal(map[string]any{
			"source":           "inference_v1",
			"trigger":          normalizeNonEmpty(trigger, "manual"),
			"review_signals":   candidate.ReviewSignals,
			"feedback_signals": candidate.FeedbackSignals,
			"lookback_days":    inferenceLookbackDays,
			"generated_at":     startedAt,
		})
		if err != nil {
			s.recordInferenceFailure(ctx, repo, normalizedUserID, normalizeNonEmpty(trigger, "manual"), startedAt, inputSnapshot, err)
			return TasteInferenceRun{}, err
		}

		_, err = repo.UpsertUserTasteTag(ctx, UpsertUserTasteTagParams{
			UserID:        normalizedUserID,
			TasteCode:     candidate.TasteCode,
			Polarity:      candidate.Polarity,
			Score:         candidate.Score,
			Confidence:    candidate.Confidence,
			Source:        candidate.Source,
			Status:        TagStatusActive,
			CooldownUntil: nil,
			ReasonJSON:    reasonJSON,
		})
		if err != nil {
			s.recordInferenceFailure(ctx, repo, normalizedUserID, normalizeNonEmpty(trigger, "manual"), startedAt, inputSnapshot, err)
			return TasteInferenceRun{}, err
		}
		tagsChanged++

		if candidate.FeedbackSignals == 0 && math.Abs(candidate.Score) >= 0.35 && candidate.Confidence >= 0.55 {
			strongCandidates = append(strongCandidates, candidate)
		}
	}

	hypCreated, hypExpired, err := reconcileInferredHypotheses(ctx, repo, normalizedUserID, existingHypotheses, strongCandidates, startedAt, normalizeNonEmpty(trigger, "manual"))
	if err != nil {
		s.recordInferenceFailure(ctx, repo, normalizedUserID, normalizeNonEmpty(trigger, "manual"), startedAt, inputSnapshot, err)
		return TasteInferenceRun{}, err
	}

	_, err = repo.TouchUserTasteProfileRecomputed(ctx, normalizedUserID, DefaultInferenceVersion, startedAt)
	if err != nil {
		s.recordInferenceFailure(ctx, repo, normalizedUserID, normalizeNonEmpty(trigger, "manual"), startedAt, inputSnapshot, err)
		return TasteInferenceRun{}, err
	}

	outputSnapshot := map[string]any{
		"updated_tags":       tagsChanged,
		"strong_candidates":  len(strongCandidates),
		"created_hypotheses": hypCreated,
		"expired_hypotheses": hypExpired,
	}
	outputJSON, _ := json.Marshal(outputSnapshot)
	inputJSON, _ := json.Marshal(inputSnapshot)
	durationMS := int(time.Since(startedAt) / time.Millisecond)
	if durationMS < 0 {
		durationMS = 0
	}

	run, runErr := repo.CreateTasteInferenceRun(ctx, CreateTasteInferenceRunParams{
		UserID:             normalizedUserID,
		Trigger:            normalizeNonEmpty(trigger, "manual"),
		Version:            DefaultInferenceVersion,
		InputSnapshotJSON:  inputJSON,
		OutputSnapshotJSON: outputJSON,
		ChangedTagsCount:   tagsChanged,
		DurationMS:         durationMS,
		Status:             RunStatusOK,
	})
	if runErr != nil {
		slog.Warn("taste inference run log failed", "user_id", normalizedUserID, "trigger", trigger, "error", runErr)
		return TasteInferenceRun{}, nil
	}

	if recorder, ok := repo.(inferenceMetricRecorder); ok {
		if err := recorder.InsertTasteProfileRecomputedMetricEvent(
			ctx,
			normalizedUserID,
			run.ID,
			normalizeNonEmpty(trigger, "manual"),
			durationMS,
			tagsChanged,
			startedAt,
		); err != nil {
			slog.Warn(
				"taste inference metrics event failed",
				"user_id",
				normalizedUserID,
				"run_id",
				run.ID,
				"error",
				err,
			)
		}
	}

	return run, nil
}

func (s *Service) StartReviewDrivenInferenceWorker(ctx context.Context, pollInterval time.Duration, batchSize int) {
	if !TasteInferenceEnabledFromEnv() {
		return
	}
	if pollInterval <= 0 {
		pollInterval = 2 * time.Minute
	}
	if batchSize <= 0 {
		batchSize = 25
	}

	repo, err := s.asInferenceRepository()
	if err != nil {
		slog.Warn("taste review-driven worker disabled", "error", err)
		return
	}

	logger := slog.Default().With("worker_name", "taste_review_driven")
	logger.Info("worker started", "interval", pollInterval, "batch", batchSize)
	defer logger.Info("worker stopped")

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			users, err := repo.ListUsersNeedingReviewInference(ctx, batchSize)
			if err != nil {
				logger.Error("load users failed", "error", err)
				continue
			}
			for _, userID := range users {
				inferenceCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
				_, runErr := s.RunInference(inferenceCtx, userID, "review_activity")
				cancel()
				if runErr != nil && !errors.Is(runErr, ErrInferenceBusy) {
					logger.Warn("run inference failed", "user_id", userID, "error", runErr)
				}
			}
		}
	}
}

func (s *Service) StartNightlyInferenceWorker(ctx context.Context, pollInterval time.Duration, batchSize int, nightlyHourUTC int) {
	if !TasteInferenceEnabledFromEnv() {
		return
	}
	if pollInterval <= 0 {
		pollInterval = 30 * time.Minute
	}
	if batchSize <= 0 {
		batchSize = 100
	}
	if nightlyHourUTC < 0 || nightlyHourUTC > 23 {
		nightlyHourUTC = 3
	}

	repo, err := s.asInferenceRepository()
	if err != nil {
		slog.Warn("taste nightly worker disabled", "error", err)
		return
	}

	logger := slog.Default().With("worker_name", "taste_nightly")
	logger.Info("worker started", "interval", pollInterval, "batch", batchSize, "hour_utc", nightlyHourUTC)
	defer logger.Info("worker stopped")

	var lastRunDate string
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			now := time.Now().UTC()
			if now.Hour() != nightlyHourUTC {
				continue
			}
			dateKey := now.Format("2006-01-02")
			if dateKey == lastRunDate {
				continue
			}

			staleBefore := now.Add(-24 * time.Hour)
			processed := 0
			for {
				users, err := repo.ListUsersNeedingNightlyInference(ctx, staleBefore, batchSize)
				if err != nil {
					logger.Error("load users failed", "error", err)
					break
				}
				if len(users) == 0 {
					break
				}
				for _, userID := range users {
					inferenceCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
					_, runErr := s.RunInference(inferenceCtx, userID, "nightly_batch")
					cancel()
					if runErr != nil && !errors.Is(runErr, ErrInferenceBusy) {
						logger.Warn("run inference failed", "user_id", userID, "error", runErr)
					}
					processed++
				}
				if len(users) < batchSize {
					break
				}
			}

			lastRunDate = dateKey
			logger.Info("nightly pass finished", "processed", processed)
		}
	}
}

func (s *Service) runInferenceBestEffort(userID string, trigger string) {
	if !TasteInferenceEnabledFromEnv() {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()
	_, err := s.RunInference(ctx, userID, trigger)
	if err != nil && !errors.Is(err, ErrInferenceBusy) {
		slog.Warn("taste inference best-effort trigger failed", "user_id", userID, "trigger", trigger, "error", err)
	}
}

func (s *Service) asInferenceRepository() (inferenceRepository, error) {
	repo, ok := s.repository.(inferenceRepository)
	if !ok {
		return nil, ErrInferenceUnavailable
	}
	return repo, nil
}

func (s *Service) recordInferenceFailure(
	ctx context.Context,
	repo inferenceRepository,
	userID string,
	trigger string,
	startedAt time.Time,
	inputSnapshot map[string]any,
	runErr error,
) {
	if repo == nil {
		return
	}
	inputJSON, _ := json.Marshal(inputSnapshot)
	errorText := truncateErrorText(runErr)
	durationMS := int(time.Since(startedAt) / time.Millisecond)
	if durationMS < 0 {
		durationMS = 0
	}
	_, err := repo.CreateTasteInferenceRun(ctx, CreateTasteInferenceRunParams{
		UserID:             userID,
		Trigger:            trigger,
		Version:            DefaultInferenceVersion,
		InputSnapshotJSON:  inputJSON,
		OutputSnapshotJSON: json.RawMessage(`{"status":"failed"}`),
		ChangedTagsCount:   0,
		DurationMS:         durationMS,
		Status:             RunStatusFailed,
		ErrorText:          &errorText,
	})
	if err != nil {
		slog.Warn("failed to record taste inference failure", "user_id", userID, "trigger", trigger, "error", err)
	}
}

func buildInferenceAccumulators(
	taxonomy map[string]InferenceTaxonomyTag,
	reviews []InferenceReviewSignal,
	feedback []InferenceHypothesisFeedback,
) map[string]*inferenceAccumulator {
	acc := make(map[string]*inferenceAccumulator, len(taxonomy))

	for _, item := range reviews {
		sentiment := reviewSentimentScore(item.Rating)
		if sentiment == 0 {
			continue
		}
		visitWeight := visitConfidenceWeight(item.VisitConfidence)

		for _, code := range inferTasteCodesFromReview(item) {
			if _, ok := taxonomy[code]; !ok {
				continue
			}
			next := ensureInferenceAccumulator(acc, code)
			next.Raw += sentiment * 0.30 * visitWeight
			next.Count++
			next.ReviewSignals++
		}

		for _, code := range inferDrinkPreferenceCodes(item.DrinkID, item.DrinkName) {
			if _, ok := taxonomy[code]; !ok {
				continue
			}
			next := ensureInferenceAccumulator(acc, code)
			next.Raw += 0.18 * visitWeight
			next.Count++
			next.ReviewSignals++
		}
	}

	for _, item := range feedback {
		code := strings.TrimSpace(item.TasteCode)
		if _, ok := taxonomy[code]; !ok {
			continue
		}
		sign := polaritySign(item.Polarity)
		if sign == 0 {
			continue
		}
		weight := 0.45
		if item.Status == HypothesisStatusDismissed {
			weight = -0.45
		}
		next := ensureInferenceAccumulator(acc, code)
		next.Raw += weight * sign
		next.Count += 2
		next.FeedbackSignals++
	}

	return acc
}

func buildInferenceCandidates(
	acc map[string]*inferenceAccumulator,
	taxonomy map[string]InferenceTaxonomyTag,
	existing []UserTasteTag,
) []inferenceCandidate {
	existingByKey := make(map[string]UserTasteTag, len(existing))
	for _, item := range existing {
		existingByKey[inferenceKey(item.TasteCode, item.Polarity)] = item
	}

	result := make([]inferenceCandidate, 0, len(acc))
	for code, item := range acc {
		if item == nil || item.Count == 0 {
			continue
		}

		rawAvg := item.Raw / float64(maxInt(item.Count, 1))
		score := clampSignedValue(rawAvg * 1.8)
		if math.Abs(score) < 0.12 {
			continue
		}

		polarity := PolarityPositive
		if score < 0 {
			polarity = PolarityNegative
		}
		tax := taxonomy[code]
		if polarity == PolarityNegative && !tax.AllowsNegative {
			score = math.Abs(score) * 0.4
			polarity = PolarityPositive
			if score < 0.12 {
				continue
			}
		}

		confidence := math.Min(0.93, 0.30+0.05*float64(item.Count)+0.03*float64(item.FeedbackSignals))
		source := TagSourceBehavior
		if item.FeedbackSignals > 0 {
			source = TagSourceMixed
		}

		key := inferenceKey(code, polarity)
		if existingTag, ok := existingByKey[key]; ok && existingTag.Source == TagSourceExplicitFeedback && item.FeedbackSignals == 0 {
			if math.Abs(existingTag.Score) >= math.Abs(score) && existingTag.Confidence >= confidence {
				continue
			}
			source = TagSourceMixed
		}

		result = append(result, inferenceCandidate{
			TasteCode:       code,
			Polarity:        polarity,
			Score:           score,
			Confidence:      confidence,
			Source:          source,
			ReviewSignals:   item.ReviewSignals,
			FeedbackSignals: item.FeedbackSignals,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		left := math.Abs(result[i].Score) * result[i].Confidence
		right := math.Abs(result[j].Score) * result[j].Confidence
		if left == right {
			return result[i].TasteCode < result[j].TasteCode
		}
		return left > right
	})
	return result
}

func reconcileInferredHypotheses(
	ctx context.Context,
	repo inferenceRepository,
	userID string,
	existing []TasteHypothesis,
	candidates []inferenceCandidate,
	now time.Time,
	trigger string,
) (created int, expired int, err error) {
	latestByKey := make(map[string]TasteHypothesis, len(existing))
	for _, item := range existing {
		key := inferenceKey(item.TasteCode, item.Polarity)
		if current, ok := latestByKey[key]; ok {
			if current.UpdatedAt.After(item.UpdatedAt) {
				continue
			}
		}
		latestByKey[key] = item
	}

	desired := make(map[string]inferenceCandidate, len(candidates))
	for _, item := range candidates {
		key := inferenceKey(item.TasteCode, item.Polarity)
		desired[key] = item
	}

	keptNew := map[string]struct{}{}
	for key, item := range desired {
		existingHypothesis, hasExisting := latestByKey[key]
		if hasExisting {
			if existingHypothesis.Status == HypothesisStatusNew {
				keptNew[key] = struct{}{}
				continue
			}
			if existingHypothesis.Status == HypothesisStatusDismissed && existingHypothesis.CooldownUntil != nil && existingHypothesis.CooldownUntil.After(now) {
				continue
			}
		}

		reasonJSON, err := json.Marshal(map[string]any{
			"source":       "inference_v1",
			"trigger":      trigger,
			"reason":       "основано на поведенческих сигналах за последние 365 дней",
			"generated_at": now,
		})
		if err != nil {
			return created, expired, err
		}

		_, err = repo.CreateTasteHypothesis(ctx, CreateTasteHypothesisParams{
			UserID:        userID,
			TasteCode:     item.TasteCode,
			Polarity:      item.Polarity,
			Score:         item.Score,
			Confidence:    item.Confidence,
			ReasonJSON:    reasonJSON,
			Status:        HypothesisStatusNew,
			DismissCount:  0,
			CooldownUntil: nil,
		})
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				continue
			}
			return created, expired, err
		}
		created++
	}

	for _, item := range existing {
		if item.Status != HypothesisStatusNew {
			continue
		}
		key := inferenceKey(item.TasteCode, item.Polarity)
		if _, stillDesired := desired[key]; stillDesired {
			continue
		}
		if _, keep := keptNew[key]; keep {
			continue
		}
		reasonJSON, err := json.Marshal(map[string]any{
			"source":     "inference_v1",
			"trigger":    trigger,
			"action":     "expire",
			"expired_at": now,
		})
		if err != nil {
			return created, expired, err
		}
		_, err = repo.UpdateTasteHypothesisStatus(ctx, UpdateTasteHypothesisStatusParams{
			ID:            item.ID,
			UserID:        userID,
			Status:        HypothesisStatusExpired,
			DismissCount:  item.DismissCount,
			CooldownUntil: nil,
			ReasonJSON:    reasonJSON,
		})
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				continue
			}
			return created, expired, err
		}
		expired++
	}

	return created, expired, nil
}

func mapInferenceTaxonomy(input []InferenceTaxonomyTag) map[string]InferenceTaxonomyTag {
	result := make(map[string]InferenceTaxonomyTag, len(input))
	for _, item := range input {
		code := strings.TrimSpace(item.Code)
		if code == "" {
			continue
		}
		result[code] = item
	}
	return result
}

func inferTasteCodesFromReview(signal InferenceReviewSignal) []string {
	result := make([]string, 0, 8)
	appendCode := func(code string) {
		code = strings.TrimSpace(code)
		if code == "" {
			return
		}
		for _, existing := range result {
			if existing == code {
				return
			}
		}
		result = append(result, code)
	}

	for _, rawTag := range signal.TasteTags {
		for _, code := range mapFreeTagToTasteCodes(rawTag) {
			appendCode(code)
		}
	}

	summary := strings.ToLower(strings.TrimSpace(signal.Summary))
	for key, codes := range summaryKeywordMapping {
		if strings.Contains(summary, key) {
			for _, code := range codes {
				appendCode(code)
			}
		}
	}

	return result
}

func inferDrinkPreferenceCodes(drinkID string, drinkName string) []string {
	text := strings.ToLower(strings.TrimSpace(drinkID + " " + drinkName))
	text = strings.Join(strings.Fields(text), " ")
	if text == "" {
		return nil
	}

	result := make([]string, 0, 6)
	appendCode := func(code string) {
		for _, existing := range result {
			if existing == code {
				return
			}
		}
		result = append(result, code)
	}

	if containsAny(text, "espresso", "ristretto", "lungo", "американо", "americano") {
		appendCode("espresso")
		appendCode("black_only")
	}
	if containsAny(text, "latte", "cappuccino", "flat white", "раф", "raf", "mocha", "macchiato") {
		appendCode("milk_based")
		appendCode("milk_ok")
	}
	if containsAny(text, "filter", "v60", "pour over", "aeropress", "chemex", "воронк") {
		appendCode("filter")
		appendCode("black_only")
	}
	if containsAny(text, "cold", "iced", "cold brew", "айс") {
		appendCode("cold")
		appendCode("iced")
	} else {
		appendCode("hot")
	}
	if containsAny(text, "oat", "soy", "almond", "coconut", "раститель", "овся") {
		appendCode("plant_milk_preferred")
	}

	return result
}

func mapFreeTagToTasteCodes(raw string) []string {
	normalized := strings.ToLower(strings.TrimSpace(raw))
	normalized = strings.Join(strings.Fields(normalized), " ")
	if normalized == "" {
		return nil
	}

	if direct, ok := rawTagDirectMapping[normalized]; ok {
		return direct
	}

	result := make([]string, 0, 2)
	for key, codes := range summaryKeywordMapping {
		if strings.Contains(normalized, key) {
			result = append(result, codes...)
		}
	}

	if len(result) == 0 {
		return nil
	}
	return uniqueCodes(result)
}

func uniqueCodes(input []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(input))
	for _, code := range input {
		trimmed := strings.TrimSpace(code)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func ensureInferenceAccumulator(acc map[string]*inferenceAccumulator, code string) *inferenceAccumulator {
	item, ok := acc[code]
	if ok {
		return item
	}
	item = &inferenceAccumulator{}
	acc[code] = item
	return item
}

func inferenceKey(tasteCode string, polarity string) string {
	return strings.TrimSpace(tasteCode) + "::" + strings.TrimSpace(polarity)
}

func reviewSentimentScore(rating int) float64 {
	switch {
	case rating >= 4:
		return 1.0
	case rating == 3:
		return 0.2
	case rating <= 2:
		return -1.0
	default:
		return 0
	}
}

func visitConfidenceWeight(confidence string) float64 {
	switch strings.ToLower(strings.TrimSpace(confidence)) {
	case "high":
		return 1.25
	case "medium":
		return 1.15
	case "low":
		return 1.05
	default:
		return 1.0
	}
}

func polaritySign(polarity string) float64 {
	switch strings.TrimSpace(polarity) {
	case PolarityPositive:
		return 1
	case PolarityNegative:
		return -1
	default:
		return 0
	}
}

func clampSignedValue(value float64) float64 {
	if value > 1 {
		return 1
	}
	if value < -1 {
		return -1
	}
	return value
}

func containsAny(value string, variants ...string) bool {
	for _, variant := range variants {
		if strings.Contains(value, variant) {
			return true
		}
	}
	return false
}

func truncateErrorText(err error) string {
	if err == nil {
		return ""
	}
	text := strings.TrimSpace(err.Error())
	if len(text) <= 900 {
		return text
	}
	return text[:900]
}

var rawTagDirectMapping = map[string][]string{
	"berries":          {"fruity_berry"},
	"berry":            {"fruity_berry"},
	"fruity":           {"fruity_berry"},
	"citrus":           {"citrus"},
	"floral":           {"floral"},
	"chocolate":        {"nutty_cocoa"},
	"nutty":            {"nutty_cocoa"},
	"caramel":          {"caramel_sweet"},
	"sweet":            {"caramel_sweet", "sweetness_high"},
	"spicy":            {"spicy"},
	"bitter":           {"roasted_bitter", "bitterness_high"},
	"roasted":          {"roasted_bitter"},
	"herbal":           {"herbal_green"},
	"green":            {"herbal_green"},
	"acidity":          {"acidity_high"},
	"high-acidity":     {"acidity_high"},
	"low-acidity":      {"acidity_low"},
	"body-light":       {"body_light"},
	"body-heavy":       {"body_heavy"},
	"aftertaste-long":  {"aftertaste_long"},
	"aftertaste-short": {"aftertaste_short"},
}

var summaryKeywordMapping = map[string][]string{
	"ягод":      {"fruity_berry"},
	"фрукт":     {"fruity_berry"},
	"berry":     {"fruity_berry"},
	"citrus":    {"citrus"},
	"цитрус":    {"citrus"},
	"floral":    {"floral"},
	"цветоч":    {"floral"},
	"chocolate": {"nutty_cocoa"},
	"cocoa":     {"nutty_cocoa"},
	"орех":      {"nutty_cocoa"},
	"какао":     {"nutty_cocoa"},
	"caramel":   {"caramel_sweet"},
	"карамел":   {"caramel_sweet"},
	"sweet":     {"sweetness_high", "caramel_sweet"},
	"слад":      {"sweetness_high", "caramel_sweet"},
	"spicy":     {"spicy"},
	"прян":      {"spicy"},
	"bitter":    {"bitterness_high", "roasted_bitter"},
	"гореч":     {"bitterness_high", "roasted_bitter"},
	"roast":     {"roasted_bitter"},
	"обжар":     {"roasted_bitter"},
	"herbal":    {"herbal_green"},
	"трав":      {"herbal_green"},
	"acidity":   {"acidity_high"},
	"кислот":    {"acidity_high"},
	"тело":      {"body_heavy"},
	"body":      {"body_heavy"},
	"послевкус": {"aftertaste_long"},
}
