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

func (h *Handler) ListAdminDrinks(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	limit := defaultAdminDrinksLimit
	if rawLimit := strings.TrimSpace(c.Query("limit")); rawLimit != "" {
		value, err := strconv.Atoi(rawLimit)
		if err != nil || value <= 0 {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "limit должен быть целым числом > 0.", nil)
			return
		}
		if value > maxAdminDrinksLimit {
			value = maxAdminDrinksLimit
		}
		limit = value
	}

	includeInactive := false
	if raw := strings.TrimSpace(c.Query("include_inactive")); raw != "" {
		value, err := strconv.ParseBool(raw)
		if err != nil {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "include_inactive должен быть true/false.", nil)
			return
		}
		includeInactive = value
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	items, err := h.service.ListAdminDrinks(ctx, query, includeInactive, limit)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"q":                query,
		"limit":            limit,
		"include_inactive": includeInactive,
		"drinks":           items,
	})
}

func (h *Handler) CreateDrink(c *gin.Context) {
	var req AdminCreateDrinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	item, err := h.service.CreateDrink(ctx, req)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"drink": item})
}

func (h *Handler) UpdateDrink(c *gin.Context) {
	drinkID := strings.TrimSpace(c.Param("id"))
	if drinkID == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "id напитка обязателен.", nil)
		return
	}

	var req AdminUpdateDrinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	item, err := h.service.UpdateDrink(ctx, drinkID, req)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"drink": item})
}

func (h *Handler) ListUnknownDrinks(c *gin.Context) {
	status := strings.TrimSpace(strings.ToLower(c.Query("status")))
	if status != "" && status != "new" && status != "mapped" && status != "ignored" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "status должен быть new, mapped или ignored.", nil)
		return
	}
	limit := defaultUnknownDrinksLimit
	offset := 0

	if rawLimit := strings.TrimSpace(c.Query("limit")); rawLimit != "" {
		value, err := strconv.Atoi(rawLimit)
		if err != nil || value <= 0 {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "limit должен быть целым числом > 0.", nil)
			return
		}
		if value > maxUnknownDrinksLimit {
			value = maxUnknownDrinksLimit
		}
		limit = value
	}

	if rawOffset := strings.TrimSpace(c.Query("offset")); rawOffset != "" {
		value, err := strconv.Atoi(rawOffset)
		if err != nil || value < 0 {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "offset должен быть целым числом >= 0.", nil)
			return
		}
		offset = value
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	items, err := h.service.ListUnknownDrinkFormats(ctx, status, limit, offset)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  status,
		"limit":   limit,
		"offset":  offset,
		"unknown": items,
	})
}

func (h *Handler) MapUnknownDrink(c *gin.Context) {
	unknownID, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || unknownID <= 0 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id неизвестного напитка.", nil)
		return
	}

	var req AdminMapUnknownDrinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}
	if strings.TrimSpace(req.DrinkID) == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "drink_id обязателен.", nil)
		return
	}

	addAlias := true
	if req.AddAlias != nil {
		addAlias = *req.AddAlias
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	item, err := h.service.MapUnknownDrinkFormat(ctx, unknownID, req.DrinkID, addAlias)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"unknown": item})
}

func (h *Handler) IgnoreUnknownDrink(c *gin.Context) {
	unknownID, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || unknownID <= 0 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id неизвестного напитка.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	item, err := h.service.IgnoreUnknownDrinkFormat(ctx, unknownID)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"unknown": item})
}
