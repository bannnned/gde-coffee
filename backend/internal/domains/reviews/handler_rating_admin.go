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

func (h *Handler) TriggerCafeAISummary(c *gin.Context) {
	cafeID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(cafeID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	snapshot, err := h.service.ForceRecalculateCafeRatingSnapshot(ctx, cafeID)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}

	components, _ := snapshot["components"].(map[string]interface{})
	c.JSON(http.StatusOK, gin.H{
		"cafe_id":                 cafeID,
		"trigger":                 "admin_manual",
		"descriptive_tags_source": components["descriptive_tags_source"],
		"ai_summary":              components["ai_summary"],
		"computed_at":             snapshot["computed_at"],
	})
}
