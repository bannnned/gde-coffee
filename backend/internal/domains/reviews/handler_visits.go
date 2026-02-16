package reviews

import (
	"context"
	"net/http"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/shared/httpx"
	"backend/internal/shared/validation"

	"github.com/gin-gonic/gin"
)

func (h *Handler) StartCheckIn(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}
	userRole, _ := auth.UserRoleFromContext(c)

	cafeID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(cafeID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Заголовок Idempotency-Key обязателен.", nil)
		return
	}

	var req StartCheckInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}
	if !isValidLatitude(req.Lat) || !isValidLongitude(req.Lng) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Координаты имеют некорректный формат.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	result, err := h.service.StartCheckIn(
		ctx,
		userID,
		cafeID,
		idempotencyKey,
		req,
		RequestSignals{
			UserAgent: c.Request.UserAgent(),
			ClientIP:  c.ClientIP(),
			UserRole:  userRole,
		},
	)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}
	c.Header("X-Idempotent-Replay", boolToString(result.Replay))
	c.JSON(result.StatusCode, result.Body)
}

func (h *Handler) VerifyVisit(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}
	userRole, _ := auth.UserRoleFromContext(c)

	reviewID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(reviewID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id отзыва.", nil)
		return
	}

	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Заголовок Idempotency-Key обязателен.", nil)
		return
	}

	var req VerifyVisitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	if strings.TrimSpace(req.CheckInID) != "" && !validation.IsValidUUID(strings.TrimSpace(req.CheckInID)) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный checkin_id.", nil)
		return
	}
	if (req.Lat == nil) != (req.Lng == nil) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "lat и lng должны передаваться вместе.", nil)
		return
	}
	if req.Lat != nil && req.Lng != nil {
		if !isValidLatitude(*req.Lat) || !isValidLongitude(*req.Lng) {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Координаты имеют некорректный формат.", nil)
			return
		}
	}
	if req.DwellSeconds < 0 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "dwell_seconds должен быть >= 0.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	result, err := h.service.VerifyVisit(
		ctx,
		userID,
		reviewID,
		idempotencyKey,
		req,
		RequestSignals{
			UserAgent: c.Request.UserAgent(),
			ClientIP:  c.ClientIP(),
			UserRole:  userRole,
		},
	)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}
	c.Header("X-Idempotent-Replay", boolToString(result.Replay))
	c.JSON(result.StatusCode, result.Body)
}

func isValidLatitude(value float64) bool {
	return value >= -90 && value <= 90
}

func isValidLongitude(value float64) bool {
	return value >= -180 && value <= 180
}
