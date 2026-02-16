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

func (h *Handler) GetCafeRatingDiagnostics(c *gin.Context) {
	cafeID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(cafeID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	diagnostics, err := h.service.GetCafeRatingDiagnostics(ctx, cafeID)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}
	c.JSON(http.StatusOK, diagnostics)
}
