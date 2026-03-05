package taste

import (
	"context"
	"errors"
	"io"
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
	GetTasteMap(ctx context.Context, userID string) (TasteMapResponse, error)
	AcceptTasteHypothesis(ctx context.Context, userID string, hypothesisID string, req HypothesisFeedbackRequest) (HypothesisFeedbackResponse, error)
	DismissTasteHypothesis(ctx context.Context, userID string, hypothesisID string, req HypothesisFeedbackRequest) (HypothesisFeedbackResponse, error)
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

func (h *Handler) GetMyTasteMap(c *gin.Context) {
	if !h.tasteMapEnabled {
		httpx.RespondError(c, http.StatusNotFound, "feature_disabled", "Taste Map временно недоступен.", nil)
		return
	}

	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Нужна авторизация.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	result, err := h.service.GetTasteMap(ctx, strings.TrimSpace(userID))
	if err != nil {
		var validationErr *validationError
		if errors.As(err, &validationErr) {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", validationErr.Error(), nil)
			return
		}
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить профиль вкуса.", nil)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) AcceptHypothesis(c *gin.Context) {
	h.handleHypothesisFeedback(c, true)
}

func (h *Handler) DismissHypothesis(c *gin.Context) {
	h.handleHypothesisFeedback(c, false)
}

func (h *Handler) handleHypothesisFeedback(c *gin.Context, accept bool) {
	if !h.tasteMapEnabled {
		httpx.RespondError(c, http.StatusNotFound, "feature_disabled", "Taste Map временно недоступен.", nil)
		return
	}

	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Нужна авторизация.", nil)
		return
	}

	hypothesisID := strings.TrimSpace(c.Param("id"))
	if hypothesisID == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "id гипотезы обязателен.", nil)
		return
	}

	var req HypothesisFeedbackRequest
	if err := bindOptionalJSON(c, &req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	var (
		result HypothesisFeedbackResponse
		err    error
	)
	if accept {
		result, err = h.service.AcceptTasteHypothesis(ctx, strings.TrimSpace(userID), hypothesisID, req)
	} else {
		result, err = h.service.DismissTasteHypothesis(ctx, strings.TrimSpace(userID), hypothesisID, req)
	}

	if err != nil {
		var validationErr *validationError
		switch {
		case errors.As(err, &validationErr):
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", validationErr.Error(), nil)
		case errors.Is(err, ErrTasteHypothesisNotFound):
			httpx.RespondError(c, http.StatusNotFound, "not_found", "Гипотеза не найдена.", nil)
		default:
			httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось сохранить обратную связь по гипотезе.", nil)
		}
		return
	}

	c.JSON(http.StatusOK, result)
}

func bindOptionalJSON(c *gin.Context, out any) error {
	if c.Request.Body == nil || c.Request.ContentLength == 0 {
		return nil
	}
	if err := c.ShouldBindJSON(out); err != nil {
		if errors.Is(err, io.EOF) {
			return nil
		}
		return err
	}
	return nil
}
