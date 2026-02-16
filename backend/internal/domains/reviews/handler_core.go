package reviews

import (
	"errors"
	"net/http"

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

func NewDefaultHandler(pool *pgxpool.Pool) *Handler {
	repository := NewRepository(pool)
	service := NewService(repository)
	return NewHandler(service)
}

func (h *Handler) Service() *Service {
	return h.service
}

func (h *Handler) respondDomainError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.RespondError(c, http.StatusNotFound, "not_found", "Сущность не найдена.", nil)
	case errors.Is(err, ErrForbidden):
		httpx.RespondError(c, http.StatusForbidden, "forbidden", "Недостаточно прав для действия.", nil)
	case errors.Is(err, ErrConflict):
		httpx.RespondError(c, http.StatusConflict, "conflict", "Конфликт данных.", nil)
	case errors.Is(err, ErrAlreadyExists):
		httpx.RespondError(c, http.StatusConflict, "already_exists", "На эту кофейню у вас уже есть активный отзыв. Используйте редактирование.", nil)
	case errors.Is(err, ErrDuplicateContent):
		httpx.RespondError(c, http.StatusConflict, "duplicate_content", "Похоже на дубликат вашего недавнего отзыва.", nil)
	case errors.Is(err, ErrRateLimited):
		httpx.RespondError(c, http.StatusTooManyRequests, "rate_limited", "Слишком много попыток. Попробуйте чуть позже.", nil)
	case errors.Is(err, ErrSpamDetected):
		httpx.RespondError(c, http.StatusBadRequest, "spam_detected", "Текст выглядит как спам. Перепишите отзыв более содержательно.", nil)
	case errors.Is(err, ErrIdempotencyConflict):
		httpx.RespondError(c, http.StatusConflict, "idempotency_conflict", "Idempotency-Key уже использован с другим payload.", nil)
	case errors.Is(err, ErrIdempotencyInProgress):
		httpx.RespondError(c, http.StatusConflict, "idempotency_in_progress", "Запрос с этим Idempotency-Key ещё выполняется, повторите позже.", nil)
	default:
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
	}
}

func boolToString(value bool) string {
	if value {
		return "true"
	}
	return "false"
}
