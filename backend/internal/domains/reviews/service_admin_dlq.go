package reviews

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	defaultAdminDLQLimit = 30
	maxAdminDLQLimit     = 200
	maxAdminDLQBulkLimit = 1000

	sqlListDomainEventDLQ = `select
	id,
	coalesce(inbox_event_id, 0),
	outbox_event_id,
	consumer,
	event_type,
	aggregate_id::text,
	payload,
	attempts,
	coalesce(last_error, ''),
	failed_at,
	resolved_at
from domain_event_dlq
where (
	$1 = 'all'
	or ($1 = 'open' and resolved_at is null)
	or ($1 = 'resolved' and resolved_at is not null)
)
order by failed_at desc, id desc
limit $2
offset $3`

	sqlSelectDomainEventDLQForReplay = `select
	id,
	coalesce(inbox_event_id, 0),
	outbox_event_id,
	consumer,
	event_type,
	aggregate_id::text,
	payload,
	resolved_at
from domain_event_dlq
where id = $1
for update`

	sqlResetInboxEventForReplay = `update domain_event_inbox
set status = 'pending',
	attempts = 0,
	available_at = now(),
	last_error = null,
	processed_at = null,
	updated_at = now()
where id = $1
returning id`

	sqlUpsertInboxEventForReplay = `insert into domain_event_inbox (
	outbox_event_id,
	consumer,
	event_type,
	aggregate_id,
	payload,
	status,
	attempts,
	available_at,
	last_error,
	processed_at
)
values ($1, $2, $3, $4::uuid, $5::jsonb, 'pending', 0, now(), null, null)
on conflict (outbox_event_id, consumer) do update
   set event_type = excluded.event_type,
       aggregate_id = excluded.aggregate_id,
       payload = excluded.payload,
       status = 'pending',
       attempts = 0,
       available_at = now(),
       last_error = null,
       processed_at = null,
       updated_at = now()
returning id`

	sqlResolveDomainEventDLQ = `update domain_event_dlq
set inbox_event_id = $2,
	resolved_at = now()
where id = $1`

	sqlSelectOpenDomainEventDLQIDs = `select id
from domain_event_dlq
where resolved_at is null
order by failed_at asc, id asc
limit $1`

	sqlResolveOpenDomainEventDLQ = `with target as (
	select id
	  from domain_event_dlq
	 where resolved_at is null
	 order by failed_at asc, id asc
	 limit $1
	 for update skip locked
)
update domain_event_dlq d
   set resolved_at = now()
  from target
 where d.id = target.id
 returning d.id`
)

type adminDLQEventRecord struct {
	ID            int64
	InboxEventID  int64
	OutboxEventID int64
	Consumer      string
	EventType     string
	AggregateID   string
	Payload       map[string]interface{}
	Attempts      int
	LastError     string
	FailedAt      time.Time
	ResolvedAt    *time.Time
}

func (s *Service) ListDomainEventDLQ(
	ctx context.Context,
	status string,
	limit int,
	offset int,
) ([]map[string]interface{}, error) {
	filter := normalizeDLQStatusFilter(status)
	if limit <= 0 {
		limit = defaultAdminDLQLimit
	}
	if limit > maxAdminDLQLimit {
		limit = maxAdminDLQLimit
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := s.repository.Pool().Query(ctx, sqlListDomainEventDLQ, filter, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := make([]map[string]interface{}, 0, limit)
	for rows.Next() {
		rec, err := scanAdminDLQEvent(rows)
		if err != nil {
			return nil, err
		}
		events = append(events, adminDLQEventToMap(rec))
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return events, nil
}

func (s *Service) ReplayDomainEventDLQ(
	ctx context.Context,
	dlqEventID int64,
) (map[string]interface{}, error) {
	tx, err := s.repository.Pool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	rec, err := loadAdminDLQEventForReplay(ctx, tx, dlqEventID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	inboxEventID := rec.InboxEventID
	if inboxEventID > 0 {
		resetErr := tx.QueryRow(ctx, sqlResetInboxEventForReplay, inboxEventID).Scan(&inboxEventID)
		if resetErr != nil && !errors.Is(resetErr, pgx.ErrNoRows) {
			return nil, resetErr
		}
		if errors.Is(resetErr, pgx.ErrNoRows) {
			inboxEventID = 0
		}
	}

	if inboxEventID == 0 {
		payloadJSON, err := json.Marshal(rec.Payload)
		if err != nil {
			return nil, err
		}
		if err := tx.QueryRow(
			ctx,
			sqlUpsertInboxEventForReplay,
			rec.OutboxEventID,
			rec.Consumer,
			rec.EventType,
			rec.AggregateID,
			payloadJSON,
		).Scan(&inboxEventID); err != nil {
			return nil, err
		}
	}

	if _, err := tx.Exec(ctx, sqlResolveDomainEventDLQ, rec.ID, inboxEventID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"dlq_event_id":    rec.ID,
		"outbox_event_id": rec.OutboxEventID,
		"inbox_event_id":  inboxEventID,
		"consumer":        rec.Consumer,
		"event_type":      rec.EventType,
		"was_resolved":    rec.ResolvedAt != nil,
		"replayed_at":     time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func (s *Service) ReplayAllOpenDomainEventDLQ(
	ctx context.Context,
	limit int,
) (map[string]interface{}, error) {
	bulkLimit := normalizeDLQBulkLimit(limit)
	rows, err := s.repository.Pool().Query(ctx, sqlSelectOpenDomainEventDLQIDs, bulkLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]int64, 0, bulkLimit)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	replayed := 0
	failed := 0
	errorsList := make([]string, 0, 8)
	for _, id := range ids {
		if _, err := s.ReplayDomainEventDLQ(ctx, id); err != nil {
			failed++
			if len(errorsList) < 8 {
				errorsList = append(errorsList, truncateError(err.Error()))
			}
			continue
		}
		replayed++
	}

	return map[string]interface{}{
		"limit":     bulkLimit,
		"processed": len(ids),
		"replayed":  replayed,
		"failed":    failed,
		"errors":    errorsList,
	}, nil
}

func (s *Service) ResolveOpenDomainEventDLQWithoutReplay(
	ctx context.Context,
	limit int,
) (map[string]interface{}, error) {
	bulkLimit := normalizeDLQBulkLimit(limit)
	rows, err := s.repository.Pool().Query(ctx, sqlResolveOpenDomainEventDLQ, bulkLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	resolved := 0
	for rows.Next() {
		var ignoredID int64
		if err := rows.Scan(&ignoredID); err != nil {
			return nil, err
		}
		resolved++
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"limit":    bulkLimit,
		"resolved": resolved,
	}, nil
}

func normalizeDLQStatusFilter(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "resolved":
		return "resolved"
	case "all":
		return "all"
	default:
		return "open"
	}
}

func normalizeDLQBulkLimit(limit int) int {
	if limit <= 0 {
		return maxAdminDLQBulkLimit
	}
	if limit > maxAdminDLQBulkLimit {
		return maxAdminDLQBulkLimit
	}
	return limit
}

func scanAdminDLQEvent(row pgx.Row) (adminDLQEventRecord, error) {
	var (
		rec        adminDLQEventRecord
		payloadRaw []byte
	)
	if err := row.Scan(
		&rec.ID,
		&rec.InboxEventID,
		&rec.OutboxEventID,
		&rec.Consumer,
		&rec.EventType,
		&rec.AggregateID,
		&payloadRaw,
		&rec.Attempts,
		&rec.LastError,
		&rec.FailedAt,
		&rec.ResolvedAt,
	); err != nil {
		return adminDLQEventRecord{}, err
	}

	rec.Payload = map[string]interface{}{}
	if len(payloadRaw) > 0 {
		if err := json.Unmarshal(payloadRaw, &rec.Payload); err != nil {
			return adminDLQEventRecord{}, err
		}
	}
	return rec, nil
}

func loadAdminDLQEventForReplay(
	ctx context.Context,
	tx pgx.Tx,
	dlqEventID int64,
) (adminDLQEventRecord, error) {
	var (
		rec        adminDLQEventRecord
		payloadRaw []byte
	)
	err := tx.QueryRow(ctx, sqlSelectDomainEventDLQForReplay, dlqEventID).Scan(
		&rec.ID,
		&rec.InboxEventID,
		&rec.OutboxEventID,
		&rec.Consumer,
		&rec.EventType,
		&rec.AggregateID,
		&payloadRaw,
		&rec.ResolvedAt,
	)
	if err != nil {
		return adminDLQEventRecord{}, err
	}

	rec.Payload = map[string]interface{}{}
	if len(payloadRaw) > 0 {
		if err := json.Unmarshal(payloadRaw, &rec.Payload); err != nil {
			return adminDLQEventRecord{}, err
		}
	}
	return rec, nil
}

func adminDLQEventToMap(rec adminDLQEventRecord) map[string]interface{} {
	var resolvedAt string
	if rec.ResolvedAt != nil {
		resolvedAt = rec.ResolvedAt.UTC().Format(time.RFC3339)
	}
	return map[string]interface{}{
		"id":              rec.ID,
		"inbox_event_id":  rec.InboxEventID,
		"outbox_event_id": rec.OutboxEventID,
		"consumer":        rec.Consumer,
		"event_type":      rec.EventType,
		"aggregate_id":    rec.AggregateID,
		"payload":         rec.Payload,
		"attempts":        rec.Attempts,
		"last_error":      rec.LastError,
		"failed_at":       rec.FailedAt.UTC().Format(time.RFC3339),
		"resolved_at":     resolvedAt,
	}
}
