package reviews

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
)

func (r *Repository) EnqueueEventTx(
	ctx context.Context,
	tx pgx.Tx,
	eventType string,
	aggregateID string,
	dedupeKey string,
	payload map[string]interface{},
) error {
	if payload == nil {
		payload = map[string]interface{}{}
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	_, err = tx.Exec(
		ctx,
		`insert into domain_events (event_type, aggregate_type, aggregate_id, dedupe_key, payload)
		 values ($1, 'cafe', $2::uuid, $3, $4::jsonb)
		 on conflict (dedupe_key) do nothing`,
		eventType,
		aggregateID,
		dedupeKey,
		payloadJSON,
	)
	return err
}

func (r *Repository) ClaimNextEvent(ctx context.Context) (*domainEvent, error) {
	var (
		evt domainEvent
		raw []byte
	)

	err := r.pool.QueryRow(
		ctx,
		`with next_event as (
			select id
			  from domain_events
			 where (status = 'pending' or (status = 'processing' and updated_at < now() - interval '5 minutes'))
			   and available_at <= now()
			 order by available_at asc, id asc
			 for update skip locked
			 limit 1
		)
		update domain_events e
		   set status = 'processing',
		       attempts = e.attempts + 1,
		       updated_at = now(),
		       last_error = null
		  from next_event
		 where e.id = next_event.id
		 returning e.id, e.event_type, e.aggregate_id::text, e.payload, e.attempts`,
	).Scan(&evt.ID, &evt.EventType, &evt.AggregateID, &raw, &evt.Attempts)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	evt.Payload = map[string]interface{}{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &evt.Payload); err != nil {
			return nil, err
		}
	}

	return &evt, nil
}

func (r *Repository) MarkEventProcessed(ctx context.Context, eventID int64) error {
	_, err := r.pool.Exec(
		ctx,
		`update domain_events
		    set status = 'processed',
		        updated_at = now(),
		        last_error = null
		  where id = $1`,
		eventID,
	)
	return err
}

func (r *Repository) MarkEventFailed(ctx context.Context, eventID int64, attempts int, lastErr string) error {
	backoffSeconds := 1 << minInt(attempts, 8)
	if backoffSeconds > 300 {
		backoffSeconds = 300
	}

	nextStatus := "pending"
	if attempts >= 20 {
		nextStatus = "failed"
	}

	nextAttemptAt := time.Now().Add(time.Duration(backoffSeconds) * time.Second)

	_, err := r.pool.Exec(
		ctx,
		`update domain_events
		    set status = $2,
		        available_at = $3,
		        updated_at = now(),
		        last_error = $4
		  where id = $1`,
		eventID,
		nextStatus,
		nextAttemptAt,
		truncateError(lastErr),
	)
	return err
}
