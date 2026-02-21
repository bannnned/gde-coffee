package auth

import (
	"context"
	"strings"
	"time"

	"backend/internal/reputation"
)

const sqlSelectUserReputationEvents = `select
	id,
	event_type,
	points::float8,
	created_at
from reputation_events
where user_id = $1::uuid
order by created_at asc, id asc`

func populateUserReputation(ctx context.Context, q queryer, user *User) error {
	if user == nil {
		return nil
	}
	user.ReputationBadge = reputation.BadgeFromScore(0)
	user.TrustedMember = false
	if strings.TrimSpace(user.ID) == "" {
		return nil
	}

	events, err := loadUserReputationEvents(ctx, q, user.ID)
	if err != nil {
		return err
	}
	score := reputation.ComputeScore(events, time.Now().UTC())
	user.ReputationBadge = reputation.BadgeFromScore(score)
	user.TrustedMember = reputation.IsTrustedParticipant(score)
	return nil
}

func loadUserReputationEvents(ctx context.Context, q queryer, userID string) ([]reputation.ScoreEvent, error) {
	rows, err := q.Query(ctx, sqlSelectUserReputationEvents, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := make([]reputation.ScoreEvent, 0, 64)
	for rows.Next() {
		var (
			id        int64
			eventType string
			points    float64
			createdAt time.Time
		)
		if err := rows.Scan(&id, &eventType, &points, &createdAt); err != nil {
			return nil, err
		}
		events = append(events, reputation.ScoreEvent{
			ID:        id,
			EventType: eventType,
			Points:    points,
			CreatedAt: createdAt,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return events, nil
}
