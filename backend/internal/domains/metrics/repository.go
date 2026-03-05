package metrics

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func (r *Repository) ListMapPerfAlertStates(ctx context.Context) ([]MapPerfAlertState, error) {
	const query = `select
	alert_key,
	state,
	snoozed_until,
	acknowledged_at,
	coalesce(acknowledged_by::text, '') as acknowledged_by
from public.product_metrics_alert_states`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]MapPerfAlertState, 0, 8)
	for rows.Next() {
		var row MapPerfAlertState
		if err := rows.Scan(
			&row.AlertKey,
			&row.State,
			&row.SnoozedUntil,
			&row.AcknowledgedAt,
			&row.AcknowledgedBy,
		); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) UpsertMapPerfAlertState(ctx context.Context, state MapPerfAlertState) error {
	key := strings.TrimSpace(state.AlertKey)
	if key == "" {
		return nil
	}
	const query = `insert into public.product_metrics_alert_states (
	alert_key,
	state,
	snoozed_until,
	acknowledged_at,
	acknowledged_by,
	updated_at
) values (
	$1,
	$2,
	$3,
	$4,
	nullif($5, '')::uuid,
	now()
)
on conflict (alert_key) do update
set
	state = excluded.state,
	snoozed_until = excluded.snoozed_until,
	acknowledged_at = excluded.acknowledged_at,
	acknowledged_by = excluded.acknowledged_by,
	updated_at = now()`

	_, err := r.pool.Exec(
		ctx,
		query,
		key,
		state.State,
		state.SnoozedUntil,
		state.AcknowledgedAt,
		state.AcknowledgedBy,
	)
	return err
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) InsertEvents(ctx context.Context, events []EventInput) (int, error) {
	if len(events) == 0 {
		return 0, nil
	}

	const insertSQL = `insert into public.product_metrics_events (
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
	$2,
	nullif($3, '')::uuid,
	$4,
	$5,
	nullif($6, '')::uuid,
	nullif($7, '')::uuid,
	$8,
	$9,
	$10::jsonb
)
on conflict do nothing`

	ingested := 0
	for _, event := range events {
		metadata := event.Metadata
		if metadata == nil {
			metadata = map[string]interface{}{}
		}
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			return ingested, err
		}

		tag, err := r.pool.Exec(
			ctx,
			insertSQL,
			event.ClientEventID,
			event.EventType,
			event.UserID,
			event.AnonID,
			event.JourneyID,
			event.CafeID,
			event.ReviewID,
			event.Provider,
			event.OccurredAt.UTC(),
			metadataJSON,
		)
		if err != nil {
			return ingested, err
		}
		ingested += int(tag.RowsAffected())
	}

	return ingested, nil
}

func (r *Repository) ListDailyNorthStarMetrics(
	ctx context.Context,
	dateFrom time.Time,
	dateTo time.Time,
	cafeID string,
) ([]DailyNorthStarMetrics, error) {
	const query = `with intents as (
	select
		journey_id,
		min(occurred_at) as intent_at
	from public.product_metrics_events
	where event_type in ('route_click', 'checkin_start')
	  and journey_id <> ''
	  and (nullif($3, '')::uuid is null or cafe_id = nullif($3, '')::uuid)
	  and occurred_at >= $1
	  and occurred_at < $2
	group by journey_id
), qualified_reads as (
	select
		e.journey_id,
		min(e.occurred_at) as read_at
	from public.product_metrics_events e
	join public.visit_verifications vv
	  on vv.review_id = e.review_id
	 and vv.verified_at is not null
	 and coalesce(vv.confidence, 'none') <> 'none'
	join (
		select review_id
		from public.helpful_votes
		group by review_id
	) hv on hv.review_id = e.review_id
	where e.event_type = 'review_read'
	  and e.journey_id <> ''
	  and (nullif($3, '')::uuid is null or e.cafe_id = nullif($3, '')::uuid)
	  and e.occurred_at >= ($1 - interval '7 days')
	  and e.occurred_at < $2
	group by e.journey_id
), journeys as (
	select
		i.journey_id,
		i.intent_at,
		exists (
			select 1
			from qualified_reads qr
			where qr.journey_id = i.journey_id
			  and qr.read_at <= i.intent_at
		) as qualified
	from intents i
)
select
	date_trunc('day', intent_at)::date as day,
	count(*)::int as visit_intent_journeys,
	count(*) filter (where qualified)::int as north_star_journeys
from journeys
group by day
order by day asc`

	rows, err := r.pool.Query(ctx, query, dateFrom.UTC(), dateTo.UTC(), cafeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]DailyNorthStarMetrics, 0, 32)
	for rows.Next() {
		var row DailyNorthStarMetrics
		if err := rows.Scan(&row.Day, &row.VisitIntentJourneys, &row.NorthStarJourneys); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func (r *Repository) GetFunnelJourneyCounts(
	ctx context.Context,
	dateFrom time.Time,
	dateTo time.Time,
	cafeID string,
) (FunnelJourneyCounts, error) {
	const query = `with journey_events as (
	select
		journey_id,
		min(case when event_type = 'cafe_card_open' then occurred_at end) as card_open_at,
		min(case when event_type = 'review_read' then occurred_at end) as review_read_at,
		min(case when event_type = 'route_click' then occurred_at end) as route_click_at,
		min(case when event_type = 'checkin_start' then occurred_at end) as checkin_start_at,
		min(case when event_type = 'review_submit' then occurred_at end) as review_submit_at
	from public.product_metrics_events
	where journey_id <> ''
	  and occurred_at >= $1
	  and occurred_at < $2
	  and (nullif($3, '')::uuid is null or cafe_id = nullif($3, '')::uuid)
	group by journey_id
), stage_flags as (
	select
		journey_id,
		(card_open_at is not null) as reached_card_open,
		(card_open_at is not null and review_read_at is not null and review_read_at >= card_open_at) as reached_review_read,
		(card_open_at is not null and review_read_at is not null and route_click_at is not null and route_click_at >= review_read_at) as reached_route_click,
		(card_open_at is not null and review_read_at is not null and route_click_at is not null and checkin_start_at is not null and checkin_start_at >= route_click_at) as reached_checkin,
		(card_open_at is not null and review_read_at is not null and route_click_at is not null and checkin_start_at is not null and review_submit_at is not null and review_submit_at >= checkin_start_at) as reached_review_submit
	from journey_events
)
select
	count(*) filter (where reached_card_open)::int as card_open_journeys,
	count(*) filter (where reached_review_read)::int as review_read_journeys,
	count(*) filter (where reached_route_click)::int as route_click_journeys,
	count(*) filter (where reached_checkin)::int as checkin_journeys,
	count(*) filter (where reached_review_submit)::int as review_submit_journeys
from stage_flags`

	var counts FunnelJourneyCounts
	if err := r.pool.QueryRow(ctx, query, dateFrom.UTC(), dateTo.UTC(), cafeID).Scan(
		&counts.CardOpenJourneys,
		&counts.ReviewReadJourneys,
		&counts.RouteClickJourneys,
		&counts.CheckInJourneys,
		&counts.ReviewSubmitJourneys,
	); err != nil {
		return FunnelJourneyCounts{}, err
	}

	return counts, nil
}

func (r *Repository) GetMapPerfSnapshot(
	ctx context.Context,
	dateFrom time.Time,
	dateTo time.Time,
) (MapPerfSnapshot, error) {
	const query = `with render_events as (
	select
		case
			when coalesce(metadata->>'map_init_elapsed_ms', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
			then (metadata->>'map_init_elapsed_ms')::double precision
			else null
		end as map_init_ms
	from public.product_metrics_events
	where event_type = 'map_first_render'
	  and occurred_at >= $1
	  and occurred_at < $2
), interaction_events as (
	select
		case
			when coalesce(metadata->>'map_init_elapsed_ms', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
			then (metadata->>'map_init_elapsed_ms')::double precision
			else null
		end as map_init_ms
	from public.product_metrics_events
	where event_type = 'map_first_interaction'
	  and occurred_at >= $1
	  and occurred_at < $2
), render_agg as (
	select
		count(*) filter (where map_init_ms is not null)::int as first_render_events,
		coalesce(percentile_cont(0.5) within group (order by map_init_ms), 0)::double precision as first_render_p50_ms,
		coalesce(percentile_cont(0.95) within group (order by map_init_ms), 0)::double precision as first_render_p95_ms
	from render_events
), interaction_agg as (
	select
		count(*) filter (where map_init_ms is not null)::int as first_interaction_events,
		coalesce(percentile_cont(0.5) within group (order by map_init_ms), 0)::double precision as first_interaction_p50_ms,
		coalesce(percentile_cont(0.95) within group (order by map_init_ms), 0)::double precision as first_interaction_p95_ms
	from interaction_events
)
select
	r.first_render_events,
	r.first_render_p50_ms,
	r.first_render_p95_ms,
	i.first_interaction_events,
	i.first_interaction_p50_ms,
	i.first_interaction_p95_ms
from render_agg r
cross join interaction_agg i`

	var snapshot MapPerfSnapshot
	if err := r.pool.QueryRow(ctx, query, dateFrom.UTC(), dateTo.UTC()).Scan(
		&snapshot.FirstRenderEvents,
		&snapshot.FirstRenderP50Ms,
		&snapshot.FirstRenderP95Ms,
		&snapshot.FirstInteractionEvents,
		&snapshot.FirstInteractionP50Ms,
		&snapshot.FirstInteractionP95Ms,
	); err != nil {
		return MapPerfSnapshot{}, err
	}

	return snapshot, nil
}

func (r *Repository) ListMapPerfDailyMetrics(
	ctx context.Context,
	dateFrom time.Time,
	dateTo time.Time,
) ([]MapPerfDailyMetrics, error) {
	const query = `with render_events as (
	select
		date_trunc('day', occurred_at)::date as day,
		case
			when coalesce(metadata->>'map_init_elapsed_ms', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
			then (metadata->>'map_init_elapsed_ms')::double precision
			else null
		end as map_init_ms
	from public.product_metrics_events
	where event_type = 'map_first_render'
	  and occurred_at >= $1
	  and occurred_at < $2
), interaction_events as (
	select
		date_trunc('day', occurred_at)::date as day,
		case
			when coalesce(metadata->>'map_init_elapsed_ms', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
			then (metadata->>'map_init_elapsed_ms')::double precision
			else null
		end as map_init_ms
	from public.product_metrics_events
	where event_type = 'map_first_interaction'
	  and occurred_at >= $1
	  and occurred_at < $2
), render_agg as (
	select
		day,
		count(*) filter (where map_init_ms is not null)::int as first_render_events,
		coalesce(percentile_cont(0.5) within group (order by map_init_ms), 0)::double precision as first_render_p50_ms,
		coalesce(percentile_cont(0.95) within group (order by map_init_ms), 0)::double precision as first_render_p95_ms
	from render_events
	group by day
), interaction_agg as (
	select
		day,
		count(*) filter (where map_init_ms is not null)::int as first_interaction_events,
		coalesce(percentile_cont(0.5) within group (order by map_init_ms), 0)::double precision as first_interaction_p50_ms,
		coalesce(percentile_cont(0.95) within group (order by map_init_ms), 0)::double precision as first_interaction_p95_ms
	from interaction_events
	group by day
)
select
	coalesce(r.day, i.day) as day,
	coalesce(r.first_render_events, 0) as first_render_events,
	coalesce(r.first_render_p50_ms, 0)::double precision as first_render_p50_ms,
	coalesce(r.first_render_p95_ms, 0)::double precision as first_render_p95_ms,
	coalesce(i.first_interaction_events, 0) as first_interaction_events,
	coalesce(i.first_interaction_p50_ms, 0)::double precision as first_interaction_p50_ms,
	coalesce(i.first_interaction_p95_ms, 0)::double precision as first_interaction_p95_ms
from render_agg r
full join interaction_agg i on i.day = r.day
order by day asc`

	rows, err := r.pool.Query(ctx, query, dateFrom.UTC(), dateTo.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]MapPerfDailyMetrics, 0, 32)
	for rows.Next() {
		var row MapPerfDailyMetrics
		if err := rows.Scan(
			&row.Day,
			&row.FirstRenderEvents,
			&row.FirstRenderP50Ms,
			&row.FirstRenderP95Ms,
			&row.FirstInteractionEvents,
			&row.FirstInteractionP50Ms,
			&row.FirstInteractionP95Ms,
		); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func (r *Repository) ListMapPerfNetworkMetrics(
	ctx context.Context,
	dateFrom time.Time,
	dateTo time.Time,
) ([]MapPerfNetworkMetrics, error) {
	const query = `with render_events as (
	select
		coalesce(nullif(lower(trim(metadata->>'effective_type')), ''), 'unknown') as effective_type,
		case
			when coalesce(metadata->>'map_init_elapsed_ms', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
			then (metadata->>'map_init_elapsed_ms')::double precision
			else null
		end as map_init_ms
	from public.product_metrics_events
	where event_type = 'map_first_render'
	  and occurred_at >= $1
	  and occurred_at < $2
), interaction_events as (
	select
		coalesce(nullif(lower(trim(metadata->>'effective_type')), ''), 'unknown') as effective_type,
		case
			when coalesce(metadata->>'map_init_elapsed_ms', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
			then (metadata->>'map_init_elapsed_ms')::double precision
			else null
		end as map_init_ms
	from public.product_metrics_events
	where event_type = 'map_first_interaction'
	  and occurred_at >= $1
	  and occurred_at < $2
), render_agg as (
	select
		effective_type,
		count(*) filter (where map_init_ms is not null)::int as first_render_events,
		coalesce(percentile_cont(0.5) within group (order by map_init_ms), 0)::double precision as first_render_p50_ms,
		coalesce(percentile_cont(0.95) within group (order by map_init_ms), 0)::double precision as first_render_p95_ms
	from render_events
	group by effective_type
), interaction_agg as (
	select
		effective_type,
		count(*) filter (where map_init_ms is not null)::int as first_interaction_events,
		coalesce(percentile_cont(0.5) within group (order by map_init_ms), 0)::double precision as first_interaction_p50_ms,
		coalesce(percentile_cont(0.95) within group (order by map_init_ms), 0)::double precision as first_interaction_p95_ms
	from interaction_events
	group by effective_type
)
select
	coalesce(r.effective_type, i.effective_type) as effective_type,
	coalesce(r.first_render_events, 0) as first_render_events,
	coalesce(r.first_render_p50_ms, 0)::double precision as first_render_p50_ms,
	coalesce(r.first_render_p95_ms, 0)::double precision as first_render_p95_ms,
	coalesce(i.first_interaction_events, 0) as first_interaction_events,
	coalesce(i.first_interaction_p50_ms, 0)::double precision as first_interaction_p50_ms,
	coalesce(i.first_interaction_p95_ms, 0)::double precision as first_interaction_p95_ms
from render_agg r
full join interaction_agg i on i.effective_type = r.effective_type
order by first_render_events desc, effective_type asc`

	rows, err := r.pool.Query(ctx, query, dateFrom.UTC(), dateTo.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]MapPerfNetworkMetrics, 0, 8)
	for rows.Next() {
		var row MapPerfNetworkMetrics
		if err := rows.Scan(
			&row.EffectiveType,
			&row.FirstRenderEvents,
			&row.FirstRenderP50Ms,
			&row.FirstRenderP95Ms,
			&row.FirstInteractionEvents,
			&row.FirstInteractionP50Ms,
			&row.FirstInteractionP95Ms,
		); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}
