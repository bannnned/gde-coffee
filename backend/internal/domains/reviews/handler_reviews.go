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

func (h *Handler) Publish(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Заголовок Idempotency-Key обязателен.", nil)
		return
	}

	var req PublishReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	req.CafeID = strings.TrimSpace(req.CafeID)
	req.DrinkName = strings.TrimSpace(req.DrinkName)
	req.Summary = strings.TrimSpace(req.Summary)

	if !validation.IsValidUUID(req.CafeID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}
	if req.Rating < 1 || req.Rating > 5 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "rating должен быть в диапазоне от 1 до 5.", nil)
		return
	}
	if req.DrinkName == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "drink_name обязателен.", nil)
		return
	}
	if len([]rune(req.Summary)) < 20 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "summary должен быть не короче 20 символов.", nil)
		return
	}
	if req.PhotoCount < 0 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "photo_count должен быть >= 0.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	result, err := h.service.PublishReview(ctx, userID, idempotencyKey, req)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}
	c.Header("X-Idempotent-Replay", boolToString(result.Replay))
	c.JSON(result.StatusCode, result.Body)
}
