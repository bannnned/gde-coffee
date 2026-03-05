package taste

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

type serviceRepoStub struct {
	createOnboardingSessionFn     func(ctx context.Context, userID string, version string) (OnboardingSession, error)
	completeOnboardingSessionFn   func(ctx context.Context, sessionID string, userID string, answers json.RawMessage, completedAt time.Time) (OnboardingSession, error)
	getUserTasteProfileFn         func(ctx context.Context, userID string) (UserTasteProfile, error)
	listActiveUserTasteTagsFn     func(ctx context.Context, userID string) ([]UserTasteTag, error)
	listActionableHypothesesFn    func(ctx context.Context, userID string) ([]TasteHypothesis, error)
	getTasteHypothesisByIDFn      func(ctx context.Context, hypothesisID string, userID string) (TasteHypothesis, error)
	upsertUserTasteProfileFn      func(ctx context.Context, params UpsertUserTasteProfileParams) (UserTasteProfile, error)
	upsertUserTasteTagFn          func(ctx context.Context, params UpsertUserTasteTagParams) (UserTasteTag, error)
	updateTasteHypothesisStatusFn func(ctx context.Context, params UpdateTasteHypothesisStatusParams) (TasteHypothesis, error)
}

func (s *serviceRepoStub) CreateOnboardingSession(ctx context.Context, userID string, version string) (OnboardingSession, error) {
	if s.createOnboardingSessionFn != nil {
		return s.createOnboardingSessionFn(ctx, userID, version)
	}
	return OnboardingSession{}, nil
}

func (s *serviceRepoStub) CompleteOnboardingSession(ctx context.Context, sessionID string, userID string, answers json.RawMessage, completedAt time.Time) (OnboardingSession, error) {
	if s.completeOnboardingSessionFn != nil {
		return s.completeOnboardingSessionFn(ctx, sessionID, userID, answers, completedAt)
	}
	return OnboardingSession{}, nil
}

func (s *serviceRepoStub) GetUserTasteProfile(ctx context.Context, userID string) (UserTasteProfile, error) {
	if s.getUserTasteProfileFn != nil {
		return s.getUserTasteProfileFn(ctx, userID)
	}
	return UserTasteProfile{}, pgx.ErrNoRows
}

func (s *serviceRepoStub) ListActiveUserTasteTags(ctx context.Context, userID string) ([]UserTasteTag, error) {
	if s.listActiveUserTasteTagsFn != nil {
		return s.listActiveUserTasteTagsFn(ctx, userID)
	}
	return []UserTasteTag{}, nil
}

func (s *serviceRepoStub) ListActionableTasteHypotheses(ctx context.Context, userID string) ([]TasteHypothesis, error) {
	if s.listActionableHypothesesFn != nil {
		return s.listActionableHypothesesFn(ctx, userID)
	}
	return []TasteHypothesis{}, nil
}

func (s *serviceRepoStub) GetTasteHypothesisByID(ctx context.Context, hypothesisID string, userID string) (TasteHypothesis, error) {
	if s.getTasteHypothesisByIDFn != nil {
		return s.getTasteHypothesisByIDFn(ctx, hypothesisID, userID)
	}
	return TasteHypothesis{}, pgx.ErrNoRows
}

func (s *serviceRepoStub) UpsertUserTasteProfile(ctx context.Context, params UpsertUserTasteProfileParams) (UserTasteProfile, error) {
	if s.upsertUserTasteProfileFn != nil {
		return s.upsertUserTasteProfileFn(ctx, params)
	}
	return UserTasteProfile{}, nil
}

func (s *serviceRepoStub) UpsertUserTasteTag(ctx context.Context, params UpsertUserTasteTagParams) (UserTasteTag, error) {
	if s.upsertUserTasteTagFn != nil {
		return s.upsertUserTasteTagFn(ctx, params)
	}
	return UserTasteTag{}, nil
}

func (s *serviceRepoStub) UpdateTasteHypothesisStatus(ctx context.Context, params UpdateTasteHypothesisStatusParams) (TasteHypothesis, error) {
	if s.updateTasteHypothesisStatusFn != nil {
		return s.updateTasteHypothesisStatusFn(ctx, params)
	}
	return TasteHypothesis{}, nil
}

func TestServiceGetTasteMap_Success(t *testing.T) {
	now := time.Now().UTC().Round(time.Second)
	ver := "onboarding_v1"

	svc := &Service{
		repository: &serviceRepoStub{
			getUserTasteProfileFn: func(_ context.Context, userID string) (UserTasteProfile, error) {
				if userID != "u1" {
					t.Fatalf("unexpected user id %q", userID)
				}
				return UserTasteProfile{
					UserID:                  "u1",
					ActiveOnboardingVersion: &ver,
					InferenceVersion:        DefaultInferenceVersion,
					BaseMapCompletedAt:      &now,
					UpdatedAt:               now,
				}, nil
			},
			listActiveUserTasteTagsFn: func(_ context.Context, _ string) ([]UserTasteTag, error) {
				return []UserTasteTag{{
					TasteCode:  "nutty_cocoa",
					Polarity:   PolarityPositive,
					Score:      0.62,
					Confidence: 0.67,
					Source:     TagSourceMixed,
					UpdatedAt:  now,
				}}, nil
			},
			listActionableHypothesesFn: func(_ context.Context, _ string) ([]TasteHypothesis, error) {
				return []TasteHypothesis{{
					ID:         "h1",
					TasteCode:  "fruity_berry",
					Polarity:   PolarityNegative,
					Score:      -0.41,
					Confidence: 0.58,
					Status:     HypothesisStatusNew,
					ReasonJSON: json.RawMessage(`{"reason":"основано на 6 отзывах"}`),
					UpdatedAt:  now,
				}}, nil
			},
		},
	}

	got, err := svc.GetTasteMap(context.Background(), "u1")
	if err != nil {
		t.Fatalf("GetTasteMap error: %v", err)
	}
	if got.BaseMap.OnboardingVersion != "onboarding_v1" {
		t.Fatalf("unexpected onboarding version: %q", got.BaseMap.OnboardingVersion)
	}
	if len(got.ActiveTags) != 1 || len(got.Hypotheses) != 1 {
		t.Fatalf("unexpected payload sizes: tags=%d hypotheses=%d", len(got.ActiveTags), len(got.Hypotheses))
	}
	if got.Hypotheses[0].Reason == "" {
		t.Fatalf("expected non-empty hypothesis reason")
	}
}

func TestServiceAcceptTasteHypothesis_UpdatesTag(t *testing.T) {
	now := time.Now().UTC().Round(time.Second)
	var (
		updatedStatus string
		upsertTag     UpsertUserTasteTagParams
	)

	svc := &Service{
		repository: &serviceRepoStub{
			getTasteHypothesisByIDFn: func(_ context.Context, hypothesisID string, userID string) (TasteHypothesis, error) {
				if hypothesisID != "h1" || userID != "u1" {
					t.Fatalf("unexpected hypothesis lookup args")
				}
				return TasteHypothesis{
					ID:           "h1",
					UserID:       "u1",
					TasteCode:    "citrus",
					Polarity:     PolarityPositive,
					Score:        0.6,
					Confidence:   0.5,
					Status:       HypothesisStatusNew,
					DismissCount: 0,
				}, nil
			},
			updateTasteHypothesisStatusFn: func(_ context.Context, params UpdateTasteHypothesisStatusParams) (TasteHypothesis, error) {
				updatedStatus = params.Status
				return TasteHypothesis{ID: "h1", Status: params.Status, UpdatedAt: now}, nil
			},
			upsertUserTasteTagFn: func(_ context.Context, params UpsertUserTasteTagParams) (UserTasteTag, error) {
				upsertTag = params
				return UserTasteTag{}, nil
			},
		},
	}

	got, err := svc.AcceptTasteHypothesis(context.Background(), "u1", "h1", HypothesisFeedbackRequest{FeedbackSource: "profile_screen"})
	if err != nil {
		t.Fatalf("AcceptTasteHypothesis error: %v", err)
	}
	if got.Status != HypothesisStatusAccepted || updatedStatus != HypothesisStatusAccepted {
		t.Fatalf("expected accepted status, got response=%q update=%q", got.Status, updatedStatus)
	}
	if upsertTag.Status != TagStatusActive || upsertTag.Source != TagSourceExplicitFeedback {
		t.Fatalf("expected active explicit feedback tag, got status=%q source=%q", upsertTag.Status, upsertTag.Source)
	}
}

func TestServiceDismissTasteHypothesis_CooldownAndMute(t *testing.T) {
	now := time.Now().UTC().Round(time.Second)
	var (
		updated UpdateTasteHypothesisStatusParams
		upsert  UpsertUserTasteTagParams
	)

	svc := &Service{
		repository: &serviceRepoStub{
			getTasteHypothesisByIDFn: func(_ context.Context, _ string, _ string) (TasteHypothesis, error) {
				return TasteHypothesis{
					ID:           "h1",
					UserID:       "u1",
					TasteCode:    "fruity_berry",
					Polarity:     PolarityNegative,
					Score:        -0.4,
					Confidence:   0.58,
					Status:       HypothesisStatusNew,
					DismissCount: 1,
				}, nil
			},
			updateTasteHypothesisStatusFn: func(_ context.Context, params UpdateTasteHypothesisStatusParams) (TasteHypothesis, error) {
				updated = params
				return TasteHypothesis{ID: "h1", Status: params.Status, CooldownUntil: params.CooldownUntil, UpdatedAt: now}, nil
			},
			upsertUserTasteTagFn: func(_ context.Context, params UpsertUserTasteTagParams) (UserTasteTag, error) {
				upsert = params
				return UserTasteTag{}, nil
			},
		},
	}

	got, err := svc.DismissTasteHypothesis(context.Background(), "u1", "h1", HypothesisFeedbackRequest{FeedbackSource: "profile_screen", ReasonCode: "not_me"})
	if err != nil {
		t.Fatalf("DismissTasteHypothesis error: %v", err)
	}
	if got.Status != HypothesisStatusDismissed {
		t.Fatalf("expected dismissed status, got %q", got.Status)
	}
	if updated.CooldownUntil == nil || time.Until(*updated.CooldownUntil) <= 0 {
		t.Fatalf("expected positive cooldown period")
	}
	if updated.DismissCount != 2 {
		t.Fatalf("expected incremented dismiss_count, got %d", updated.DismissCount)
	}
	if upsert.Status != TagStatusMuted {
		t.Fatalf("expected muted tag status, got %q", upsert.Status)
	}
}

func TestServiceDismissTasteHypothesis_NotFound(t *testing.T) {
	svc := &Service{
		repository: &serviceRepoStub{
			getTasteHypothesisByIDFn: func(_ context.Context, _ string, _ string) (TasteHypothesis, error) {
				return TasteHypothesis{}, pgx.ErrNoRows
			},
		},
	}

	_, err := svc.DismissTasteHypothesis(context.Background(), "u1", "h404", HypothesisFeedbackRequest{})
	if !errors.Is(err, ErrTasteHypothesisNotFound) {
		t.Fatalf("expected ErrTasteHypothesisNotFound, got %v", err)
	}
}
