package metrics

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
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
