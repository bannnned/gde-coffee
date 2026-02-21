package tags

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/shared/httpx"
	"backend/internal/shared/validation"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func NewDefaultHandler(pool *pgxpool.Pool) *Handler {
	repository := NewRepository(pool)
	service := NewService(repository)
	return NewHandler(service)
}

func (h *Handler) GetDiscoveryDescriptive(c *gin.Context) {
	scope, ok := readGeoScope(c)
	if !ok {
		return
	}
	limit := readLimit(c, "limit", DefaultLimit, MaxLimit)

	var userID *string
	if rawUserID, hasUser := auth.UserIDFromContext(c); hasUser {
		trimmed := strings.TrimSpace(rawUserID)
		if trimmed != "" {
			userID = &trimmed
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	result, err := h.service.GetDiscoveryDescriptiveTags(ctx, scope, userID, limit)
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить теги для главной.", nil)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetDescriptiveOptions(c *gin.Context) {
	scope, ok := readGeoScope(c)
	if !ok {
		return
	}
	limit := readLimit(c, "limit", DefaultOptionsLimit, MaxOptionsLimit)
	search := strings.TrimSpace(c.Query("q"))

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	result, err := h.service.ListDescriptiveTagOptions(ctx, scope, search, limit)
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить варианты тегов.", nil)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetMyDescriptivePreferences(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Нужна авторизация.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	result, err := h.service.GetUserDescriptivePreferences(ctx, strings.TrimSpace(userID))
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить любимые теги.", nil)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) PutMyDescriptivePreferences(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Нужна авторизация.", nil)
		return
	}

	scope, ok := readGeoScope(c)
	if !ok {
		return
	}

	var req upsertPreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}
	if len(req.Tags) > MaxPreferenceTags {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Слишком много тегов в настройках.", gin.H{
			"max_tags": MaxPreferenceTags,
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	result, err := h.service.ReplaceUserDescriptivePreferences(
		ctx,
		strings.TrimSpace(userID),
		scope,
		req.Tags,
	)
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось сохранить любимые теги.", nil)
		return
	}
	c.JSON(http.StatusOK, result)
}

func readGeoScope(c *gin.Context) (GeoScope, bool) {
	latStr := strings.TrimSpace(c.Query("lat"))
	lngStr := strings.TrimSpace(c.Query("lng"))
	radiusStr := strings.TrimSpace(c.Query("radius_m"))
	if latStr == "" || lngStr == "" || radiusStr == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Параметры lat, lng и radius_m обязательны.", nil)
		return GeoScope{}, false
	}

	lat, err := validation.ParseFloat(latStr)
	if err != nil || !validation.IsFinite(lat) || lat < -90 || lat > 90 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "lat должен быть в диапазоне от -90 до 90.", nil)
		return GeoScope{}, false
	}

	lng, err := validation.ParseFloat(lngStr)
	if err != nil || !validation.IsFinite(lng) || lng < -180 || lng > 180 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "lng должен быть в диапазоне от -180 до 180.", nil)
		return GeoScope{}, false
	}

	radiusM, err := validation.ParseFloat(radiusStr)
	if err != nil || !validation.IsFinite(radiusM) || radiusM < 0 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "radius_m должен быть >= 0.", nil)
		return GeoScope{}, false
	}
	if radiusM > 120000 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "radius_m должен быть <= 120000.", gin.H{
			"max_radius_m": 120000,
		})
		return GeoScope{}, false
	}

	return GeoScope{
		Latitude:  lat,
		Longitude: lng,
		RadiusM:   radiusM,
	}, true
}

func readLimit(c *gin.Context, key string, fallback int, max int) int {
	value := fallback
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return value
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed <= 0 {
		return value
	}
	if parsed > max {
		parsed = max
	}
	return parsed
}
