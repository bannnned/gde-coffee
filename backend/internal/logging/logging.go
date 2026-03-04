package logging

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	// RequestIDKey is the gin.Context key for the request ID.
	RequestIDKey    = "request_id"
	headerRequestID = "X-Request-Id"
)

type requestIDCtxKey struct{}

// Setup configures the global slog logger with a JSON handler.
// LOG_LEVEL env var controls the minimum level (debug/info/warn/error).
// Call this once at the start of main(), after loading env.
func Setup() {
	level := parseLogLevel(os.Getenv("LOG_LEVEL"))
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	})
	slog.SetDefault(slog.New(handler))
}

func parseLogLevel(raw string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// RequestID is a Gin middleware that generates a unique request ID per request.
// It looks for an incoming X-Request-Id header first; if absent, generates one.
// The ID is set in gin.Context, the Go context, and the response header.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(headerRequestID)
		if id == "" {
			id = generateRequestID()
		}
		c.Set(RequestIDKey, id)
		c.Header(headerRequestID, id)

		ctx := context.WithValue(c.Request.Context(), requestIDCtxKey{}, id)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

// RequestIDFromContext extracts the request ID from a Go context.
func RequestIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(requestIDCtxKey{}).(string); ok {
		return id
	}
	return ""
}

// RequestLogger is a Gin middleware that logs every HTTP request with
// structured fields: method, path, status, duration, client_ip, request_id.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		if c.Request.URL.RawQuery != "" {
			path = path + "?" + c.Request.URL.RawQuery
		}

		c.Next()

		duration := time.Since(start)
		status := c.Writer.Status()

		attrs := []slog.Attr{
			slog.String("method", c.Request.Method),
			slog.String("path", path),
			slog.Int("status", status),
			slog.Duration("duration", duration),
			slog.String("client_ip", c.ClientIP()),
		}

		if id, exists := c.Get(RequestIDKey); exists {
			attrs = append(attrs, slog.String("request_id", id.(string)))
		}

		level := slog.LevelInfo
		if status >= 500 {
			level = slog.LevelError
		} else if status >= 400 {
			level = slog.LevelWarn
		}

		slog.LogAttrs(c.Request.Context(), level, "http request", attrs...)
	}
}

// WorkerLogger returns a logger with a pre-set worker_name attribute.
func WorkerLogger(workerName string) *slog.Logger {
	return slog.Default().With("worker_name", workerName)
}

func generateRequestID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b[:4]) + "-" +
		hex.EncodeToString(b[4:6]) + "-" +
		hex.EncodeToString(b[6:8]) + "-" +
		hex.EncodeToString(b[8:10]) + "-" +
		hex.EncodeToString(b[10:])
}
