package reviews

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
)

func (h *Handler) GetMyReputation(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	response, err := h.service.GetUserReputationPublicProfile(ctx, userID)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}
	c.JSON(http.StatusOK, response)
}

func (h *Handler) GetMyReputationEvents(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}
	h.listReputationEvents(c, userID)
}

func (h *Handler) GetUserReputationEvents(c *gin.Context) {
	userID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(userID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id пользователя.", nil)
		return
	}
	h.listReputationEvents(c, userID)
}

func (h *Handler) listReputationEvents(c *gin.Context, userID string) {
	limit := defaultReputationEventsLimit
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "limit должен быть положительным числом.", nil)
			return
		}
		limit = parsed
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	events, err := h.service.ListUserReputationEvents(ctx, userID, limit)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user_id": userID,
		"events":  events,
	})
}
