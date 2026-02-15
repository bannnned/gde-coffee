package reviews

const (
	EventReviewCreated   = "review.created"
	EventReviewUpdated   = "review.updated"
	EventHelpfulAdded    = "vote.helpful_added"
	EventVisitVerified   = "visit.verified"
	EventAbuseConfirmed  = "abuse.confirmed"
	RatingFormulaVersion = "rating_v1"
)

const (
	IdempotencyScopeReviewPublish = "review.publish"
	IdempotencyScopeHelpfulVote   = "vote.helpful"
	IdempotencyScopeCheckIn       = "checkin.verify"
)
