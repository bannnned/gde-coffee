package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

const userIDKey = "user_id"
const userRoleKey = "user_role"

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

		user, _, err := getUserBySession(ctx, pool, sid)
		if err != nil {
			respondError(c, http.StatusUnauthorized, "unauthorized", "invalid session", nil)
			c.Abort()
			return
		}

		c.Set(userIDKey, user.ID)
		c.Set(userRoleKey, strings.ToLower(strings.TrimSpace(user.Role)))
		c.Next()
	}
}

func RequireRole(pool *pgxpool.Pool, allowedRoles ...string) gin.HandlerFunc {
	allowedSet := make(map[string]struct{}, len(allowedRoles))
	for _, role := range allowedRoles {
		normalized := strings.ToLower(strings.TrimSpace(role))
		if normalized == "" {
			continue
		}
		allowedSet[normalized] = struct{}{}
	}

	return func(c *gin.Context) {
		sid, err := c.Cookie(cookieName)
		if err != nil || sid == "" {
			respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
			c.Abort()
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		user, _, err := getUserBySession(ctx, pool, sid)
		if err != nil {
			respondError(c, http.StatusUnauthorized, "unauthorized", "invalid session", nil)
			c.Abort()
			return
		}

		role := strings.ToLower(strings.TrimSpace(user.Role))
		if _, ok := allowedSet[role]; !ok {
			respondError(c, http.StatusForbidden, "forbidden", "insufficient role", nil)
			c.Abort()
			return
		}

		c.Set(userIDKey, user.ID)
		c.Set(userRoleKey, role)
		c.Next()
	}
}

func OptionalAuth(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		sid, err := c.Cookie(cookieName)
		if err != nil || strings.TrimSpace(sid) == "" {
			c.Next()
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		user, _, err := getUserBySession(ctx, pool, sid)
		if err != nil {
			c.Next()
			return
		}

		c.Set(userIDKey, user.ID)
		c.Set(userRoleKey, strings.ToLower(strings.TrimSpace(user.Role)))
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

func UserRoleFromContext(c *gin.Context) (string, bool) {
	value, ok := c.Get(userRoleKey)
	if !ok {
		return "", false
	}
	role, ok := value.(string)
	return role, ok
}
