package taste

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type Repository struct {
	pool *pgxpool.Pool
	db   rowQuerier
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{
		pool: pool,
		db:   pool,
	}
}

func newRepositoryWithQuerier(db rowQuerier) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Pool() *pgxpool.Pool {
	return r.pool
}

func (r *Repository) CreateOnboardingSession(
	ctx context.Context,
	userID string,
	version string,
) (OnboardingSession, error) {
	const defaultVersion = "onboarding_v1"
	if strings.TrimSpace(version) == "" {
		version = defaultVersion
	}
	row := r.db.QueryRow(
		ctx,
		sqlInsertOnboardingSession,
		userID,
		version,
		StatusOnboardingStarted,
	)
	return scanOnboardingSession(row)
}

func (r *Repository) CompleteOnboardingSession(
	ctx context.Context,
	sessionID string,
	userID string,
	answers json.RawMessage,
	completedAt time.Time,
) (OnboardingSession, error) {
	row := r.db.QueryRow(
		ctx,
		sqlCompleteOnboardingSession,
		sessionID,
		userID,
		StatusOnboardingCompleted,
		normalizeJSON(answers, "{}"),
		completedAt.UTC(),
	)
	return scanOnboardingSession(row)
}

func (r *Repository) GetUserTasteProfile(ctx context.Context, userID string) (UserTasteProfile, error) {
	row := r.db.QueryRow(ctx, sqlSelectUserTasteProfile, userID)
	return scanUserTasteProfile(row)
}

func (r *Repository) UpsertUserTasteProfile(
	ctx context.Context,
	params UpsertUserTasteProfileParams,
) (UserTasteProfile, error) {
	version := strings.TrimSpace(params.InferenceVersion)
	if version == "" {
		version = DefaultInferenceVersion
	}
	row := r.db.QueryRow(
		ctx,
		sqlUpsertUserTasteProfile,
		params.UserID,
		params.ActiveOnboardingVersion,
		version,
		params.BaseMapCompletedAt,
		params.LastRecomputedAt,
		normalizeJSON(params.MetadataJSON, "{}"),
	)
	return scanUserTasteProfile(row)
}

func (r *Repository) UpsertUserTasteTag(
	ctx context.Context,
	params UpsertUserTasteTagParams,
) (UserTasteTag, error) {
	source := strings.TrimSpace(params.Source)
	if source == "" {
		source = TagSourceMixed
	}
	status := strings.TrimSpace(params.Status)
	if status == "" {
		status = TagStatusActive
	}
	row := r.db.QueryRow(
		ctx,
		sqlUpsertUserTasteTag,
		params.UserID,
		params.TasteCode,
		params.Polarity,
		params.Score,
		params.Confidence,
		source,
		status,
		params.CooldownUntil,
		normalizeJSON(params.ReasonJSON, "{}"),
	)
	return scanUserTasteTag(row)
}

func (r *Repository) CreateTasteHypothesis(
	ctx context.Context,
	params CreateTasteHypothesisParams,
) (TasteHypothesis, error) {
	status := strings.TrimSpace(params.Status)
	if status == "" {
		status = HypothesisStatusNew
	}
	row := r.db.QueryRow(
		ctx,
		sqlInsertTasteHypothesis,
		params.UserID,
		params.TasteCode,
		params.Polarity,
		params.Score,
		params.Confidence,
		normalizeJSON(params.ReasonJSON, "{}"),
		status,
		params.DismissCount,
		params.CooldownUntil,
	)
	return scanTasteHypothesis(row)
}

func (r *Repository) UpdateTasteHypothesisStatus(
	ctx context.Context,
	params UpdateTasteHypothesisStatusParams,
) (TasteHypothesis, error) {
	reason := normalizeJSON(params.ReasonJSON, "{}")
	row := r.db.QueryRow(
		ctx,
		sqlUpdateTasteHypothesisStatus,
		params.ID,
		params.UserID,
		params.Status,
		params.DismissCount,
		params.CooldownUntil,
		reason,
	)
	return scanTasteHypothesis(row)
}

func (r *Repository) CreateTasteInferenceRun(
	ctx context.Context,
	params CreateTasteInferenceRunParams,
) (TasteInferenceRun, error) {
	version := strings.TrimSpace(params.Version)
	if version == "" {
		version = DefaultInferenceVersion
	}
	status := strings.TrimSpace(params.Status)
	if status == "" {
		status = RunStatusOK
	}
	row := r.db.QueryRow(
		ctx,
		sqlInsertInferenceRun,
		params.UserID,
		params.Trigger,
		version,
		normalizeJSON(params.InputSnapshotJSON, "{}"),
		normalizeJSON(params.OutputSnapshotJSON, "{}"),
		params.ChangedTagsCount,
		params.DurationMS,
		status,
		params.ErrorText,
	)
	return scanTasteInferenceRun(row)
}

func (r *Repository) ListActiveUserTasteTags(ctx context.Context, userID string) ([]UserTasteTag, error) {
	var payload []byte
	if err := r.db.QueryRow(ctx, sqlSelectActiveUserTasteTagsJSON, userID).Scan(&payload); err != nil {
		return nil, err
	}
	return decodeTasteTagsJSON(payload)
}

func (r *Repository) ListActionableTasteHypotheses(ctx context.Context, userID string) ([]TasteHypothesis, error) {
	var payload []byte
	if err := r.db.QueryRow(ctx, sqlSelectActionableTasteHypothesesJSON, userID).Scan(&payload); err != nil {
		return nil, err
	}
	return decodeTasteHypothesesJSON(payload)
}

func (r *Repository) GetTasteHypothesisByID(ctx context.Context, hypothesisID string, userID string) (TasteHypothesis, error) {
	row := r.db.QueryRow(ctx, sqlSelectTasteHypothesisByID, hypothesisID, userID)
	return scanTasteHypothesis(row)
}

func normalizeJSON(input json.RawMessage, fallback string) json.RawMessage {
	trimmed := strings.TrimSpace(string(input))
	if trimmed == "" {
		return json.RawMessage(fallback)
	}
	return append(json.RawMessage(nil), input...)
}

type userTasteTagJSON struct {
	ID            string          `json:"id"`
	UserID        string          `json:"user_id"`
	TasteCode     string          `json:"taste_code"`
	Polarity      string          `json:"polarity"`
	Score         float64         `json:"score"`
	Confidence    float64         `json:"confidence"`
	Source        string          `json:"source"`
	Status        string          `json:"status"`
	CooldownUntil *time.Time      `json:"cooldown_until"`
	ReasonJSON    json.RawMessage `json:"reason_json"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

type tasteHypothesisJSON struct {
	ID            string          `json:"id"`
	UserID        string          `json:"user_id"`
	TasteCode     string          `json:"taste_code"`
	Polarity      string          `json:"polarity"`
	Score         float64         `json:"score"`
	Confidence    float64         `json:"confidence"`
	ReasonJSON    json.RawMessage `json:"reason_json"`
	Status        string          `json:"status"`
	DismissCount  int             `json:"dismiss_count"`
	CooldownUntil *time.Time      `json:"cooldown_until"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

func decodeTasteTagsJSON(payload []byte) ([]UserTasteTag, error) {
	raw := normalizeJSON(payload, "[]")
	var rows []userTasteTagJSON
	if err := json.Unmarshal(raw, &rows); err != nil {
		return nil, err
	}
	result := make([]UserTasteTag, 0, len(rows))
	for _, row := range rows {
		result = append(result, UserTasteTag{
			ID:            row.ID,
			UserID:        row.UserID,
			TasteCode:     row.TasteCode,
			Polarity:      row.Polarity,
			Score:         row.Score,
			Confidence:    row.Confidence,
			Source:        row.Source,
			Status:        row.Status,
			CooldownUntil: row.CooldownUntil,
			ReasonJSON:    normalizeJSON(row.ReasonJSON, "{}"),
			CreatedAt:     row.CreatedAt,
			UpdatedAt:     row.UpdatedAt,
		})
	}
	return result, nil
}

func decodeTasteHypothesesJSON(payload []byte) ([]TasteHypothesis, error) {
	raw := normalizeJSON(payload, "[]")
	var rows []tasteHypothesisJSON
	if err := json.Unmarshal(raw, &rows); err != nil {
		return nil, err
	}
	result := make([]TasteHypothesis, 0, len(rows))
	for _, row := range rows {
		result = append(result, TasteHypothesis{
			ID:            row.ID,
			UserID:        row.UserID,
			TasteCode:     row.TasteCode,
			Polarity:      row.Polarity,
			Score:         row.Score,
			Confidence:    row.Confidence,
			ReasonJSON:    normalizeJSON(row.ReasonJSON, "{}"),
			Status:        row.Status,
			DismissCount:  row.DismissCount,
			CooldownUntil: row.CooldownUntil,
			CreatedAt:     row.CreatedAt,
			UpdatedAt:     row.UpdatedAt,
		})
	}
	return result, nil
}

func scanOnboardingSession(row pgx.Row) (OnboardingSession, error) {
	var (
		item        OnboardingSession
		answersRaw  []byte
		completedAt *time.Time
	)
	err := row.Scan(
		&item.ID,
		&item.UserID,
		&item.Version,
		&item.Status,
		&answersRaw,
		&item.StartedAt,
		&completedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return OnboardingSession{}, err
	}
	item.AnswersJSON = normalizeJSON(answersRaw, "{}")
	item.CompletedAt = completedAt
	return item, nil
}

func scanUserTasteProfile(row pgx.Row) (UserTasteProfile, error) {
	var (
		item        UserTasteProfile
		metadataRaw []byte
	)
	err := row.Scan(
		&item.UserID,
		&item.ActiveOnboardingVersion,
		&item.InferenceVersion,
		&item.BaseMapCompletedAt,
		&item.LastRecomputedAt,
		&metadataRaw,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return UserTasteProfile{}, err
	}
	item.MetadataJSON = normalizeJSON(metadataRaw, "{}")
	return item, nil
}

func scanUserTasteTag(row pgx.Row) (UserTasteTag, error) {
	var (
		item      UserTasteTag
		reasonRaw []byte
	)
	err := row.Scan(
		&item.ID,
		&item.UserID,
		&item.TasteCode,
		&item.Polarity,
		&item.Score,
		&item.Confidence,
		&item.Source,
		&item.Status,
		&item.CooldownUntil,
		&reasonRaw,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return UserTasteTag{}, err
	}
	item.ReasonJSON = normalizeJSON(reasonRaw, "{}")
	return item, nil
}

func scanTasteHypothesis(row pgx.Row) (TasteHypothesis, error) {
	var (
		item      TasteHypothesis
		reasonRaw []byte
	)
	err := row.Scan(
		&item.ID,
		&item.UserID,
		&item.TasteCode,
		&item.Polarity,
		&item.Score,
		&item.Confidence,
		&reasonRaw,
		&item.Status,
		&item.DismissCount,
		&item.CooldownUntil,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return TasteHypothesis{}, err
	}
	item.ReasonJSON = normalizeJSON(reasonRaw, "{}")
	return item, nil
}

func scanTasteInferenceRun(row pgx.Row) (TasteInferenceRun, error) {
	var (
		item      TasteInferenceRun
		inputRaw  []byte
		outputRaw []byte
	)
	err := row.Scan(
		&item.ID,
		&item.UserID,
		&item.Trigger,
		&item.Version,
		&inputRaw,
		&outputRaw,
		&item.ChangedTagsCount,
		&item.DurationMS,
		&item.Status,
		&item.ErrorText,
		&item.CreatedAt,
	)
	if err != nil {
		return TasteInferenceRun{}, err
	}
	item.InputSnapshotJSON = normalizeJSON(inputRaw, "{}")
	item.OutputSnapshotJSON = normalizeJSON(outputRaw, "{}")
	return item, nil
}
