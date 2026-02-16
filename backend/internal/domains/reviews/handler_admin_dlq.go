package reviews

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/internal/shared/httpx"

	"github.com/gin-gonic/gin"
)

func (h *Handler) ListDLQ(c *gin.Context) {
	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	if status != "" && status != "open" && status != "resolved" && status != "all" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "status должен быть open, resolved или all.", nil)
		return
	}
	status = normalizeDLQStatusFilter(status)

	limit := defaultAdminDLQLimit
	if rawLimit := strings.TrimSpace(c.Query("limit")); rawLimit != "" {
		value, err := strconv.Atoi(rawLimit)
		if err != nil || value <= 0 {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "limit должен быть целым числом > 0.", nil)
			return
		}
		if value > maxAdminDLQLimit {
			value = maxAdminDLQLimit
		}
		limit = value
	}

	offset := 0
	if rawOffset := strings.TrimSpace(c.Query("offset")); rawOffset != "" {
		value, err := strconv.Atoi(rawOffset)
		if err != nil || value < 0 {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "offset должен быть целым числом >= 0.", nil)
			return
		}
		offset = value
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	events, err := h.service.ListDomainEventDLQ(ctx, status, limit, offset)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": status,
		"limit":  limit,
		"offset": offset,
		"events": events,
	})
}

func (h *Handler) ReplayDLQEvent(c *gin.Context) {
	dlqEventID, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || dlqEventID <= 0 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id DLQ-сообщения.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	result, err := h.service.ReplayDomainEventDLQ(ctx, dlqEventID)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}
