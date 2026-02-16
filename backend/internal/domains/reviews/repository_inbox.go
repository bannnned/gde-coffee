package reviews

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	sqlInsertDomainInboxEvent = `insert into domain_event_inbox (
	outbox_event_id,
	consumer,
	event_type,
	aggregate_id,
	payload
)
values ($1, $2, $3, $4::uuid, $5::jsonb)
on conflict (outbox_event_id, consumer) do nothing`

	sqlClaimNextDomainInboxEvent = `with next_event as (
	select id
	  from domain_event_inbox
	 where (status = 'pending' or (status = 'processing' and updated_at < now() - interval '5 minutes'))
	   and available_at <= now()
	 order by available_at asc, id asc
	 for update skip locked
	 limit 1
)
update domain_event_inbox e
   set status = 'processing',
       attempts = e.attempts + 1,
       updated_at = now(),
       last_error = null
  from next_event
 where e.id = next_event.id
 returning e.id,
          e.outbox_event_id,
          e.consumer,
          e.event_type,
          e.aggregate_id::text,
          e.payload,
          e.attempts`

	sqlMarkDomainInboxEventProcessed = `update domain_event_inbox
    set status = 'processed',
        processed_at = now(),
        updated_at = now(),
        last_error = null
  where id = $1`

	sqlMarkDomainInboxEventFailed = `update domain_event_inbox
    set status = $2,
        available_at = $3,
        updated_at = now(),
        last_error = $4
  where id = $1`

	sqlUpsertDomainEventDLQ = `insert into domain_event_dlq (
	inbox_event_id,
	outbox_event_id,
	consumer,
	event_type,
	aggregate_id,
	payload,
	attempts,
	last_error,
	failed_at
)
values ($1, $2, $3, $4, $5::uuid, $6::jsonb, $7, $8, now())
on conflict (outbox_event_id, consumer) do update
   set inbox_event_id = excluded.inbox_event_id,
       event_type = excluded.event_type,
       aggregate_id = excluded.aggregate_id,
       payload = excluded.payload,
       attempts = excluded.attempts,
       last_error = excluded.last_error,
       failed_at = now(),
       resolved_at = null`
)

const (
	domainInboxBackoffMaxSeconds = 300
	domainInboxMaxAttempts       = 20
)

func (r *Repository) EnqueueInboxEvents(
	ctx context.Context,
	evt domainEvent,
	consumers []string,
) error {
	if len(consumers) == 0 {
		return nil
	}

	payload := evt.Payload
	if payload == nil {
		payload = map[string]interface{}{}
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, consumer := range consumers {
		nextConsumer := strings.TrimSpace(consumer)
		if nextConsumer == "" {
			continue
		}
		if _, err := tx.Exec(
			ctx,
			sqlInsertDomainInboxEvent,
			evt.ID,
			nextConsumer,
			evt.EventType,
			evt.AggregateID,
			payloadJSON,
		); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *Repository) ClaimNextInboxEvent(ctx context.Context) (*domainInboxEvent, error) {
	var (
		evt domainInboxEvent
		raw []byte
	)

	err := r.pool.QueryRow(ctx, sqlClaimNextDomainInboxEvent).Scan(
		&evt.ID,
		&evt.OutboxEventID,
		&evt.Consumer,
		&evt.EventType,
		&evt.AggregateID,
		&raw,
		&evt.Attempts,
	)
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

func (r *Repository) MarkInboxEventProcessed(ctx context.Context, inboxEventID int64) error {
	_, err := r.pool.Exec(ctx, sqlMarkDomainInboxEventProcessed, inboxEventID)
	return err
}

func (r *Repository) MarkInboxEventFailed(
	ctx context.Context,
	evt domainInboxEvent,
	lastErr string,
) (bool, error) {
	attempts := maxInt(evt.Attempts, 0)
	nextStatus := "pending"
	nextAttemptAt := time.Now().Add(time.Duration(1<<minInt(attempts, 8)) * time.Second)
	if time.Until(nextAttemptAt) > domainInboxBackoffMaxSeconds*time.Second {
		nextAttemptAt = time.Now().Add(domainInboxBackoffMaxSeconds * time.Second)
	}

	isTerminal := attempts >= domainInboxMaxAttempts
	if isTerminal {
		nextStatus = "failed"
		nextAttemptAt = time.Now()
	}

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(
		ctx,
		sqlMarkDomainInboxEventFailed,
		evt.ID,
		nextStatus,
		nextAttemptAt,
		truncateError(lastErr),
	); err != nil {
		return false, err
	}

	if isTerminal {
		payload := evt.Payload
		if payload == nil {
			payload = map[string]interface{}{}
		}
		payloadJSON, err := json.Marshal(payload)
		if err != nil {
			return false, err
		}
		if _, err := tx.Exec(
			ctx,
			sqlUpsertDomainEventDLQ,
			evt.ID,
			evt.OutboxEventID,
			evt.Consumer,
			evt.EventType,
			evt.AggregateID,
			payloadJSON,
			attempts,
			truncateError(lastErr),
		); err != nil {
			return false, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return isTerminal, nil
}
