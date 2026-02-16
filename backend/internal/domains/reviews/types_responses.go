package reviews

type PublishReviewResponse struct {
	ReviewID  string `json:"review_id"`
	CafeID    string `json:"cafe_id"`
	EventType string `json:"event_type"`
	Created   bool   `json:"created"`
	UpdatedAt string `json:"updated_at"`
}

type PresignReviewPhotoResponse struct {
	UploadURL string            `json:"upload_url"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers"`
	ObjectKey string            `json:"object_key"`
	FileURL   string            `json:"file_url"`
	ExpiresAt string            `json:"expires_at"`
}

type ConfirmReviewPhotoResponse struct {
	PhotoID   string `json:"photo_id,omitempty"`
	Status    string `json:"status,omitempty"`
	ObjectKey string `json:"object_key"`
	FileURL   string `json:"file_url"`
	MimeType  string `json:"mime_type"`
	SizeBytes int64  `json:"size_bytes"`
	Error     string `json:"error,omitempty"`
}

type HelpfulVoteResponse struct {
	VoteID        string  `json:"vote_id"`
	ReviewID      string  `json:"review_id"`
	Weight        float64 `json:"weight"`
	AlreadyExists bool    `json:"already_exists"`
}

type StartCheckInResponse struct {
	CheckInID       string `json:"checkin_id"`
	CafeID          string `json:"cafe_id"`
	Status          string `json:"status"`
	DistanceMeters  int    `json:"distance_meters"`
	MinDwellSeconds int    `json:"min_dwell_seconds"`
	CanVerifyAfter  string `json:"can_verify_after"`
}

type VerifyVisitResponse struct {
	VerificationID string `json:"verification_id"`
	ReviewID       string `json:"review_id"`
	Confidence     string `json:"confidence"`
	CheckInID      string `json:"checkin_id,omitempty"`
	DwellSeconds   int    `json:"dwell_seconds,omitempty"`
}

type ReportAbuseResponse struct {
	ReportID string `json:"report_id"`
	Status   string `json:"status"`
}

type ConfirmAbuseResponse struct {
	ReportID string `json:"report_id"`
	Status   string `json:"status"`
}

type CafeRatingSnapshotResponse struct {
	CafeID               string                 `json:"cafe_id"`
	FormulaVersion       string                 `json:"formula_version"`
	Rating               float64                `json:"rating"`
	ReviewsCount         int                    `json:"reviews_count"`
	VerifiedReviewsCount int                    `json:"verified_reviews_count"`
	VerifiedShare        float64                `json:"verified_share"`
	FraudRisk            float64                `json:"fraud_risk"`
	BestReview           map[string]interface{} `json:"best_review,omitempty"`
	Components           map[string]interface{} `json:"components"`
	ComputedAt           string                 `json:"computed_at"`
}
