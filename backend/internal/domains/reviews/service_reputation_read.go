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
	points,
	source_type,
	source_id,
	metadata,
	created_at
from reputation_events
where user_id = $1::uuid
order by id asc
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

	return map[string]interface{}{
		"user_id":              userID,
		"badge":                reputation.BadgeFromScore(score),
		"trusted_participant":  reputation.IsTrustedParticipant(score),
		"events_count":         eventsCount,
		"formula_version":      "reputation_v1",
		"trusted_threshold_v1": reputation.TrustedParticipantThreshold,
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

	events := make([]map[string]interface{}, 0, limit)
	runningScore := 0.0
	for rows.Next() {
		var (
			id        int64
			eventType string
			points    int
			source    string
			sourceID  string
			metadata  []byte
			createdAt time.Time
		)

		if err := rows.Scan(&id, &eventType, &points, &source, &sourceID, &metadata, &createdAt); err != nil {
			return nil, err
		}

		meta := map[string]interface{}{}
		if len(metadata) > 0 {
			_ = json.Unmarshal(metadata, &meta)
		}

		runningScore += float64(points)
		events = append(events, map[string]interface{}{
			"id":                   id,
			"event_type":           eventType,
			"points":               points,
			"source_type":          source,
			"source_id":            sourceID,
			"metadata":             meta,
			"created_at":           createdAt.UTC().Format(time.RFC3339),
			"score_after_event_v1": roundFloat(runningScore, 3),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return events, nil
}
