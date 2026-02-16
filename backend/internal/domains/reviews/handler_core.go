package reviews

import (
	"errors"
	"net/http"

	"backend/internal/config"
	"backend/internal/media"
	"backend/internal/shared/httpx"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	service *Service
	s3      *media.Service
	cfg     config.MediaConfig
}

func NewHandler(service *Service, s3 *media.Service, cfg config.MediaConfig) *Handler {
	if service != nil {
		service.SetMedia(s3, cfg)
	}
	return &Handler{
		service: service,
		s3:      s3,
		cfg:     cfg,
	}
}

func NewDefaultHandler(pool *pgxpool.Pool, s3 *media.Service, cfg config.MediaConfig) *Handler {
	repository := NewRepository(pool)
	service := NewService(repository)
	service.SetMedia(s3, cfg)
	return NewHandler(service, s3, cfg)
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
	case errors.Is(err, ErrInvalidDrink):
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный напиток.", nil)
	case errors.Is(err, ErrCheckInTooFar):
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Вы слишком далеко от кофейни для check-in.", nil)
	case errors.Is(err, ErrCheckInTooEarly):
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Для подтверждения визита нужно подождать минимум 5 минут.", nil)
	case errors.Is(err, ErrCheckInCooldown):
		httpx.RespondError(c, http.StatusTooManyRequests, "rate_limited", "Перед check-in в другой кофейне подождите 5 минут.", nil)
	case errors.Is(err, ErrCheckInSuspicious):
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Подозрительная активность check-in. Попробуйте позже.", nil)
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
