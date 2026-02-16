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

func (h *Handler) ListDrinks(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	limit := defaultDrinkSearchLimit

	if rawLimit := strings.TrimSpace(c.Query("limit")); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "limit должен быть целым числом.", nil)
			return
		}
		if parsedLimit <= 0 {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "limit должен быть больше 0.", nil)
			return
		}
		if parsedLimit > maxDrinkSearchLimit {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "limit не может быть больше 30.", nil)
			return
		}
		limit = parsedLimit
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 4*time.Second)
	defer cancel()

	drinks, err := h.service.SearchDrinks(ctx, query, limit)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"q":      query,
		"limit":  limit,
		"drinks": drinks,
	})
}
