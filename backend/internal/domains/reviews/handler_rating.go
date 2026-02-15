package reviews

import (
	"context"
	"net/http"
	"strings"
	"time"

	"backend/internal/shared/httpx"
	"backend/internal/shared/validation"

	"github.com/gin-gonic/gin"
)

func (h *Handler) GetCafeRating(c *gin.Context) {
	cafeID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(cafeID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	snapshot, err := h.service.GetCafeRatingSnapshot(ctx, cafeID)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}
	c.JSON(http.StatusOK, snapshot)
}
