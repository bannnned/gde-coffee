package reputation

const (
	EventHelpfulReceived      = "helpful_received"
	EventVisitVerified        = "visit_verified"
	EventAbuseConfirmed       = "abuse_confirmed"
	EventDataUpdateApproved   = "data_update_approved"
	EventCafeCreateApproved   = "cafe_create_approved"
	EventReviewRemovedPenalty = "review_removed_violation"
)

const (
	SourceHelpfulVote          = "helpful_vote"
	SourceVisitVerification    = "visit_verification"
	SourceAbuseReport          = "abuse_report"
	SourceModerationSubmission = "moderation_submission"
	SourceReviewModeration     = "review_moderation"
)

const (
	PointsHelpfulBase          = 2.0
	PointsVisitLow             = 3
	PointsVisitMedium          = 6
	PointsVisitHigh            = 8
	PointsAbuseConfirmed       = -25
	PointsDataUpdateApproved   = 4
	PointsCafeCreateApproved   = 8
	PointsReviewRemovedPenalty = -15
)
