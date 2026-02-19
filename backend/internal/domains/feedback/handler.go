package feedback

import (
	"context"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"backend/internal/auth"
	"backend/internal/shared/httpx"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func NewDefaultHandler(pool *pgxpool.Pool, mailer emailSender, recipient string) *Handler {
	repository := NewRepository(pool)
	service := NewService(repository, mailer, recipient)
	return NewHandler(service)
}

func (h *Handler) Create(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	var req createFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	message := strings.TrimSpace(req.Message)
	if message == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Текст отзыва обязателен.", nil)
		return
	}
	if utf8.RuneCountInString(message) > maxFeedbackMessageRunes {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Отзыв слишком длинный (максимум 4000 символов).", nil)
		return
	}

	contact := strings.TrimSpace(req.Contact)
	if utf8.RuneCountInString(contact) > maxFeedbackContactRunes {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Контакт слишком длинный (максимум 255 символов).", nil)
		return
	}

	userAgent := strings.TrimSpace(c.Request.UserAgent())
	if utf8.RuneCountInString(userAgent) > maxFeedbackUserAgentRunes {
		userAgent = trimRunes(userAgent, maxFeedbackUserAgentRunes)
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if err := h.service.Submit(ctx, CreateFeedbackInput{
		UserID:    userID,
		Message:   message,
		Contact:   contact,
		UserAgent: userAgent,
	}); err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось отправить отзыв.", nil)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"status": "ok"})
}

func trimRunes(value string, limit int) string {
	if limit <= 0 {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}
