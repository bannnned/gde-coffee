package reviews

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/shared/httpx"
	"backend/internal/shared/validation"

	"github.com/gin-gonic/gin"
)

func (h *Handler) DeleteReview(c *gin.Context) {
	moderatorID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(moderatorID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	reviewID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(reviewID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id отзыва.", nil)
		return
	}

	var req DeleteReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		if strings.Contains(err.Error(), "EOF") {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Нужно указать причину удаления: abuse или violation.", nil)
			return
		}
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}
	reason, ok := normalizeReviewModerationReason(req.Reason)
	if !ok {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "reason должен быть abuse или violation.", nil)
		return
	}
	req.Reason = reason
	req.Details = strings.TrimSpace(req.Details)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	response, err := h.service.RemoveReviewByModerator(ctx, moderatorID, reviewID, req)
	if err != nil {
		if errors.Is(err, ErrInvalidRemovalReason) {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "reason должен быть abuse или violation.", nil)
			return
		}
		h.respondDomainError(c, err)
		return
	}
	c.JSON(http.StatusOK, response)
}
