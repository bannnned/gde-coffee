package taste

import (
	"context"
	"encoding/json"
	"os"
	"strconv"
	"testing"
	"time"
)

type inferenceRepoStub struct {
	listInferenceTaxonomyFn      func(ctx context.Context) ([]InferenceTaxonomyTag, error)
	listInferenceReviewSignalsFn func(ctx context.Context, userID string, since time.Time, limit int) ([]InferenceReviewSignal, error)
	listInferenceFeedbackFn      func(ctx context.Context, userID string, since time.Time) ([]InferenceHypothesisFeedback, error)
	listAllHypothesesFn          func(ctx context.Context, userID string) ([]TasteHypothesis, error)
	listUsersReviewDrivenFn      func(ctx context.Context, limit int) ([]string, error)
	listUsersNightlyFn           func(ctx context.Context, staleBefore time.Time, limit int) ([]string, error)
	tryAcquireLockFn             func(ctx context.Context, userID string) (bool, error)
	releaseLockFn                func(ctx context.Context, userID string)
	touchProfileFn               func(ctx context.Context, userID string, inferenceVersion string, recomputedAt time.Time) (UserTasteProfile, error)
	listActiveTagsFn             func(ctx context.Context, userID string) ([]UserTasteTag, error)
	upsertTagFn                  func(ctx context.Context, params UpsertUserTasteTagParams) (UserTasteTag, error)
	createHypothesisFn           func(ctx context.Context, params CreateTasteHypothesisParams) (TasteHypothesis, error)
	updateHypothesisStatusFn     func(ctx context.Context, params UpdateTasteHypothesisStatusParams) (TasteHypothesis, error)
	createInferenceRunFn         func(ctx context.Context, params CreateTasteInferenceRunParams) (TasteInferenceRun, error)

	createOnboardingSessionFn     func(ctx context.Context, userID string, version string) (OnboardingSession, error)
	completeOnboardingSessionFn   func(ctx context.Context, sessionID string, userID string, answers json.RawMessage, completedAt time.Time) (OnboardingSession, error)
	getUserTasteProfileFn         func(ctx context.Context, userID string) (UserTasteProfile, error)
	listActionableHypothesesFn    func(ctx context.Context, userID string) ([]TasteHypothesis, error)
	getHypothesisByIDFn           func(ctx context.Context, hypothesisID string, userID string) (TasteHypothesis, error)
	upsertUserTasteProfileFn      func(ctx context.Context, params UpsertUserTasteProfileParams) (UserTasteProfile, error)
	updateTasteHypothesisStatusFn func(ctx context.Context, params UpdateTasteHypothesisStatusParams) (TasteHypothesis, error)
}

func (s *inferenceRepoStub) CreateOnboardingSession(ctx context.Context, userID string, version string) (OnboardingSession, error) {
	if s.createOnboardingSessionFn != nil {
		return s.createOnboardingSessionFn(ctx, userID, version)
	}
	return OnboardingSession{}, nil
}

func (s *inferenceRepoStub) CompleteOnboardingSession(ctx context.Context, sessionID string, userID string, answers json.RawMessage, completedAt time.Time) (OnboardingSession, error) {
	if s.completeOnboardingSessionFn != nil {
		return s.completeOnboardingSessionFn(ctx, sessionID, userID, answers, completedAt)
	}
	return OnboardingSession{}, nil
}

func (s *inferenceRepoStub) GetUserTasteProfile(ctx context.Context, userID string) (UserTasteProfile, error) {
	if s.getUserTasteProfileFn != nil {
		return s.getUserTasteProfileFn(ctx, userID)
	}
	return UserTasteProfile{}, nil
}

func (s *inferenceRepoStub) ListActiveUserTasteTags(ctx context.Context, userID string) ([]UserTasteTag, error) {
	if s.listActiveTagsFn != nil {
		return s.listActiveTagsFn(ctx, userID)
	}
	return nil, nil
}

func (s *inferenceRepoStub) ListActionableTasteHypotheses(ctx context.Context, userID string) ([]TasteHypothesis, error) {
	if s.listActionableHypothesesFn != nil {
		return s.listActionableHypothesesFn(ctx, userID)
	}
	return nil, nil
}

func (s *inferenceRepoStub) GetTasteHypothesisByID(ctx context.Context, hypothesisID string, userID string) (TasteHypothesis, error) {
	if s.getHypothesisByIDFn != nil {
		return s.getHypothesisByIDFn(ctx, hypothesisID, userID)
	}
	return TasteHypothesis{}, nil
}

func (s *inferenceRepoStub) UpsertUserTasteProfile(ctx context.Context, params UpsertUserTasteProfileParams) (UserTasteProfile, error) {
	if s.upsertUserTasteProfileFn != nil {
		return s.upsertUserTasteProfileFn(ctx, params)
	}
	return UserTasteProfile{}, nil
}

func (s *inferenceRepoStub) UpsertUserTasteTag(ctx context.Context, params UpsertUserTasteTagParams) (UserTasteTag, error) {
	if s.upsertTagFn != nil {
		return s.upsertTagFn(ctx, params)
	}
	return UserTasteTag{}, nil
}

func (s *inferenceRepoStub) UpdateTasteHypothesisStatus(ctx context.Context, params UpdateTasteHypothesisStatusParams) (TasteHypothesis, error) {
	if s.updateHypothesisStatusFn != nil {
		return s.updateHypothesisStatusFn(ctx, params)
	}
	if s.updateTasteHypothesisStatusFn != nil {
		return s.updateTasteHypothesisStatusFn(ctx, params)
	}
	return TasteHypothesis{}, nil
}

func (s *inferenceRepoStub) ListInferenceTaxonomy(ctx context.Context) ([]InferenceTaxonomyTag, error) {
	if s.listInferenceTaxonomyFn != nil {
		return s.listInferenceTaxonomyFn(ctx)
	}
	return nil, nil
}

func (s *inferenceRepoStub) ListInferenceReviewSignals(ctx context.Context, userID string, since time.Time, limit int) ([]InferenceReviewSignal, error) {
	if s.listInferenceReviewSignalsFn != nil {
		return s.listInferenceReviewSignalsFn(ctx, userID, since, limit)
	}
	return nil, nil
}

func (s *inferenceRepoStub) ListInferenceHypothesisFeedback(ctx context.Context, userID string, since time.Time) ([]InferenceHypothesisFeedback, error) {
	if s.listInferenceFeedbackFn != nil {
		return s.listInferenceFeedbackFn(ctx, userID, since)
	}
	return nil, nil
}

func (s *inferenceRepoStub) ListAllUserTasteHypotheses(ctx context.Context, userID string) ([]TasteHypothesis, error) {
	if s.listAllHypothesesFn != nil {
		return s.listAllHypothesesFn(ctx, userID)
	}
	return nil, nil
}

func (s *inferenceRepoStub) ListUsersNeedingReviewInference(ctx context.Context, limit int) ([]string, error) {
	if s.listUsersReviewDrivenFn != nil {
		return s.listUsersReviewDrivenFn(ctx, limit)
	}
	return nil, nil
}

func (s *inferenceRepoStub) ListUsersNeedingNightlyInference(ctx context.Context, staleBefore time.Time, limit int) ([]string, error) {
	if s.listUsersNightlyFn != nil {
		return s.listUsersNightlyFn(ctx, staleBefore, limit)
	}
	return nil, nil
}

func (s *inferenceRepoStub) TryAcquireUserInferenceLock(ctx context.Context, userID string) (bool, error) {
	if s.tryAcquireLockFn != nil {
		return s.tryAcquireLockFn(ctx, userID)
	}
	return true, nil
}

func (s *inferenceRepoStub) ReleaseUserInferenceLock(ctx context.Context, userID string) {
	if s.releaseLockFn != nil {
		s.releaseLockFn(ctx, userID)
	}
}

func (s *inferenceRepoStub) TouchUserTasteProfileRecomputed(ctx context.Context, userID string, inferenceVersion string, recomputedAt time.Time) (UserTasteProfile, error) {
	if s.touchProfileFn != nil {
		return s.touchProfileFn(ctx, userID, inferenceVersion, recomputedAt)
	}
	return UserTasteProfile{}, nil
}

func (s *inferenceRepoStub) CreateTasteHypothesis(ctx context.Context, params CreateTasteHypothesisParams) (TasteHypothesis, error) {
	if s.createHypothesisFn != nil {
		return s.createHypothesisFn(ctx, params)
	}
	return TasteHypothesis{}, nil
}

func (s *inferenceRepoStub) CreateTasteInferenceRun(ctx context.Context, params CreateTasteInferenceRunParams) (TasteInferenceRun, error) {
	if s.createInferenceRunFn != nil {
		return s.createInferenceRunFn(ctx, params)
	}
	return TasteInferenceRun{}, nil
}

func TestBuildInferenceCandidates_RespectsThresholdAndPolarity(t *testing.T) {
	taxonomy := map[string]InferenceTaxonomyTag{
		"citrus":   {Code: "citrus", AllowsNegative: true},
		"espresso": {Code: "espresso", AllowsNegative: false},
	}
	acc := map[string]*inferenceAccumulator{
		"citrus":   {Raw: -1.8, Count: 6, ReviewSignals: 6},
		"espresso": {Raw: -0.8, Count: 4, ReviewSignals: 4},
	}

	candidates := buildInferenceCandidates(acc, taxonomy, nil)
	if len(candidates) != 2 {
		t.Fatalf("expected 2 candidates, got %d", len(candidates))
	}

	var (
		citrusFound   bool
		espressoFound bool
	)
	for _, item := range candidates {
		switch item.TasteCode {
		case "citrus":
			citrusFound = true
			if item.Polarity != PolarityNegative {
				t.Fatalf("expected citrus negative, got %q", item.Polarity)
			}
		case "espresso":
			espressoFound = true
			if item.Polarity != PolarityPositive {
				t.Fatalf("expected espresso positive fallback, got %q", item.Polarity)
			}
		}
	}
	if !citrusFound || !espressoFound {
		t.Fatalf("expected both citrus and espresso candidates")
	}
}

func TestRunInference_FullRecomputeLifecycle(t *testing.T) {
	if err := os.Setenv("TASTE_INFERENCE_V1_ENABLED", "true"); err != nil {
		t.Fatalf("set env: %v", err)
	}
	t.Cleanup(func() { _ = os.Unsetenv("TASTE_INFERENCE_V1_ENABLED") })

	now := time.Now().UTC().Round(time.Second)
	createdHypotheses := 0
	expiredHypotheses := 0
	upsertedTags := 0
	profileTouched := false
	createdRun := false

	reviewSignals := make([]InferenceReviewSignal, 0, 5)
	for i := 0; i < 5; i++ {
		reviewSignals = append(reviewSignals, InferenceReviewSignal{
			ReviewID:        "r" + strconv.Itoa(i+1),
			Rating:          5,
			DrinkID:         "espresso",
			DrinkName:       "espresso",
			TasteTags:       []string{"citrus"},
			Summary:         "яркий цитрус",
			VisitConfidence: "high",
			VisitVerified:   true,
			UpdatedAt:       now,
		})
	}

	svc := &Service{
		repository: &inferenceRepoStub{
			listInferenceTaxonomyFn: func(_ context.Context) ([]InferenceTaxonomyTag, error) {
				return []InferenceTaxonomyTag{
					{Code: "citrus", AllowsNegative: true},
					{Code: "espresso", AllowsNegative: false},
					{Code: "hot", AllowsNegative: false},
				}, nil
			},
			listInferenceReviewSignalsFn: func(_ context.Context, _ string, _ time.Time, _ int) ([]InferenceReviewSignal, error) {
				return reviewSignals, nil
			},
			listInferenceFeedbackFn: func(_ context.Context, _ string, _ time.Time) ([]InferenceHypothesisFeedback, error) {
				return nil, nil
			},
			listActiveTagsFn: func(_ context.Context, _ string) ([]UserTasteTag, error) {
				return nil, nil
			},
			listAllHypothesesFn: func(_ context.Context, _ string) ([]TasteHypothesis, error) {
				return []TasteHypothesis{{
					ID:           "h-old",
					UserID:       "u1",
					TasteCode:    "nutty_cocoa",
					Polarity:     PolarityPositive,
					Status:       HypothesisStatusNew,
					DismissCount: 0,
					UpdatedAt:    now.Add(-24 * time.Hour),
				}}, nil
			},
			upsertTagFn: func(_ context.Context, params UpsertUserTasteTagParams) (UserTasteTag, error) {
				upsertedTags++
				return UserTasteTag{TasteCode: params.TasteCode, Polarity: params.Polarity}, nil
			},
			createHypothesisFn: func(_ context.Context, params CreateTasteHypothesisParams) (TasteHypothesis, error) {
				createdHypotheses++
				return TasteHypothesis{ID: "h-new", TasteCode: params.TasteCode, Polarity: params.Polarity, Status: params.Status}, nil
			},
			updateHypothesisStatusFn: func(_ context.Context, params UpdateTasteHypothesisStatusParams) (TasteHypothesis, error) {
				if params.Status == HypothesisStatusExpired {
					expiredHypotheses++
				}
				return TasteHypothesis{ID: params.ID, Status: params.Status}, nil
			},
			touchProfileFn: func(_ context.Context, _ string, _ string, _ time.Time) (UserTasteProfile, error) {
				profileTouched = true
				return UserTasteProfile{}, nil
			},
			createInferenceRunFn: func(_ context.Context, params CreateTasteInferenceRunParams) (TasteInferenceRun, error) {
				createdRun = true
				if params.Status != RunStatusOK {
					t.Fatalf("expected successful run status, got %q", params.Status)
				}
				if params.ChangedTagsCount <= 0 {
					t.Fatalf("expected changed tags > 0")
				}
				return TasteInferenceRun{ID: "run-1", UserID: "u1", Trigger: params.Trigger, Status: params.Status}, nil
			},
		},
	}

	run, err := svc.RunInference(context.Background(), "u1", "review_activity")
	if err != nil {
		t.Fatalf("RunInference error: %v", err)
	}
	if run.ID != "run-1" {
		t.Fatalf("unexpected run id: %q", run.ID)
	}
	if upsertedTags == 0 {
		t.Fatalf("expected at least one upserted tag")
	}
	if createdHypotheses == 0 {
		t.Fatalf("expected at least one created hypothesis")
	}
	if expiredHypotheses == 0 {
		t.Fatalf("expected at least one expired hypothesis")
	}
	if !profileTouched {
		t.Fatalf("expected profile recompute touch")
	}
	if !createdRun {
		t.Fatalf("expected inference run log creation")
	}
}
