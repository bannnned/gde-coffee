package taste

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type repository interface {
	CreateOnboardingSession(ctx context.Context, userID string, version string) (OnboardingSession, error)
	CompleteOnboardingSession(ctx context.Context, sessionID string, userID string, answers json.RawMessage, completedAt time.Time) (OnboardingSession, error)
	GetUserTasteProfile(ctx context.Context, userID string) (UserTasteProfile, error)
	ListActiveUserTasteTags(ctx context.Context, userID string) ([]UserTasteTag, error)
	ListActionableTasteHypotheses(ctx context.Context, userID string) ([]TasteHypothesis, error)
	GetTasteHypothesisByID(ctx context.Context, hypothesisID string, userID string) (TasteHypothesis, error)
	UpsertUserTasteProfile(ctx context.Context, params UpsertUserTasteProfileParams) (UserTasteProfile, error)
	UpsertUserTasteTag(ctx context.Context, params UpsertUserTasteTagParams) (UserTasteTag, error)
	UpdateTasteHypothesisStatus(ctx context.Context, params UpdateTasteHypothesisStatusParams) (TasteHypothesis, error)
}

type Service struct {
	repository repository
	spec       onboardingSpec
}

func NewService(repository repository) (*Service, error) {
	spec, err := loadOnboardingSpec()
	if err != nil {
		return nil, err
	}
	return &Service{repository: repository, spec: spec}, nil
}

type CompleteOnboardingRequest struct {
	OnboardingVersion string        `json:"onboarding_version"`
	SessionID         string        `json:"session_id"`
	Answers           []AnswerInput `json:"answers"`
	ClientCompletedAt string        `json:"client_completed_at"`
}

type AnswerInput struct {
	QuestionID string          `json:"question_id"`
	Value      json.RawMessage `json:"value"`
}

type OnboardingResponse struct {
	ContractVersion      string           `json:"contract_version"`
	OnboardingVersion    string           `json:"onboarding_version"`
	Locale               string           `json:"locale"`
	EstimatedDurationSec int              `json:"estimated_duration_sec"`
	Steps                []onboardingStep `json:"steps"`
}

type CompleteOnboardingResponse struct {
	ContractVersion  string          `json:"contract_version"`
	InferenceVersion string          `json:"inference_version"`
	SessionID        string          `json:"session_id"`
	Profile          BaselineProfile `json:"profile"`
}

type BaselineProfile struct {
	Tags      []BaselineTag `json:"tags"`
	UpdatedAt time.Time     `json:"updated_at"`
}

type BaselineTag struct {
	TasteCode  string  `json:"taste_code"`
	Polarity   string  `json:"polarity"`
	Score      float64 `json:"score"`
	Confidence float64 `json:"confidence"`
	Source     string  `json:"source"`
}

func (s *Service) GetOnboarding(_ context.Context) OnboardingResponse {
	return OnboardingResponse{
		ContractVersion:      normalizeNonEmpty(s.spec.ContractVersion, TasteContractVersion),
		OnboardingVersion:    s.spec.OnboardingVersion,
		Locale:               s.spec.Locale,
		EstimatedDurationSec: s.spec.EstimatedDurationSec,
		Steps:                s.spec.Steps,
	}
}

func (s *Service) CompleteOnboarding(
	ctx context.Context,
	userID string,
	req CompleteOnboardingRequest,
) (CompleteOnboardingResponse, error) {
	if strings.TrimSpace(userID) == "" {
		return CompleteOnboardingResponse{}, errValidation("user_id обязателен.")
	}

	version := strings.TrimSpace(req.OnboardingVersion)
	if version == "" {
		version = s.spec.OnboardingVersion
	}
	if version != s.spec.OnboardingVersion {
		return CompleteOnboardingResponse{}, errValidation("onboarding_version не поддерживается.")
	}

	if len(req.Answers) == 0 {
		return CompleteOnboardingResponse{}, errValidation("answers не может быть пустым.")
	}

	validated, err := s.validateAnswers(req.Answers)
	if err != nil {
		return CompleteOnboardingResponse{}, err
	}

	completedAt := time.Now().UTC()
	if raw := strings.TrimSpace(req.ClientCompletedAt); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return CompleteOnboardingResponse{}, errValidation("client_completed_at должен быть в формате RFC3339.")
		}
		completedAt = parsed.UTC()
	}

	sessionID := strings.TrimSpace(req.SessionID)
	if sessionID == "" {
		session, err := s.repository.CreateOnboardingSession(ctx, userID, version)
		if err != nil {
			return CompleteOnboardingResponse{}, err
		}
		sessionID = session.ID
	}

	answersRaw, err := json.Marshal(req.Answers)
	if err != nil {
		return CompleteOnboardingResponse{}, fmt.Errorf("encode answers: %w", err)
	}

	completedSession, err := s.repository.CompleteOnboardingSession(ctx, sessionID, userID, answersRaw, completedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return CompleteOnboardingResponse{}, errValidation("не найдена активная onboarding session для завершения.")
		}
		return CompleteOnboardingResponse{}, err
	}

	signalRows := collectSignals(validated)
	baselineTags := make([]BaselineTag, 0, len(signalRows))
	for _, signal := range signalRows {
		profileTag, err := s.repository.UpsertUserTasteTag(ctx, UpsertUserTasteTagParams{
			UserID:     userID,
			TasteCode:  signal.TasteCode,
			Polarity:   signal.Polarity,
			Score:      signal.Score,
			Confidence: signal.Confidence,
			Source:     TagSourceOnboarding,
			Status:     TagStatusActive,
			ReasonJSON: json.RawMessage(`{"source":"onboarding"}`),
		})
		if err != nil {
			return CompleteOnboardingResponse{}, err
		}
		baselineTags = append(baselineTags, BaselineTag{
			TasteCode:  profileTag.TasteCode,
			Polarity:   profileTag.Polarity,
			Score:      profileTag.Score,
			Confidence: profileTag.Confidence,
			Source:     profileTag.Source,
		})
	}

	metadata, err := json.Marshal(map[string]any{
		"source":             "onboarding",
		"contract_version":   normalizeNonEmpty(s.spec.ContractVersion, TasteContractVersion),
		"onboarding_version": completedSession.Version,
		"session_id":         completedSession.ID,
		"answers_count":      len(req.Answers),
	})
	if err != nil {
		return CompleteOnboardingResponse{}, fmt.Errorf("encode profile metadata: %w", err)
	}

	profile, err := s.repository.UpsertUserTasteProfile(ctx, UpsertUserTasteProfileParams{
		UserID:                  userID,
		ActiveOnboardingVersion: &completedSession.Version,
		InferenceVersion:        DefaultInferenceVersion,
		BaseMapCompletedAt:      &completedAt,
		LastRecomputedAt:        &completedAt,
		MetadataJSON:            metadata,
	})
	if err != nil {
		return CompleteOnboardingResponse{}, err
	}

	s.runInferenceBestEffort(userID, "onboarding_complete")

	return CompleteOnboardingResponse{
		ContractVersion:  normalizeNonEmpty(s.spec.ContractVersion, TasteContractVersion),
		InferenceVersion: profile.InferenceVersion,
		SessionID:        completedSession.ID,
		Profile: BaselineProfile{
			Tags:      baselineTags,
			UpdatedAt: profile.UpdatedAt,
		},
	}, nil
}

type validatedAnswer struct {
	QuestionID string
	Signals    []tasteSignal
}

func (s *Service) validateAnswers(input []AnswerInput) ([]validatedAnswer, error) {
	stepsByID := make(map[string]onboardingStep, len(s.spec.Steps))
	for _, step := range s.spec.Steps {
		stepsByID[step.ID] = step
	}

	answersByID := make(map[string]AnswerInput, len(input))
	for _, item := range input {
		questionID := strings.TrimSpace(item.QuestionID)
		if questionID == "" {
			return nil, errValidation("question_id обязателен для каждого ответа.")
		}
		if _, exists := answersByID[questionID]; exists {
			return nil, errValidation("дублирующийся question_id в answers.")
		}
		if _, exists := stepsByID[questionID]; !exists {
			return nil, errValidation("обнаружен неизвестный question_id в answers.")
		}
		answersByID[questionID] = item
	}

	validated := make([]validatedAnswer, 0, len(input))
	for _, step := range s.spec.Steps {
		rawAnswer, answered := answersByID[step.ID]
		if !answered {
			if step.Required {
				return nil, errValidation("не заполнен обязательный шаг onboarding.")
			}
			continue
		}
		signals, err := validateStepAnswer(step, rawAnswer.Value)
		if err != nil {
			return nil, err
		}
		validated = append(validated, validatedAnswer{
			QuestionID: step.ID,
			Signals:    signals,
		})
	}
	return validated, nil
}

func validateStepAnswer(step onboardingStep, raw json.RawMessage) ([]tasteSignal, error) {
	switch step.Type {
	case "single_choice":
		var value string
		if err := json.Unmarshal(raw, &value); err != nil {
			return nil, errValidation("single_choice шаг ожидает строковое значение.")
		}
		value = strings.TrimSpace(value)
		for _, option := range step.Options {
			if option.ID == value {
				return option.Signals, nil
			}
		}
		return nil, errValidation("single_choice содержит неизвестную option id.")
	case "multi_choice":
		var values []string
		if err := json.Unmarshal(raw, &values); err != nil {
			return nil, errValidation("multi_choice шаг ожидает массив строк.")
		}
		if len(values) < step.MinChoices {
			return nil, errValidation("multi_choice содержит меньше вариантов, чем требуется.")
		}
		if step.MaxChoices > 0 && len(values) > step.MaxChoices {
			return nil, errValidation("multi_choice содержит больше вариантов, чем разрешено.")
		}
		optionByID := make(map[string]onboardingOption, len(step.Options))
		for _, option := range step.Options {
			optionByID[option.ID] = option
		}
		seen := make(map[string]struct{}, len(values))
		result := make([]tasteSignal, 0, len(values))
		for _, item := range values {
			id := strings.TrimSpace(item)
			if id == "" {
				continue
			}
			if _, exists := seen[id]; exists {
				continue
			}
			seen[id] = struct{}{}
			option, ok := optionByID[id]
			if !ok {
				return nil, errValidation("multi_choice содержит неизвестную option id.")
			}
			result = append(result, option.Signals...)
		}
		return result, nil
	case "range":
		var values map[string]float64
		if err := json.Unmarshal(raw, &values); err != nil {
			return nil, errValidation("range шаг ожидает объект с числовыми значениями.")
		}
		if len(values) == 0 {
			return nil, errValidation("range шаг не может быть пустым.")
		}
		dimByID := make(map[string]onboardingDimension, len(step.Dimensions))
		for _, dim := range step.Dimensions {
			dimByID[dim.ID] = dim
		}
		result := make([]tasteSignal, 0, len(values))
		for dimID, value := range values {
			dim, ok := dimByID[dimID]
			if !ok {
				return nil, errValidation("range содержит неизвестную dimension id.")
			}
			if value < float64(dim.Min) || value > float64(dim.Max) {
				return nil, errValidation("range содержит значение вне допустимого диапазона.")
			}
			for _, mapping := range dim.Mapping {
				if evaluateRangeCondition(mapping.When, value) {
					result = append(result, mapping.Signals...)
				}
			}
		}
		return result, nil
	case "paired_preference":
		var selections map[string]string
		if err := json.Unmarshal(raw, &selections); err != nil {
			return nil, errValidation("paired_preference шаг ожидает объект pair_id -> side.")
		}
		pairByID := make(map[string]onboardingPair, len(step.Pairs))
		for _, pair := range step.Pairs {
			pairByID[pair.ID] = pair
		}
		result := make([]tasteSignal, 0, len(selections))
		for pairID, side := range selections {
			pair, ok := pairByID[pairID]
			if !ok {
				return nil, errValidation("paired_preference содержит неизвестный pair_id.")
			}
			switch strings.ToLower(strings.TrimSpace(side)) {
			case "left":
				result = append(result, pair.Left.Signals...)
			case "right":
				result = append(result, pair.Right.Signals...)
			case "skip", "":
				continue
			default:
				return nil, errValidation("paired_preference side должен быть left/right/skip.")
			}
		}
		return result, nil
	default:
		return nil, errValidation("unsupported onboarding step type.")
	}
}

func evaluateRangeCondition(expression string, value float64) bool {
	expr := strings.ReplaceAll(strings.TrimSpace(expression), " ", "")
	if expr == "" {
		return false
	}
	for _, op := range []string{">=", "<=", "==", ">", "<"} {
		idx := strings.Index(expr, op)
		if idx <= 0 {
			continue
		}
		left := expr[:idx]
		right := expr[idx+len(op):]
		if left != "value" {
			continue
		}
		threshold, err := strconv.ParseFloat(right, 64)
		if err != nil {
			return false
		}
		switch op {
		case ">=":
			return value >= threshold
		case "<=":
			return value <= threshold
		case "==":
			return value == threshold
		case ">":
			return value > threshold
		case "<":
			return value < threshold
		}
	}
	return false
}

type signalAccumulator struct {
	TasteCode string
	Polarity  string
	Sum       float64
	Count     int
}

func collectSignals(answers []validatedAnswer) []BaselineTag {
	bucket := make(map[string]*signalAccumulator)
	for _, answer := range answers {
		for _, signal := range answer.Signals {
			tasteCode := strings.TrimSpace(signal.TasteCode)
			polarity := strings.TrimSpace(signal.Polarity)
			if tasteCode == "" || (polarity != PolarityPositive && polarity != PolarityNegative) {
				continue
			}
			strength := clamp01(signal.Strength)
			if strength == 0 {
				continue
			}
			key := tasteCode + "::" + polarity
			acc, ok := bucket[key]
			if !ok {
				acc = &signalAccumulator{TasteCode: tasteCode, Polarity: polarity}
				bucket[key] = acc
			}
			acc.Sum += strength
			acc.Count++
		}
	}

	result := make([]BaselineTag, 0, len(bucket))
	for _, acc := range bucket {
		avg := acc.Sum / float64(maxInt(acc.Count, 1))
		score := clampSigned(avg, acc.Polarity)
		confidence := math.Min(0.65, 0.35+0.05*float64(acc.Count))
		result = append(result, BaselineTag{
			TasteCode:  acc.TasteCode,
			Polarity:   acc.Polarity,
			Score:      score,
			Confidence: confidence,
			Source:     TagSourceOnboarding,
		})
	}
	return result
}

func clamp01(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}

func clampSigned(value float64, polarity string) float64 {
	v := clamp01(value)
	if polarity == PolarityNegative {
		return -v
	}
	return v
}

func maxInt(left int, right int) int {
	if left > right {
		return left
	}
	return right
}

func normalizeNonEmpty(value string, fallback string) string {
	next := strings.TrimSpace(value)
	if next == "" {
		return fallback
	}
	return next
}
