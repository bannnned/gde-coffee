package reviews

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const sqlInsertReputationEvent = `insert into reputation_events (user_id, event_type, points, source_type, source_id, metadata)
 values ($1::uuid, $2, $3, $4, $5, $6::jsonb)
 on conflict (user_id, event_type, source_type, source_id) do nothing`

type reputationEventExecer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

func (r *Repository) AddReputationEvent(
	ctx context.Context,
	userID string,
	eventType string,
	points int,
	sourceType string,
	sourceID string,
	metadata map[string]interface{},
) error {
	return addReputationEventQuery(
		ctx,
		r.pool,
		userID,
		eventType,
		points,
		sourceType,
		sourceID,
		metadata,
	)
}

func (r *Repository) AddReputationEventTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
	eventType string,
	points int,
	sourceType string,
	sourceID string,
	metadata map[string]interface{},
) error {
	return addReputationEventQuery(
		ctx,
		tx,
		userID,
		eventType,
		points,
		sourceType,
		sourceID,
		metadata,
	)
}

func addReputationEventQuery(
	ctx context.Context,
	q reputationEventExecer,
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

	_, err = q.Exec(
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
