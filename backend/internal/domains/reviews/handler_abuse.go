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

func (h *Handler) ReportAbuse(c *gin.Context) {
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

	var req ReportAbuseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	response, err := h.service.ReportAbuse(ctx, userID, reviewID, req)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}
	c.JSON(http.StatusOK, response)
}

func (h *Handler) ConfirmAbuse(c *gin.Context) {
	moderatorID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(moderatorID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	reportID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(reportID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id жалобы.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	response, err := h.service.ConfirmAbuseReport(ctx, moderatorID, reportID)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}
	c.JSON(http.StatusOK, response)
}
