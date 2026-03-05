package taste

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type handlerServiceStub struct {
	getOnboardingFn      func(ctx context.Context) OnboardingResponse
	completeOnboardingFn func(ctx context.Context, userID string, req CompleteOnboardingRequest) (CompleteOnboardingResponse, error)
}

func (s *handlerServiceStub) GetOnboarding(ctx context.Context) OnboardingResponse {
	if s.getOnboardingFn != nil {
		return s.getOnboardingFn(ctx)
	}
	return OnboardingResponse{}
}

func (s *handlerServiceStub) CompleteOnboarding(ctx context.Context, userID string, req CompleteOnboardingRequest) (CompleteOnboardingResponse, error) {
	if s.completeOnboardingFn != nil {
		return s.completeOnboardingFn(ctx, userID, req)
	}
	return CompleteOnboardingResponse{}, nil
}

func TestGetOnboarding_FlagOff(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(&handlerServiceStub{}, false)

	router := gin.New()
	router.GET("/api/v1/taste/onboarding", handler.GetOnboarding)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/taste/onboarding", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestGetOnboarding_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(&handlerServiceStub{
		getOnboardingFn: func(_ context.Context) OnboardingResponse {
			return OnboardingResponse{
				ContractVersion:      TasteContractVersion,
				OnboardingVersion:    TasteOnboardingVersion,
				Locale:               "ru-RU",
				EstimatedDurationSec: 55,
			}
		},
	}, true)

	router := gin.New()
	router.GET("/api/v1/taste/onboarding", handler.GetOnboarding)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/taste/onboarding", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var payload OnboardingResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.OnboardingVersion != TasteOnboardingVersion {
		t.Fatalf("expected onboarding version %q, got %q", TasteOnboardingVersion, payload.OnboardingVersion)
	}
}

func TestCompleteOnboarding_InvalidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(&handlerServiceStub{}, true)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "550e8400-e29b-41d4-a716-446655440000")
		c.Next()
	})
	router.POST("/api/v1/taste/onboarding/complete", handler.CompleteOnboarding)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/taste/onboarding/complete", bytes.NewBufferString("{broken"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestCompleteOnboarding_ValidationError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(&handlerServiceStub{
		completeOnboardingFn: func(_ context.Context, _ string, _ CompleteOnboardingRequest) (CompleteOnboardingResponse, error) {
			return CompleteOnboardingResponse{}, errValidation("onboarding_version не поддерживается.")
		},
	}, true)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "550e8400-e29b-41d4-a716-446655440000")
		c.Next()
	})
	router.POST("/api/v1/taste/onboarding/complete", handler.CompleteOnboarding)

	body := `{"onboarding_version":"unknown","answers":[{"question_id":"drink_format","value":"espresso"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/taste/onboarding/complete", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestCompleteOnboarding_InternalError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(&handlerServiceStub{
		completeOnboardingFn: func(_ context.Context, _ string, _ CompleteOnboardingRequest) (CompleteOnboardingResponse, error) {
			return CompleteOnboardingResponse{}, errors.New("db down")
		},
	}, true)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "550e8400-e29b-41d4-a716-446655440000")
		c.Next()
	})
	router.POST("/api/v1/taste/onboarding/complete", handler.CompleteOnboarding)

	body := `{"onboarding_version":"onboarding_v1","answers":[{"question_id":"drink_format","value":"espresso"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/taste/onboarding/complete", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestCompleteOnboarding_FlagOff(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(&handlerServiceStub{}, false)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "550e8400-e29b-41d4-a716-446655440000")
		c.Next()
	})
	router.POST("/api/v1/taste/onboarding/complete", handler.CompleteOnboarding)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/taste/onboarding/complete", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestCompleteOnboarding_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(&handlerServiceStub{
		completeOnboardingFn: func(_ context.Context, userID string, req CompleteOnboardingRequest) (CompleteOnboardingResponse, error) {
			if userID == "" {
				t.Fatalf("expected non-empty user id")
			}
			if len(req.Answers) != 1 {
				t.Fatalf("expected one answer")
			}
			return CompleteOnboardingResponse{
				ContractVersion:  TasteContractVersion,
				InferenceVersion: DefaultInferenceVersion,
				SessionID:        "session-1",
				Profile: BaselineProfile{
					Tags: []BaselineTag{{
						TasteCode:  "espresso",
						Polarity:   PolarityPositive,
						Score:      1,
						Confidence: 0.4,
						Source:     TagSourceOnboarding,
					}},
					UpdatedAt: time.Now().UTC(),
				},
			}, nil
		},
	}, true)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "550e8400-e29b-41d4-a716-446655440000")
		c.Next()
	})
	router.POST("/api/v1/taste/onboarding/complete", handler.CompleteOnboarding)

	body := `{"onboarding_version":"onboarding_v1","answers":[{"question_id":"drink_format","value":"espresso"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/taste/onboarding/complete", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var payload CompleteOnboardingResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.SessionID == "" {
		t.Fatalf("expected non-empty session_id")
	}
}
