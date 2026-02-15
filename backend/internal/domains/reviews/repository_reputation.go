package reviews

import (
	"context"
	"encoding/json"
)

const sqlInsertReputationEvent = `insert into reputation_events (user_id, event_type, points, source_type, source_id, metadata)
 values ($1::uuid, $2, $3, $4, $5, $6::jsonb)
 on conflict (user_id, event_type, source_type, source_id) do nothing`

func (r *Repository) AddReputationEvent(
	ctx context.Context,
	userID string,
	eventType string,
	points int,
	sourceType string,
	sourceID string,
	metadata map[string]interface{},
) error {
	if metadata == nil {
		metadata = map[string]interface{}{}
	}
	metaJSON, err := json.Marshal(metadata)
	if err != nil {
		return err
	}

	_, err = r.pool.Exec(
		ctx,
		sqlInsertReputationEvent,
		userID,
		eventType,
		points,
		sourceType,
		sourceID,
		metaJSON,
	)
	return err
}
