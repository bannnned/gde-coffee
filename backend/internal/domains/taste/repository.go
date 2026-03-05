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

func normalizeJSON(input json.RawMessage, fallback string) json.RawMessage {
	trimmed := strings.TrimSpace(string(input))
	if trimmed == "" {
		return json.RawMessage(fallback)
	}
	return append(json.RawMessage(nil), input...)
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
