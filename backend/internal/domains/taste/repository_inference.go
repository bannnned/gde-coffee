package taste

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type InferenceTaxonomyTag struct {
	Code           string
	AllowsNegative bool
}

type InferenceReviewSignal struct {
	ReviewID        string
	Rating          int
	DrinkID         string
	DrinkName       string
	TasteTags       []string
	Summary         string
	VisitConfidence string
	VisitVerified   bool
	UpdatedAt       time.Time
}

type InferenceHypothesisFeedback struct {
	TasteCode string
	Polarity  string
	Status    string
	UpdatedAt time.Time
}

func (r *Repository) TouchUserTasteProfileRecomputed(
	ctx context.Context,
	userID string,
	inferenceVersion string,
	recomputedAt time.Time,
) (UserTasteProfile, error) {
	version := strings.TrimSpace(inferenceVersion)
	if version == "" {
		version = DefaultInferenceVersion
	}
	row := r.db.QueryRow(
		ctx,
		sqlTouchUserTasteProfileRecomputed,
		userID,
		version,
		recomputedAt.UTC(),
	)
	return scanUserTasteProfile(row)
}

func (r *Repository) ListInferenceTaxonomy(ctx context.Context) ([]InferenceTaxonomyTag, error) {
	rows, err := r.pool.Query(ctx, sqlSelectInferenceTaxonomy)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]InferenceTaxonomyTag, 0, 64)
	for rows.Next() {
		var item InferenceTaxonomyTag
		if err := rows.Scan(&item.Code, &item.AllowsNegative); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) ListInferenceReviewSignals(
	ctx context.Context,
	userID string,
	since time.Time,
	limit int,
) ([]InferenceReviewSignal, error) {
	if limit <= 0 {
		limit = 300
	}

	rows, err := r.pool.Query(ctx, sqlSelectInferenceReviewSignals, userID, since.UTC(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]InferenceReviewSignal, 0, limit)
	for rows.Next() {
		var item InferenceReviewSignal
		if err := rows.Scan(
			&item.ReviewID,
			&item.Rating,
			&item.DrinkID,
			&item.DrinkName,
			&item.TasteTags,
			&item.Summary,
			&item.VisitConfidence,
			&item.VisitVerified,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) ListInferenceHypothesisFeedback(
	ctx context.Context,
	userID string,
	since time.Time,
) ([]InferenceHypothesisFeedback, error) {
	rows, err := r.pool.Query(ctx, sqlSelectInferenceHypothesisFeedback, userID, since.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]InferenceHypothesisFeedback, 0, 32)
	for rows.Next() {
		var item InferenceHypothesisFeedback
		if err := rows.Scan(&item.TasteCode, &item.Polarity, &item.Status, &item.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) ListAllUserTasteHypotheses(ctx context.Context, userID string) ([]TasteHypothesis, error) {
	rows, err := r.pool.Query(ctx, sqlSelectAllUserTasteHypotheses, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]TasteHypothesis, 0, 32)
	for rows.Next() {
		var item TasteHypothesis
		var reasonRaw []byte
		if err := rows.Scan(
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
		); err != nil {
			return nil, err
		}
		item.ReasonJSON = normalizeJSON(reasonRaw, "{}")
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) ListUsersNeedingReviewInference(ctx context.Context, limit int) ([]string, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := r.pool.Query(ctx, sqlSelectUsersNeedingReviewInference, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]string, 0, limit)
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		result = append(result, userID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) ListUsersNeedingNightlyInference(ctx context.Context, staleBefore time.Time, limit int) ([]string, error) {
	if limit <= 0 {
		limit = 100
	}

	rows, err := r.pool.Query(ctx, sqlSelectUsersNeedingNightlyInference, staleBefore.UTC(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]string, 0, limit)
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		result = append(result, userID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) TryAcquireUserInferenceLock(ctx context.Context, userID string) (bool, error) {
	key := "taste.inference:" + strings.TrimSpace(userID)
	var locked bool
	if err := r.db.QueryRow(ctx, sqlTryAdvisoryLockByKey, key).Scan(&locked); err != nil {
		return false, err
	}
	return locked, nil
}

func (r *Repository) ReleaseUserInferenceLock(ctx context.Context, userID string) {
	key := "taste.inference:" + strings.TrimSpace(userID)
	var unlocked bool
	_ = r.db.QueryRow(ctx, sqlReleaseAdvisoryLockByKey, key).Scan(&unlocked)
}

func (r *Repository) InsertTasteProfileRecomputedMetricEvent(
	ctx context.Context,
	userID string,
	runID string,
	trigger string,
	durationMS int,
	changedTags int,
	occurredAt time.Time,
) error {
	normalizedUserID := strings.TrimSpace(userID)
	if normalizedUserID == "" {
		return nil
	}
	normalizedRunID := strings.TrimSpace(runID)
	if normalizedRunID == "" {
		return nil
	}
	metadataJSON, err := json.Marshal(map[string]any{
		"run_id":             normalizedRunID,
		"trigger":            strings.TrimSpace(trigger),
		"duration_ms":        durationMS,
		"changed_tags_count": changedTags,
	})
	if err != nil {
		return err
	}

	clientEventID := fmt.Sprintf("taste_recompute:%s", normalizedRunID)
	journeyID := fmt.Sprintf("taste_recompute_%s", normalizedRunID)

	_, err = r.pool.Exec(
		ctx,
		`insert into public.product_metrics_events (
			client_event_id,
			event_type,
			user_id,
			anon_id,
			journey_id,
			cafe_id,
			review_id,
			provider,
			occurred_at,
			metadata
		) values (
			$1,
			'taste_profile_recomputed',
			$2::uuid,
			'',
			$3,
			null,
			null,
			'',
			$4,
			$5::jsonb
		)
		on conflict do nothing`,
		clientEventID,
		normalizedUserID,
		journeyID,
		occurredAt.UTC(),
		metadataJSON,
	)
	return err
}
