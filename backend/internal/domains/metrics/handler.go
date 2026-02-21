package metrics

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/shared/httpx"
	"backend/internal/shared/validation"

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

func (h *Handler) IngestEvents(c *gin.Context) {
	var req ingestEventsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	if len(req.Events) == 0 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Список events не может быть пустым.", nil)
		return
	}
	if len(req.Events) > MaxEventsPerIngest {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Слишком много событий за один запрос (максимум 50).", nil)
		return
	}

	userID, _ := auth.UserIDFromContext(c)
	userID = strings.TrimSpace(userID)
	if userID != "" && !validation.IsValidUUID(userID) {
		userID = ""
	}

	now := time.Now().UTC()
	normalized := make([]EventInput, 0, len(req.Events))
	for _, raw := range req.Events {
		event, err := normalizeEvent(raw, userID, now)
		if err != nil {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
			return
		}
		normalized = append(normalized, event)
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	ingested, err := h.service.IngestEvents(ctx, normalized)
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось сохранить метрики.", nil)
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"status":   "ok",
		"received": len(normalized),
		"ingested": ingested,
		"dropped":  len(normalized) - ingested,
	})
}

func (h *Handler) GetNorthStar(c *gin.Context) {
	days := DefaultRangeDays
	if rawDays := strings.TrimSpace(c.Query("days")); rawDays != "" {
		value, err := strconv.Atoi(rawDays)
		if err != nil || value <= 0 {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "days должен быть целым числом больше 0.", nil)
			return
		}
		if value > MaxRangeDays {
			value = MaxRangeDays
		}
		days = value
	}
	cafeID := strings.TrimSpace(c.Query("cafe_id"))
	if cafeID != "" && !validation.IsValidUUID(cafeID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "cafe_id должен быть UUID.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	report, err := h.service.GetNorthStarReport(ctx, days, cafeID, time.Now())
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить метрики North Star.", nil)
		return
	}

	c.JSON(http.StatusOK, report)
}

func normalizeEvent(raw ingestEventRequest, userID string, now time.Time) (EventInput, error) {
	eventType := strings.ToLower(strings.TrimSpace(raw.EventType))
	switch eventType {
	case EventReviewRead, EventRouteClick, EventCheckIn:
	default:
		return EventInput{}, validationError("event_type должен быть review_read, route_click или checkin_start.")
	}

	journeyID := strings.TrimSpace(raw.JourneyID)
	if journeyID == "" {
		return EventInput{}, validationError("journey_id обязателен.")
	}
	if len(journeyID) > 96 {
		return EventInput{}, validationError("journey_id слишком длинный (максимум 96 символов).")
	}

	anonID := strings.TrimSpace(raw.AnonID)
	if userID == "" && anonID == "" {
		return EventInput{}, validationError("anon_id обязателен для неавторизованных пользователей.")
	}
	if len(anonID) > 128 {
		return EventInput{}, validationError("anon_id слишком длинный (максимум 128 символов).")
	}

	clientEventID := strings.TrimSpace(raw.ClientEventID)
	if len(clientEventID) > 128 {
		return EventInput{}, validationError("client_event_id слишком длинный (максимум 128 символов).")
	}

	cafeID := strings.TrimSpace(raw.CafeID)
	if cafeID == "" || !validation.IsValidUUID(cafeID) {
		return EventInput{}, validationError("cafe_id обязателен и должен быть UUID.")
	}

	reviewID := strings.TrimSpace(raw.ReviewID)
	if eventType == EventReviewRead {
		if reviewID == "" || !validation.IsValidUUID(reviewID) {
			return EventInput{}, validationError("review_id обязателен для review_read и должен быть UUID.")
		}
	} else {
		reviewID = ""
	}

	provider := strings.ToLower(strings.TrimSpace(raw.Provider))
	if eventType == EventRouteClick {
		if provider != Provider2GIS && provider != ProviderYandex {
			return EventInput{}, validationError("provider для route_click должен быть 2gis или yandex.")
		}
	} else {
		provider = ""
	}

	occurredAt := now
	if strings.TrimSpace(raw.OccurredAt) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(raw.OccurredAt))
		if err != nil {
			return EventInput{}, validationError("occurred_at должен быть в формате RFC3339.")
		}
		occurredAt = parsed.UTC()
	}

	if occurredAt.Before(now.Add(-30 * 24 * time.Hour)) {
		return EventInput{}, validationError("occurred_at слишком старый (старше 30 дней).")
	}
	if occurredAt.After(now.Add(10 * time.Minute)) {
		return EventInput{}, validationError("occurred_at слишком далеко в будущем.")
	}

	meta := raw.Meta
	if meta == nil {
		meta = map[string]interface{}{}
	}

	return EventInput{
		ClientEventID: clientEventID,
		EventType:     eventType,
		UserID:        userID,
		AnonID:        anonID,
		JourneyID:     journeyID,
		CafeID:        cafeID,
		ReviewID:      reviewID,
		Provider:      provider,
		OccurredAt:    occurredAt,
		Metadata:      meta,
	}, nil
}

func validationError(message string) error {
	return &eventValidationError{message: message}
}

type eventValidationError struct {
	message string
}

func (e *eventValidationError) Error() string {
	return e.message
}
