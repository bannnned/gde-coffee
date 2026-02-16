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
	ObjectKey string `json:"object_key"`
	FileURL   string `json:"file_url"`
	MimeType  string `json:"mime_type"`
	SizeBytes int64  `json:"size_bytes"`
}

type HelpfulVoteResponse struct {
	VoteID        string  `json:"vote_id"`
	ReviewID      string  `json:"review_id"`
	Weight        float64 `json:"weight"`
	AlreadyExists bool    `json:"already_exists"`
}

type VerifyVisitResponse struct {
	VerificationID string `json:"verification_id"`
	ReviewID       string `json:"review_id"`
	Confidence     string `json:"confidence"`
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
	FraudRisk            float64                `json:"fraud_risk"`
	Components           map[string]interface{} `json:"components"`
	ComputedAt           string                 `json:"computed_at"`
}
