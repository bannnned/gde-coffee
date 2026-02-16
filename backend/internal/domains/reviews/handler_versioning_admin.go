package reviews

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func (h *Handler) GetVersioningStatus(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	status := h.service.GetVersioningStatus(ctx)
	c.JSON(http.StatusOK, status)
}
