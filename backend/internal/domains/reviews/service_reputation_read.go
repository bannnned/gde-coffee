package reviews

import (
	"context"
	"encoding/json"
	"time"

	"backend/internal/reputation"
)

const (
	defaultReputationEventsLimit = 200
	maxReputationEventsLimit     = 1000
)

const (
	sqlCountReputationEventsByUser = `select count(*)::int
from reputation_events
where user_id = $1::uuid`

	sqlListReputationEventsByUser = `select
	id,
	event_type,
	points::float8,
	source_type,
	source_id,
	metadata,
	created_at
from reputation_events
where user_id = $1::uuid
order by created_at asc, id asc
limit $2`
)

func (s *Service) GetUserReputationPublicProfile(
	ctx context.Context,
	userID string,
) (map[string]interface{}, error) {
	score, err := s.lookupUserReputationScore(ctx, userID)
	if err != nil {
		return nil, err
	}

	var eventsCount int
	if err := s.repository.Pool().QueryRow(ctx, sqlCountReputationEventsByUser, userID).Scan(&eventsCount); err != nil {
		return nil, err
	}
	level := reputation.LevelFromScore(score)

	return map[string]interface{}{
		"user_id":                userID,
		"score":                  roundFloat(score, 3),
		"badge":                  reputation.BadgeFromScore(score),
		"trusted_participant":    reputation.IsTrustedParticipant(score),
		"events_count":           eventsCount,
		"formula_version":        reputation.FormulaVersion,
		"trusted_threshold_v1_1": reputation.TrustedParticipantThreshold,
		"level":                  level.Level,
		"level_label":            level.Label,
		"level_progress":         roundFloat(level.Progress, 4),
		"level_score_floor":      roundFloat(level.CurrentScore, 3),
		"next_level_score":       roundFloat(level.NextScore, 3),
		"points_to_next_level":   roundFloat(level.PointsToNext, 3),
	}, nil
}

func (s *Service) ListUserReputationEvents(
	ctx context.Context,
	userID string,
	limit int,
) ([]map[string]interface{}, error) {
	if limit <= 0 {
		limit = defaultReputationEventsLimit
	}
	if limit > maxReputationEventsLimit {
		limit = maxReputationEventsLimit
	}

	rows, err := s.repository.Pool().Query(ctx, sqlListReputationEventsByUser, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type eventRow struct {
		id        int64
		eventType string
		points    float64
		source    string
		sourceID  string
		metadata  []byte
		createdAt time.Time
	}

	rowsBuffer := make([]eventRow, 0, limit)
	for rows.Next() {
		var item eventRow
		if err := rows.Scan(&item.id, &item.eventType, &item.points, &item.source, &item.sourceID, &item.metadata, &item.createdAt); err != nil {
			return nil, err
		}
		rowsBuffer = append(rowsBuffer, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	input := make([]reputation.ScoreEvent, 0, len(rowsBuffer))
	for _, row := range rowsBuffer {
		input = append(input, reputation.ScoreEvent{
			ID:        row.id,
			EventType: row.eventType,
			Points:    row.points,
			CreatedAt: row.createdAt,
		})
	}
	contributions, _ := reputation.EvaluateScoreEvents(input, time.Now().UTC())

	events := make([]map[string]interface{}, 0, len(rowsBuffer))
	runningScore := 0.0
	for idx, row := range rowsBuffer {
		meta := map[string]interface{}{}
		if len(row.metadata) > 0 {
			_ = json.Unmarshal(row.metadata, &meta)
		}
		var (
			appliedPoints   float64
			decayMultiplier float64
			effectivePoints float64
		)
		if idx < len(contributions) {
			appliedPoints = contributions[idx].AppliedPoints
			decayMultiplier = contributions[idx].DecayMultiplier
			effectivePoints = contributions[idx].EffectivePoints
		}
		runningScore += effectivePoints

		events = append(events, map[string]interface{}{
			"id":                         row.id,
			"event_type":                 row.eventType,
			"points":                     roundFloat(row.points, 3),
			"source_type":                row.source,
			"source_id":                  row.sourceID,
			"metadata":                   meta,
			"created_at":                 row.createdAt.UTC().Format(time.RFC3339),
			"applied_points_v1_1":        roundFloat(appliedPoints, 3),
			"decay_multiplier_v1_1":      roundFloat(decayMultiplier, 4),
			"effective_points_v1_1":      roundFloat(effectivePoints, 3),
			"score_after_event_v1_1":     roundFloat(runningScore, 3),
			"reputation_formula_version": reputation.FormulaVersion,
		})
	}

	return events, nil
}
