package feedback

import (
	"context"
	"fmt"
	"html"
	"log"
	"strings"
)

type emailSender interface {
	SendEmail(ctx context.Context, to, subject, textBody, htmlBody string) error
}

type repository interface {
	Create(ctx context.Context, input CreateFeedbackInput) error
	ListAdmin(ctx context.Context, query string, limit, offset int) (AdminFeedbackList, error)
}

type Service struct {
	repository repository
	mailer     emailSender
	recipient  string
}

func NewService(repository repository, mailer emailSender, recipient string) *Service {
	return &Service{
		repository: repository,
		mailer:     mailer,
		recipient:  strings.TrimSpace(recipient),
	}
}

func (s *Service) Submit(ctx context.Context, input CreateFeedbackInput) error {
	if err := s.repository.Create(ctx, input); err != nil {
		return err
	}

	s.sendEmailNotification(ctx, input)
	return nil
}

func (s *Service) ListAdmin(ctx context.Context, query string, limit int, offset int) (AdminFeedbackList, error) {
	return s.repository.ListAdmin(ctx, query, limit, offset)
}

func (s *Service) sendEmailNotification(ctx context.Context, input CreateFeedbackInput) {
	if s.mailer == nil || s.recipient == "" {
		return
	}

	contact := input.Contact
	if strings.TrimSpace(contact) == "" {
		contact = "—"
	}

	userAgent := input.UserAgent
	if strings.TrimSpace(userAgent) == "" {
		userAgent = "—"
	}

	subject := "Новый отзыв о приложении gde-coffee"
	textBody := fmt.Sprintf(
		"Пользователь: %s\nКонтакт: %s\nUser-Agent: %s\n\nОтзыв:\n%s\n",
		input.UserID,
		contact,
		userAgent,
		input.Message,
	)
	htmlBody := fmt.Sprintf(
		"<h3>Новый отзыв о приложении gde-coffee</h3><p><b>Пользователь:</b> %s</p><p><b>Контакт:</b> %s</p><p><b>User-Agent:</b> %s</p><p><b>Отзыв:</b></p><pre style=\"white-space: pre-wrap; font-family: inherit;\">%s</pre>",
		html.EscapeString(input.UserID),
		html.EscapeString(contact),
		html.EscapeString(userAgent),
		html.EscapeString(input.Message),
	)

	if err := s.mailer.SendEmail(ctx, s.recipient, subject, textBody, htmlBody); err != nil {
		log.Printf("feedback email send failed: %v", err)
	}
}
