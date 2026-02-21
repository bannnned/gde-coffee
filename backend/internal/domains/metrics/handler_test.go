package metrics

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type handlerRepositoryStub struct {
	capturedCafeID       string
	funnelCapturedCafeID string
}

func (r *handlerRepositoryStub) InsertEvents(ctx context.Context, events []EventInput) (int, error) {
	return len(events), nil
}

func (r *handlerRepositoryStub) ListDailyNorthStarMetrics(
	ctx context.Context,
	dateFrom time.Time,
	dateTo time.Time,
	cafeID string,
) ([]DailyNorthStarMetrics, error) {
	r.capturedCafeID = cafeID
	return nil, nil
}

func (r *handlerRepositoryStub) GetFunnelJourneyCounts(
	ctx context.Context,
	dateFrom time.Time,
	dateTo time.Time,
	cafeID string,
) (FunnelJourneyCounts, error) {
	r.funnelCapturedCafeID = cafeID
	return FunnelJourneyCounts{}, nil
}

func TestGetNorthStar_InvalidCafeID_ReturnsBadRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &handlerRepositoryStub{}
	handler := NewHandler(NewService(repo))

	router := gin.New()
	router.GET("/api/admin/metrics/north-star", handler.GetNorthStar)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/metrics/north-star?days=14&cafe_id=invalid", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d, body=%s", rec.Code, rec.Body.String())
	}
	if repo.capturedCafeID != "" {
		t.Fatalf("repository should not be called on invalid cafe_id, got=%q", repo.capturedCafeID)
	}
}

func TestGetNorthStar_ValidCafeID_PropagatesFilter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &handlerRepositoryStub{}
	handler := NewHandler(NewService(repo))

	router := gin.New()
	router.GET("/api/admin/metrics/north-star", handler.GetNorthStar)

	cafeID := "550e8400-e29b-41d4-a716-446655440000"
	req := httptest.NewRequest(http.MethodGet, "/api/admin/metrics/north-star?days=14&cafe_id="+cafeID, nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d, body=%s", rec.Code, rec.Body.String())
	}
	if repo.capturedCafeID != cafeID {
		t.Fatalf("repository cafe filter mismatch: got=%q want=%q", repo.capturedCafeID, cafeID)
	}

	var report NorthStarReport
	if err := json.Unmarshal(rec.Body.Bytes(), &report); err != nil {
		t.Fatalf("response is not valid NorthStarReport JSON: %v", err)
	}
	if report.Summary.CafeID != cafeID {
		t.Fatalf("summary cafe_id mismatch: got=%q want=%q", report.Summary.CafeID, cafeID)
	}
	if report.Summary.Days != 14 {
		t.Fatalf("expected days=14, got %d", report.Summary.Days)
	}
	if len(report.Daily) != 14 {
		t.Fatalf("expected 14 daily points, got %d", len(report.Daily))
	}
}

func TestGetFunnel_ValidCafeID_PropagatesFilter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &handlerRepositoryStub{}
	handler := NewHandler(NewService(repo))

	router := gin.New()
	router.GET("/api/admin/metrics/funnel", handler.GetFunnel)

	cafeID := "550e8400-e29b-41d4-a716-446655440000"
	req := httptest.NewRequest(http.MethodGet, "/api/admin/metrics/funnel?days=14&cafe_id="+cafeID, nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d, body=%s", rec.Code, rec.Body.String())
	}
	if repo.funnelCapturedCafeID != cafeID {
		t.Fatalf("repository cafe filter mismatch: got=%q want=%q", repo.funnelCapturedCafeID, cafeID)
	}

	var report FunnelReport
	if err := json.Unmarshal(rec.Body.Bytes(), &report); err != nil {
		t.Fatalf("response is not valid FunnelReport JSON: %v", err)
	}
	if report.Summary.CafeID != cafeID {
		t.Fatalf("summary cafe_id mismatch: got=%q want=%q", report.Summary.CafeID, cafeID)
	}
	if report.Summary.Days != 14 {
		t.Fatalf("expected days=14, got %d", report.Summary.Days)
	}
	if len(report.Stages) != 5 {
		t.Fatalf("expected 5 funnel stages, got %d", len(report.Stages))
	}
}

func TestNormalizeEvent_AcceptsNewEventTypes(t *testing.T) {
	now := time.Date(2026, 2, 21, 12, 0, 0, 0, time.UTC)
	_, err := normalizeEvent(ingestEventRequest{
		EventType: "cafe_card_open",
		AnonID:    "anon_1",
		JourneyID: "journey_1",
		CafeID:    "550e8400-e29b-41d4-a716-446655440000",
	}, "", now)
	if err != nil {
		t.Fatalf("cafe_card_open should be valid, got error: %v", err)
	}

	_, err = normalizeEvent(ingestEventRequest{
		EventType: "review_submit",
		AnonID:    "anon_1",
		JourneyID: "journey_1",
		CafeID:    "550e8400-e29b-41d4-a716-446655440000",
		ReviewID:  "6f5e4d3c-2b1a-4d9f-9a7e-1234567890ab",
	}, "", now)
	if err != nil {
		t.Fatalf("review_submit should be valid, got error: %v", err)
	}
}

func TestNormalizeEvent_ReviewSubmitRequiresReviewID(t *testing.T) {
	now := time.Date(2026, 2, 21, 12, 0, 0, 0, time.UTC)
	_, err := normalizeEvent(ingestEventRequest{
		EventType: "review_submit",
		AnonID:    "anon_1",
		JourneyID: "journey_1",
		CafeID:    "550e8400-e29b-41d4-a716-446655440000",
	}, "", now)
	if err == nil {
		t.Fatalf("expected validation error for missing review_id")
	}
	if !strings.Contains(err.Error(), "review_read/review_submit") {
		t.Fatalf("unexpected error: %v", err)
	}
}
