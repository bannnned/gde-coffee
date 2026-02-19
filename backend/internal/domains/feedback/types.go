package feedback

import "time"

const (
	maxFeedbackMessageRunes   = 4000
	maxFeedbackContactRunes   = 255
	maxFeedbackUserAgentRunes = 512
	defaultAdminFeedbackLimit = 30
	maxAdminFeedbackLimit     = 200
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

type AdminFeedbackItem struct {
	ID              int64     `json:"id"`
	UserID          string    `json:"user_id"`
	UserEmail       string    `json:"user_email"`
	UserDisplayName string    `json:"user_display_name"`
	Message         string    `json:"message"`
	Contact         string    `json:"contact"`
	UserAgent       string    `json:"user_agent"`
	CreatedAt       time.Time `json:"created_at"`
}

type AdminFeedbackList struct {
	Items []AdminFeedbackItem
	Total int
}
