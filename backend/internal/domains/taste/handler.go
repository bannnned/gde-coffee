package taste

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/shared/httpx"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type service interface {
	GetOnboarding(ctx context.Context) OnboardingResponse
	CompleteOnboarding(ctx context.Context, userID string, req CompleteOnboardingRequest) (CompleteOnboardingResponse, error)
}

type Handler struct {
	service         service
	tasteMapEnabled bool
}

func NewHandler(service service, tasteMapEnabled bool) *Handler {
	return &Handler{service: service, tasteMapEnabled: tasteMapEnabled}
}

func NewDefaultHandler(pool *pgxpool.Pool, tasteMapEnabled bool) (*Handler, error) {
	repository := NewRepository(pool)
	svc, err := NewService(repository)
	if err != nil {
		return nil, err
	}
	return NewHandler(svc, tasteMapEnabled), nil
}

func (h *Handler) GetOnboarding(c *gin.Context) {
	if !h.tasteMapEnabled {
		httpx.RespondError(c, http.StatusNotFound, "feature_disabled", "Taste Map временно недоступен.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	result := h.service.GetOnboarding(ctx)
	c.JSON(http.StatusOK, result)
}

func (h *Handler) CompleteOnboarding(c *gin.Context) {
	if !h.tasteMapEnabled {
		httpx.RespondError(c, http.StatusNotFound, "feature_disabled", "Taste Map временно недоступен.", nil)
		return
	}

	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Нужна авторизация.", nil)
		return
	}

	var req CompleteOnboardingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	result, err := h.service.CompleteOnboarding(ctx, strings.TrimSpace(userID), req)
	if err != nil {
		var validationErr *validationError
		if errors.As(err, &validationErr) {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", validationErr.Error(), nil)
			return
		}
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось завершить onboarding Taste Map.", nil)
		return
	}

	c.JSON(http.StatusOK, result)
}
