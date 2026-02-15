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

func (h *Handler) VerifyVisit(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

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

	if req.DwellSeconds < 0 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "dwell_seconds должен быть >= 0.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	result, err := h.service.VerifyVisit(ctx, userID, reviewID, idempotencyKey, req)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}
	c.Header("X-Idempotent-Replay", boolToString(result.Replay))
	c.JSON(result.StatusCode, result.Body)
}
