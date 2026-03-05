package taste

import (
	"encoding/json"
	"time"
)

const (
	StatusOnboardingStarted   = "started"
	StatusOnboardingCompleted = "completed"
	StatusOnboardingAbandoned = "abandoned"

	PolarityPositive = "positive"
	PolarityNegative = "negative"

	TagSourceOnboarding       = "onboarding"
	TagSourceBehavior         = "behavior"
	TagSourceMixed            = "mixed"
	TagSourceExplicitFeedback = "explicit_feedback"

	TagStatusActive   = "active"
	TagStatusMuted    = "muted"
	TagStatusRejected = "rejected"

	HypothesisStatusNew       = "new"
	HypothesisStatusAccepted  = "accepted"
	HypothesisStatusDismissed = "dismissed"
	HypothesisStatusExpired   = "expired"

	RunStatusOK     = "ok"
	RunStatusFailed = "failed"

	DefaultInferenceVersion = "taste_inference_v1"
)

type OnboardingSession struct {
	ID          string
	UserID      string
	Version     string
	Status      string
	AnswersJSON json.RawMessage
	StartedAt   time.Time
	CompletedAt *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type UserTasteProfile struct {
	UserID                  string
	ActiveOnboardingVersion *string
	InferenceVersion        string
	BaseMapCompletedAt      *time.Time
	LastRecomputedAt        *time.Time
	MetadataJSON            json.RawMessage
	CreatedAt               time.Time
	UpdatedAt               time.Time
}

type UpsertUserTasteProfileParams struct {
	UserID                  string
	ActiveOnboardingVersion *string
	InferenceVersion        string
	BaseMapCompletedAt      *time.Time
	LastRecomputedAt        *time.Time
	MetadataJSON            json.RawMessage
}

type UserTasteTag struct {
	ID            string
	UserID        string
	TasteCode     string
	Polarity      string
	Score         float64
	Confidence    float64
	Source        string
	Status        string
	CooldownUntil *time.Time
	ReasonJSON    json.RawMessage
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type UpsertUserTasteTagParams struct {
	UserID        string
	TasteCode     string
	Polarity      string
	Score         float64
	Confidence    float64
	Source        string
	Status        string
	CooldownUntil *time.Time
	ReasonJSON    json.RawMessage
}

type TasteHypothesis struct {
	ID            string
	UserID        string
	TasteCode     string
	Polarity      string
	Score         float64
	Confidence    float64
	ReasonJSON    json.RawMessage
	Status        string
	DismissCount  int
	CooldownUntil *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type CreateTasteHypothesisParams struct {
	UserID        string
	TasteCode     string
	Polarity      string
	Score         float64
	Confidence    float64
	ReasonJSON    json.RawMessage
	Status        string
	DismissCount  int
	CooldownUntil *time.Time
}

type UpdateTasteHypothesisStatusParams struct {
	ID            string
	UserID        string
	Status        string
	DismissCount  int
	CooldownUntil *time.Time
	ReasonJSON    json.RawMessage
}

type TasteInferenceRun struct {
	ID                 string
	UserID             string
	Trigger            string
	Version            string
	InputSnapshotJSON  json.RawMessage
	OutputSnapshotJSON json.RawMessage
	ChangedTagsCount   int
	DurationMS         int
	Status             string
	ErrorText          *string
	CreatedAt          time.Time
}

type CreateTasteInferenceRunParams struct {
	UserID             string
	Trigger            string
	Version            string
	InputSnapshotJSON  json.RawMessage
	OutputSnapshotJSON json.RawMessage
	ChangedTagsCount   int
	DurationMS         int
	Status             string
	ErrorText          *string
}
