package feedback

const (
	maxFeedbackMessageRunes   = 4000
	maxFeedbackContactRunes   = 255
	maxFeedbackUserAgentRunes = 512
)

type createFeedbackRequest struct {
	Message string `json:"message"`
	Contact string `json:"contact"`
}

type CreateFeedbackInput struct {
	UserID    string
	Message   string
	Contact   string
	UserAgent string
}
