package taste

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const hypothesisDismissCooldown = 30 * 24 * time.Hour

type TasteMapResponse struct {
	ContractVersion  string               `json:"contract_version"`
	InferenceVersion string               `json:"inference_version"`
	BaseMap          TasteMapBaseMap      `json:"base_map"`
	ActiveTags       []TasteMapTag        `json:"active_tags"`
	Hypotheses       []TasteMapHypothesis `json:"hypotheses"`
	UpdatedAt        time.Time            `json:"updated_at"`
}

type TasteMapBaseMap struct {
	OnboardingVersion string     `json:"onboarding_version,omitempty"`
	CompletedAt       *time.Time `json:"completed_at,omitempty"`
}

type TasteMapTag struct {
	TasteCode  string  `json:"taste_code"`
	Polarity   string  `json:"polarity"`
	Score      float64 `json:"score"`
	Confidence float64 `json:"confidence"`
	Source     string  `json:"source"`
}

type TasteMapHypothesis struct {
	ID         string     `json:"id"`
	TasteCode  string     `json:"taste_code"`
	Polarity   string     `json:"polarity"`
	Score      float64    `json:"score"`
	Confidence float64    `json:"confidence"`
	Status     string     `json:"status"`
	Reason     string     `json:"reason"`
	UpdatedAt  time.Time  `json:"updated_at"`
	CooldownTo *time.Time `json:"cooldown_until,omitempty"`
}

type HypothesisFeedbackRequest struct {
	FeedbackSource string `json:"feedback_source"`
	ReasonCode     string `json:"reason_code"`
}

type HypothesisFeedbackResponse struct {
	ID            string     `json:"id"`
	Status        string     `json:"status"`
	CooldownUntil *time.Time `json:"cooldown_until,omitempty"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (s *Service) GetTasteMap(ctx context.Context, userID string) (TasteMapResponse, error) {
	if strings.TrimSpace(userID) == "" {
		return TasteMapResponse{}, errValidation("user_id обязателен.")
	}

	profile, err := s.repository.GetUserTasteProfile(ctx, userID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return TasteMapResponse{}, err
	}

	activeTags, err := s.repository.ListActiveUserTasteTags(ctx, userID)
	if err != nil {
		return TasteMapResponse{}, err
	}

	hypotheses, err := s.repository.ListActionableTasteHypotheses(ctx, userID)
	if err != nil {
		return TasteMapResponse{}, err
	}

	response := TasteMapResponse{
		ContractVersion:  TasteContractVersion,
		InferenceVersion: DefaultInferenceVersion,
		BaseMap: TasteMapBaseMap{
			CompletedAt: nil,
		},
		ActiveTags: make([]TasteMapTag, 0, len(activeTags)),
		Hypotheses: make([]TasteMapHypothesis, 0, len(hypotheses)),
		UpdatedAt:  time.Now().UTC(),
	}

	if err == nil {
		response.InferenceVersion = normalizeNonEmpty(profile.InferenceVersion, DefaultInferenceVersion)
		if profile.ActiveOnboardingVersion != nil {
			response.BaseMap.OnboardingVersion = strings.TrimSpace(*profile.ActiveOnboardingVersion)
		}
		response.BaseMap.CompletedAt = profile.BaseMapCompletedAt
		if !profile.UpdatedAt.IsZero() {
			response.UpdatedAt = profile.UpdatedAt
		}
	}

	for _, tag := range activeTags {
		response.ActiveTags = append(response.ActiveTags, TasteMapTag{
			TasteCode:  tag.TasteCode,
			Polarity:   tag.Polarity,
			Score:      tag.Score,
			Confidence: tag.Confidence,
			Source:     tag.Source,
		})
		if tag.UpdatedAt.After(response.UpdatedAt) {
			response.UpdatedAt = tag.UpdatedAt
		}
	}

	for _, hypothesis := range hypotheses {
		response.Hypotheses = append(response.Hypotheses, TasteMapHypothesis{
			ID:         hypothesis.ID,
			TasteCode:  hypothesis.TasteCode,
			Polarity:   hypothesis.Polarity,
			Score:      hypothesis.Score,
			Confidence: hypothesis.Confidence,
			Status:     hypothesis.Status,
			Reason:     extractHypothesisReason(hypothesis.ReasonJSON),
			UpdatedAt:  hypothesis.UpdatedAt,
			CooldownTo: hypothesis.CooldownUntil,
		})
		if hypothesis.UpdatedAt.After(response.UpdatedAt) {
			response.UpdatedAt = hypothesis.UpdatedAt
		}
	}

	return response, nil
}

func (s *Service) AcceptTasteHypothesis(
	ctx context.Context,
	userID string,
	hypothesisID string,
	req HypothesisFeedbackRequest,
) (HypothesisFeedbackResponse, error) {
	if strings.TrimSpace(userID) == "" {
		return HypothesisFeedbackResponse{}, errValidation("user_id обязателен.")
	}
	if strings.TrimSpace(hypothesisID) == "" {
		return HypothesisFeedbackResponse{}, errValidation("id гипотезы обязателен.")
	}

	hypothesis, err := s.repository.GetTasteHypothesisByID(ctx, hypothesisID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return HypothesisFeedbackResponse{}, ErrTasteHypothesisNotFound
		}
		return HypothesisFeedbackResponse{}, err
	}

	if hypothesis.Status == HypothesisStatusAccepted {
		return HypothesisFeedbackResponse{
			ID:            hypothesis.ID,
			Status:        hypothesis.Status,
			CooldownUntil: hypothesis.CooldownUntil,
			UpdatedAt:     hypothesis.UpdatedAt,
		}, nil
	}
	if hypothesis.Status == HypothesisStatusExpired {
		return HypothesisFeedbackResponse{}, errValidation("гипотеза больше неактуальна.")
	}

	now := time.Now().UTC()
	reason := map[string]any{
		"action":          "accept",
		"feedback_source": normalizeNonEmpty(req.FeedbackSource, "profile_screen"),
		"accepted_at":     now,
	}
	reasonJSON, err := json.Marshal(reason)
	if err != nil {
		return HypothesisFeedbackResponse{}, err
	}

	updatedHypothesis, err := s.repository.UpdateTasteHypothesisStatus(ctx, UpdateTasteHypothesisStatusParams{
		ID:            hypothesis.ID,
		UserID:        userID,
		Status:        HypothesisStatusAccepted,
		DismissCount:  hypothesis.DismissCount,
		CooldownUntil: nil,
		ReasonJSON:    reasonJSON,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return HypothesisFeedbackResponse{}, ErrTasteHypothesisNotFound
		}
		return HypothesisFeedbackResponse{}, err
	}

	tagReasonJSON, err := json.Marshal(map[string]any{
		"source":          "hypothesis_accept",
		"hypothesis_id":   hypothesis.ID,
		"feedback_source": normalizeNonEmpty(req.FeedbackSource, "profile_screen"),
		"accepted_at":     now,
	})
	if err != nil {
		return HypothesisFeedbackResponse{}, err
	}

	_, err = s.repository.UpsertUserTasteTag(ctx, UpsertUserTasteTagParams{
		UserID:        userID,
		TasteCode:     hypothesis.TasteCode,
		Polarity:      hypothesis.Polarity,
		Score:         normalizeHypothesisScore(hypothesis.Score, hypothesis.Polarity),
		Confidence:    maxFloat64(hypothesis.Confidence, 0.7),
		Source:        TagSourceExplicitFeedback,
		Status:        TagStatusActive,
		CooldownUntil: nil,
		ReasonJSON:    tagReasonJSON,
	})
	if err != nil {
		return HypothesisFeedbackResponse{}, err
	}

	return HypothesisFeedbackResponse{
		ID:            updatedHypothesis.ID,
		Status:        updatedHypothesis.Status,
		CooldownUntil: updatedHypothesis.CooldownUntil,
		UpdatedAt:     updatedHypothesis.UpdatedAt,
	}, nil
}

func (s *Service) DismissTasteHypothesis(
	ctx context.Context,
	userID string,
	hypothesisID string,
	req HypothesisFeedbackRequest,
) (HypothesisFeedbackResponse, error) {
	if strings.TrimSpace(userID) == "" {
		return HypothesisFeedbackResponse{}, errValidation("user_id обязателен.")
	}
	if strings.TrimSpace(hypothesisID) == "" {
		return HypothesisFeedbackResponse{}, errValidation("id гипотезы обязателен.")
	}

	hypothesis, err := s.repository.GetTasteHypothesisByID(ctx, hypothesisID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return HypothesisFeedbackResponse{}, ErrTasteHypothesisNotFound
		}
		return HypothesisFeedbackResponse{}, err
	}

	now := time.Now().UTC()
	if hypothesis.Status == HypothesisStatusDismissed && hypothesis.CooldownUntil != nil && hypothesis.CooldownUntil.After(now) {
		return HypothesisFeedbackResponse{
			ID:            hypothesis.ID,
			Status:        hypothesis.Status,
			CooldownUntil: hypothesis.CooldownUntil,
			UpdatedAt:     hypothesis.UpdatedAt,
		}, nil
	}
	if hypothesis.Status == HypothesisStatusExpired {
		return HypothesisFeedbackResponse{}, errValidation("гипотеза больше неактуальна.")
	}

	cooldownUntil := now.Add(hypothesisDismissCooldown)
	nextDismissCount := hypothesis.DismissCount + 1

	reason := map[string]any{
		"action":          "dismiss",
		"feedback_source": normalizeNonEmpty(req.FeedbackSource, "profile_screen"),
		"reason_code":     strings.TrimSpace(req.ReasonCode),
		"dismissed_at":    now,
	}
	reasonJSON, err := json.Marshal(reason)
	if err != nil {
		return HypothesisFeedbackResponse{}, err
	}

	updatedHypothesis, err := s.repository.UpdateTasteHypothesisStatus(ctx, UpdateTasteHypothesisStatusParams{
		ID:            hypothesis.ID,
		UserID:        userID,
		Status:        HypothesisStatusDismissed,
		DismissCount:  nextDismissCount,
		CooldownUntil: &cooldownUntil,
		ReasonJSON:    reasonJSON,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return HypothesisFeedbackResponse{}, ErrTasteHypothesisNotFound
		}
		return HypothesisFeedbackResponse{}, err
	}

	tagReasonJSON, err := json.Marshal(map[string]any{
		"source":          "hypothesis_dismiss",
		"hypothesis_id":   hypothesis.ID,
		"feedback_source": normalizeNonEmpty(req.FeedbackSource, "profile_screen"),
		"reason_code":     strings.TrimSpace(req.ReasonCode),
		"dismissed_at":    now,
	})
	if err != nil {
		return HypothesisFeedbackResponse{}, err
	}

	_, err = s.repository.UpsertUserTasteTag(ctx, UpsertUserTasteTagParams{
		UserID:        userID,
		TasteCode:     hypothesis.TasteCode,
		Polarity:      hypothesis.Polarity,
		Score:         normalizeHypothesisScore(hypothesis.Score, hypothesis.Polarity),
		Confidence:    maxFloat64(hypothesis.Confidence, 0.7),
		Source:        TagSourceExplicitFeedback,
		Status:        TagStatusMuted,
		CooldownUntil: &cooldownUntil,
		ReasonJSON:    tagReasonJSON,
	})
	if err != nil {
		return HypothesisFeedbackResponse{}, err
	}

	return HypothesisFeedbackResponse{
		ID:            updatedHypothesis.ID,
		Status:        updatedHypothesis.Status,
		CooldownUntil: updatedHypothesis.CooldownUntil,
		UpdatedAt:     updatedHypothesis.UpdatedAt,
	}, nil
}

func extractHypothesisReason(reasonJSON json.RawMessage) string {
	raw := normalizeJSON(reasonJSON, "{}")
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return ""
	}
	for _, key := range []string{"reason", "summary", "text", "explain"} {
		if value, ok := payload[key]; ok {
			if text, ok := value.(string); ok && strings.TrimSpace(text) != "" {
				return strings.TrimSpace(text)
			}
		}
	}
	return ""
}

func normalizeHypothesisScore(score float64, polarity string) float64 {
	absScore := math.Abs(score)
	if absScore == 0 {
		absScore = 0.35
	}
	if absScore > 1 {
		absScore = 1
	}
	if strings.TrimSpace(polarity) == PolarityNegative {
		return -absScore
	}
	return absScore
}

func maxFloat64(left float64, right float64) float64 {
	if left > right {
		return left
	}
	return right
}
