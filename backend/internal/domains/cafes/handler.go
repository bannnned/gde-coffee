package cafes

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/config"
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

func NewDefaultHandler(pool *pgxpool.Pool, cfg config.Config) *Handler {
	repository := NewRepository(pool)
	service := NewService(repository, cfg)
	return NewHandler(service)
}

func (h *Handler) List(c *gin.Context) {
	const maxRadiusM = 50000.0

	latStr := strings.TrimSpace(c.Query("lat"))
	lngStr := strings.TrimSpace(c.Query("lng"))
	radiusStr := strings.TrimSpace(c.Query("radius_m"))
	if latStr == "" || lngStr == "" || radiusStr == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Параметры lat, lng и radius_m обязательны.", nil)
		return
	}

	lat, err := validation.ParseFloat(latStr)
	if err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректное значение lat.", nil)
		return
	}
	if !validation.IsFinite(lat) || lat < -90 || lat > 90 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "lat должен быть в диапазоне от -90 до 90.", nil)
		return
	}

	lng, err := validation.ParseFloat(lngStr)
	if err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректное значение lng.", nil)
		return
	}
	if !validation.IsFinite(lng) || lng < -180 || lng > 180 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "lng должен быть в диапазоне от -180 до 180.", nil)
		return
	}

	radiusM, err := validation.ParseFloat(radiusStr)
	if err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректное значение radius_m.", nil)
		return
	}
	if !validation.IsFinite(radiusM) || radiusM < 0 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "radius_m должен быть >= 0.", nil)
		return
	}
	if radiusM > maxRadiusM {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "radius_m должен быть <= 50000.", gin.H{"max_radius_m": maxRadiusM})
		return
	}

	sortBy := strings.TrimSpace(c.Query("sort"))
	if sortBy != "" && sortBy != config.SortByDistance {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "sort поддерживает только значение 'distance'.", nil)
		return
	}

	favoritesOnly := false
	favoritesOnlyRaw := strings.TrimSpace(strings.ToLower(c.DefaultQuery("favorites_only", "false")))
	if favoritesOnlyRaw != "" {
		switch favoritesOnlyRaw {
		case "1", "true", "yes", "on":
			favoritesOnly = true
		case "0", "false", "no", "off":
			favoritesOnly = false
		default:
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "favorites_only должен быть boolean-значением.", nil)
			return
		}
	}

	limit, err := validation.ParseLimit(c.Query("limit"), h.service.cfg.Limits)
	if err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
		return
	}

	requiredAmenities := validation.ParseAmenities(c.Query("amenities"))
	var userID *string
	if authUserID, ok := auth.UserIDFromContext(c); ok {
		trimmed := strings.TrimSpace(authUserID)
		if trimmed != "" {
			userID = &trimmed
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	items, err := h.service.List(ctx, ListParams{
		Latitude:          lat,
		Longitude:         lng,
		RadiusM:           radiusM,
		RequiredAmenities: requiredAmenities,
		UserID:            userID,
		FavoritesOnly:     favoritesOnly,
		Limit:             limit,
	})
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	c.JSON(http.StatusOK, items)
}

func (h *Handler) UpdateDescription(c *gin.Context) {
	cafeID := strings.TrimSpace(c.Param("id"))
	if cafeID == "" || !validation.IsValidUUID(cafeID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	var req updateDescriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	description := strings.TrimSpace(req.Description)
	if description == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Описание не должно быть пустым.", nil)
		return
	}
	if len([]rune(description)) > MaxDescriptionChars {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Описание слишком длинное.", gin.H{"max_chars": MaxDescriptionChars})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	saved, err := h.service.UpdateDescription(ctx, cafeID, description)
	if err != nil {
		if h.service.IsNotFound(err) {
			httpx.RespondError(c, http.StatusNotFound, "not_found", "Кофейня не найдена.", nil)
			return
		}
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{"description": saved})
}

func (h *Handler) GeocodeLookup(c *gin.Context) {
	address := strings.TrimSpace(c.Query("address"))
	city := strings.TrimSpace(c.Query("city"))
	if address == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Параметр address обязателен.", nil)
		return
	}
	if len([]rune(address)) < 3 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Введите более подробный адрес.", nil)
		return
	}

	result, err := h.service.LookupAddress(c.Request.Context(), address, city)
	if err != nil {
		httpx.RespondError(c, http.StatusBadGateway, "upstream_error", "Не удалось определить координаты по адресу.", nil)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) ImportJSON(c *gin.Context) {
	raw, err := c.GetRawData()
	if err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Не удалось прочитать тело запроса.", nil)
		return
	}

	req, err := decodeAdminCafeImportRequest(raw)
	if err != nil {
		if _, syntaxErr := err.(*json.SyntaxError); syntaxErr {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
			return
		}
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	req.Mode, err = normalizeAdminCafeImportMode(req.Mode)
	if err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
		return
	}

	if len(req.Cafes) == 0 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Список cafes не должен быть пустым.", nil)
		return
	}
	if len(req.Cafes) > AdminCafeImportMaxItems {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Слишком много элементов для импорта.", gin.H{
			"max_items": AdminCafeImportMaxItems,
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	result, err := h.service.ImportJSON(ctx, req)
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) AdminSearch(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if len([]rune(query)) < 2 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "q должен содержать минимум 2 символа.", nil)
		return
	}

	limit := 20
	if rawLimit := strings.TrimSpace(c.Query("limit")); rawLimit != "" {
		value, err := strconv.Atoi(rawLimit)
		if err != nil || value <= 0 {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "limit должен быть целым числом больше 0.", nil)
			return
		}
		if value > 50 {
			value = 50
		}
		limit = value
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	items, err := h.service.SearchAdminCafesByName(ctx, query, limit)
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось выполнить поиск кофеен.", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"q":     query,
		"limit": limit,
		"items": items,
	})
}
