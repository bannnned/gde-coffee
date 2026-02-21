package metrics

import "time"

const (
	EventReviewRead    = "review_read"
	EventRouteClick    = "route_click"
	EventCheckIn       = "checkin_start"
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
