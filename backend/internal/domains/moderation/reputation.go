package moderation

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
)

const sqlInsertReputationEvent = `insert into reputation_events (user_id, event_type, points, source_type, source_id, metadata)
 values ($1::uuid, $2, $3, $4, $5, $6::jsonb)
 on conflict (user_id, event_type, source_type, source_id) do nothing`

func insertReputationEventTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
	eventType string,
	points int,
	sourceType string,
	sourceID string,
	metadata map[string]any,
) error {
	if metadata == nil {
		metadata = map[string]any{}
	}
	payload, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = tx.Exec(
		ctx,
		sqlInsertReputationEvent,
		userID,
		eventType,
		points,
		sourceType,
		sourceID,
		payload,
	)
	return err
}
