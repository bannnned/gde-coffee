package metrics

import "time"

const (
	EventCafeCardOpen  = "cafe_card_open"
	EventReviewRead    = "review_read"
	EventRouteClick    = "route_click"
	EventCheckIn       = "checkin_start"
	EventReviewSubmit  = "review_submit"
	Provider2GIS       = "2gis"
	ProviderYandex     = "yandex"
	DefaultRangeDays   = 14
	MaxRangeDays       = 90
	MaxEventsPerIngest = 50
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
