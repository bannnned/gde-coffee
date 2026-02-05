package auth

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

const userIDKey = "user_id"

func RequireAuth(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		sid, err := c.Cookie(cookieName)
		if err != nil || sid == "" {
			respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
			c.Abort()
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		user, err := getUserBySession(ctx, pool, sid)
		if err != nil {
			respondError(c, http.StatusUnauthorized, "unauthorized", "invalid session", nil)
			c.Abort()
			return
		}

		c.Set(userIDKey, user.ID)
		c.Next()
	}
}

func UserIDFromContext(c *gin.Context) (string, bool) {
	value, ok := c.Get(userIDKey)
	if !ok {
		return "", false
	}
	id, ok := value.(string)
	return id, ok
}
