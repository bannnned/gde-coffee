package reviews

type PublishReviewRequest struct {
	CafeID     string   `json:"cafe_id"`
	Rating     int      `json:"rating"`
	DrinkName  string   `json:"drink_name"`
	TasteTags  []string `json:"taste_tags"`
	Summary    string   `json:"summary"`
	PhotoCount int      `json:"photo_count"`
}

type VerifyVisitRequest struct {
	Confidence   string `json:"confidence"`
	DwellSeconds int    `json:"dwell_seconds"`
}

type ReportAbuseRequest struct {
	Reason  string `json:"reason"`
	Details string `json:"details"`
}
