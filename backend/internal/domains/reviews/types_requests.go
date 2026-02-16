package reviews

type PublishReviewRequest struct {
	CafeID    string   `json:"cafe_id"`
	Rating    int      `json:"rating"`
	DrinkID   string   `json:"drink_id"`
	TasteTags []string `json:"taste_tags"`
	Summary   string   `json:"summary"`
	Photos    []string `json:"photos"`
}

type UpdateReviewRequest struct {
	Rating    *int      `json:"rating"`
	DrinkID   *string   `json:"drink_id"`
	TasteTags *[]string `json:"taste_tags"`
	Summary   *string   `json:"summary"`
	Photos    *[]string `json:"photos"`
}

type VerifyVisitRequest struct {
	Confidence   string `json:"confidence"`
	DwellSeconds int    `json:"dwell_seconds"`
}

type ReportAbuseRequest struct {
	Reason  string `json:"reason"`
	Details string `json:"details"`
}
