package reviews

type PublishReviewRequest struct {
	CafeID    string              `json:"cafe_id"`
	Rating    int                 `json:"rating"`
	DrinkID   string              `json:"drink_id"`
	Drink     string              `json:"drink"`
	Positions []ReviewPositionDTO `json:"positions"`
	TasteTags []string            `json:"taste_tags"`
	Summary   string              `json:"summary"`
	Photos    []string            `json:"photos"`
}

type UpdateReviewRequest struct {
	Rating    *int                 `json:"rating"`
	DrinkID   *string              `json:"drink_id"`
	Drink     *string              `json:"drink"`
	Positions *[]ReviewPositionDTO `json:"positions"`
	TasteTags *[]string            `json:"taste_tags"`
	Summary   *string              `json:"summary"`
	Photos    *[]string            `json:"photos"`
}

type ReviewPositionDTO struct {
	DrinkID string `json:"drink_id"`
	Drink   string `json:"drink"`
}

type PresignReviewPhotoRequest struct {
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
}

type ConfirmReviewPhotoRequest struct {
	ObjectKey string `json:"object_key"`
}

type StartCheckInRequest struct {
	Lat    float64 `json:"lat"`
	Lng    float64 `json:"lng"`
	Source string  `json:"source"`
}

type AdminCreateDrinkRequest struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Aliases        []string `json:"aliases"`
	Description    string   `json:"description"`
	Category       string   `json:"category"`
	PopularityRank *int     `json:"popularity_rank"`
	IsActive       *bool    `json:"is_active"`
}

type AdminUpdateDrinkRequest struct {
	Name           *string   `json:"name"`
	Aliases        *[]string `json:"aliases"`
	Description    *string   `json:"description"`
	Category       *string   `json:"category"`
	PopularityRank *int      `json:"popularity_rank"`
	IsActive       *bool     `json:"is_active"`
}

type AdminMapUnknownDrinkRequest struct {
	DrinkID  string `json:"drink_id"`
	AddAlias *bool  `json:"add_alias"`
}

type VerifyVisitRequest struct {
	CheckInID    string   `json:"checkin_id"`
	Lat          *float64 `json:"lat"`
	Lng          *float64 `json:"lng"`
	Confidence   string   `json:"confidence"`
	DwellSeconds int      `json:"dwell_seconds"`
}

type ReportAbuseRequest struct {
	Reason  string `json:"reason"`
	Details string `json:"details"`
}
