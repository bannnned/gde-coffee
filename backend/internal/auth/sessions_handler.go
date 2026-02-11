package auth

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func (h Handler) RevokeAllSessions(c *gin.Context) {
	userID, ok := UserIDFromContext(c)
	if !ok || userID == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if _, err := h.Pool.Exec(ctx, `update users set session_version = session_version + 1 where id = $1`, userID); err != nil {
		log.Printf("revoke all sessions failed: %v", err)
		respondError(c, http.StatusInternalServerError, "internal", "db update failed", nil)
		return
	}

	clearSessionCookie(c, h.CookieSecure)
	c.Status(http.StatusOK)
}
