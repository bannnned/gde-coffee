package metrics

import "time"

const (
	EventCafeCardOpen        = "cafe_card_open"
	EventReviewRead          = "review_read"
	EventRouteClick          = "route_click"
	EventCheckIn             = "checkin_start"
	EventReviewSubmit        = "review_submit"
	EventMapFirstRender      = "map_first_render"
	EventMapFirstInteraction = "map_first_interaction"
	Provider2GIS             = "2gis"
	ProviderYandex           = "yandex"
	DefaultRangeDays         = 14
	MaxRangeDays             = 90
	MaxEventsPerIngest       = 50
)

type EventInput struct {
	ClientEventID string
	EventType     string
	UserID        string
	AnonID        string
	JourneyID     string
	CafeID        string
	ReviewID      string
	Provider      string
	OccurredAt    time.Time
	Metadata      map[string]interface{}
}

type DailyNorthStarMetrics struct {
	Day                 time.Time
	VisitIntentJourneys int
	NorthStarJourneys   int
}

type NorthStarDailyPoint struct {
	Date                string  `json:"date"`
	VisitIntentJourneys int     `json:"visit_intent_journeys"`
	NorthStarJourneys   int     `json:"north_star_journeys"`
	Rate                float64 `json:"rate"`
}

type NorthStarSummary struct {
	From                string  `json:"from"`
	To                  string  `json:"to"`
	Days                int     `json:"days"`
	CafeID              string  `json:"cafe_id,omitempty"`
	VisitIntentJourneys int     `json:"visit_intent_journeys"`
	NorthStarJourneys   int     `json:"north_star_journeys"`
	Rate                float64 `json:"rate"`
}

type NorthStarReport struct {
	Summary NorthStarSummary      `json:"summary"`
	Daily   []NorthStarDailyPoint `json:"daily"`
}

type FunnelJourneyCounts struct {
	CardOpenJourneys     int
	ReviewReadJourneys   int
	RouteClickJourneys   int
	CheckInJourneys      int
	ReviewSubmitJourneys int
}

type FunnelSummary struct {
	From   string `json:"from"`
	To     string `json:"to"`
	Days   int    `json:"days"`
	CafeID string `json:"cafe_id,omitempty"`
}

type FunnelStage struct {
	Key                 string  `json:"key"`
	Label               string  `json:"label"`
	Journeys            int     `json:"journeys"`
	ConversionFromPrev  float64 `json:"conversion_from_prev"`
	ConversionFromStart float64 `json:"conversion_from_start"`
}

type FunnelReport struct {
	Summary FunnelSummary `json:"summary"`
	Stages  []FunnelStage `json:"stages"`
}

type MapPerfSnapshot struct {
	FirstRenderEvents      int
	FirstRenderP50Ms       float64
	FirstRenderP95Ms       float64
	FirstInteractionEvents int
	FirstInteractionP50Ms  float64
	FirstInteractionP95Ms  float64
}

type MapPerfDailyMetrics struct {
	Day                    time.Time
	FirstRenderEvents      int
	FirstRenderP50Ms       float64
	FirstRenderP95Ms       float64
	FirstInteractionEvents int
	FirstInteractionP50Ms  float64
	FirstInteractionP95Ms  float64
}

type MapPerfNetworkMetrics struct {
	EffectiveType          string
	FirstRenderEvents      int
	FirstRenderP50Ms       float64
	FirstRenderP95Ms       float64
	FirstInteractionEvents int
	FirstInteractionP50Ms  float64
	FirstInteractionP95Ms  float64
}

type MapPerfSummary struct {
	From                   string  `json:"from"`
	To                     string  `json:"to"`
	Days                   int     `json:"days"`
	FirstRenderEvents      int     `json:"first_render_events"`
	FirstRenderP50Ms       float64 `json:"first_render_p50_ms"`
	FirstRenderP95Ms       float64 `json:"first_render_p95_ms"`
	FirstInteractionEvents int     `json:"first_interaction_events"`
	FirstInteractionP50Ms  float64 `json:"first_interaction_p50_ms"`
	FirstInteractionP95Ms  float64 `json:"first_interaction_p95_ms"`
	InteractionCoverage    float64 `json:"interaction_coverage"`
}

type MapPerfDailyPoint struct {
	Date                   string  `json:"date"`
	FirstRenderEvents      int     `json:"first_render_events"`
	FirstRenderP50Ms       float64 `json:"first_render_p50_ms"`
	FirstRenderP95Ms       float64 `json:"first_render_p95_ms"`
	FirstInteractionEvents int     `json:"first_interaction_events"`
	FirstInteractionP50Ms  float64 `json:"first_interaction_p50_ms"`
	FirstInteractionP95Ms  float64 `json:"first_interaction_p95_ms"`
	InteractionCoverage    float64 `json:"interaction_coverage"`
}

type MapPerfNetworkPoint struct {
	EffectiveType          string  `json:"effective_type"`
	FirstRenderEvents      int     `json:"first_render_events"`
	FirstRenderP50Ms       float64 `json:"first_render_p50_ms"`
	FirstRenderP95Ms       float64 `json:"first_render_p95_ms"`
	FirstInteractionEvents int     `json:"first_interaction_events"`
	FirstInteractionP50Ms  float64 `json:"first_interaction_p50_ms"`
	FirstInteractionP95Ms  float64 `json:"first_interaction_p95_ms"`
	InteractionCoverage    float64 `json:"interaction_coverage"`
}

type MapPerfAlert struct {
	Key      string `json:"key"`
	Severity string `json:"severity"`
	Label    string `json:"label"`
	Value    string `json:"value"`
	Target   string `json:"target"`
}

type MapPerfHistoryPoint struct {
	Date                  string  `json:"date"`
	Status                string  `json:"status"`
	FirstRenderP95Ms      float64 `json:"first_render_p95_ms"`
	FirstInteractionP95Ms float64 `json:"first_interaction_p95_ms"`
	InteractionCoverage   float64 `json:"interaction_coverage"`
	TrendDeltaPct         float64 `json:"trend_delta_pct"`
}

type MapPerfReport struct {
	Summary MapPerfSummary        `json:"summary"`
	Daily   []MapPerfDailyPoint   `json:"daily"`
	Network []MapPerfNetworkPoint `json:"network"`
	Alerts  []MapPerfAlert        `json:"alerts"`
	History []MapPerfHistoryPoint `json:"history"`
}

type ingestEventRequest struct {
	ClientEventID string                 `json:"client_event_id"`
	EventType     string                 `json:"event_type"`
	AnonID        string                 `json:"anon_id"`
	JourneyID     string                 `json:"journey_id"`
	CafeID        string                 `json:"cafe_id"`
	ReviewID      string                 `json:"review_id"`
	Provider      string                 `json:"provider"`
	OccurredAt    string                 `json:"occurred_at"`
	Meta          map[string]interface{} `json:"meta"`
}

type ingestEventsRequest struct {
	Events []ingestEventRequest `json:"events"`
}
