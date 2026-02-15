package favorites

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/config"
	"backend/internal/shared/httpx"
	"backend/internal/shared/validation"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func NewDefaultHandler(pool *pgxpool.Pool, mediaCfg config.MediaConfig) *Handler {
	repository := NewRepository(pool)
	service := NewService(repository, mediaCfg)
	return NewHandler(service)
}

func (h *Handler) Add(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	cafeID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(cafeID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if err := h.service.EnsureCafeExists(ctx, cafeID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.RespondError(c, http.StatusNotFound, "not_found", "Кофейня не найдена.", nil)
			return
		}
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	if err := h.service.Add(ctx, userID, cafeID); err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось добавить в избранное.", nil)
		return
	}

	c.JSON(http.StatusOK, StatusResponse{CafeID: cafeID, IsFavorite: true})
}

func (h *Handler) Remove(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	cafeID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(cafeID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if err := h.service.Remove(ctx, userID, cafeID); err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось удалить из избранного.", nil)
		return
	}

	c.JSON(http.StatusOK, StatusResponse{CafeID: cafeID, IsFavorite: false})
}

func (h *Handler) List(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	items, err := h.service.List(ctx, userID)
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить избранное.", nil)
		return
	}

	c.JSON(http.StatusOK, items)
}
