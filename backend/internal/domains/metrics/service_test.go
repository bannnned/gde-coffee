package metrics

import (
	"context"
	"testing"
	"time"
)

type serviceRepositoryStub struct {
	capturedDateFrom time.Time
	capturedDateTo   time.Time
	capturedCafeID   string
	rows             []DailyNorthStarMetrics
	funnelCounts     FunnelJourneyCounts
}

func (r *serviceRepositoryStub) InsertEvents(ctx context.Context, events []EventInput) (int, error) {
	return len(events), nil
}

func (r *serviceRepositoryStub) ListDailyNorthStarMetrics(
	ctx context.Context,
	dateFrom time.Time,
	dateTo time.Time,
	cafeID string,
) ([]DailyNorthStarMetrics, error) {
	r.capturedDateFrom = dateFrom
	r.capturedDateTo = dateTo
	r.capturedCafeID = cafeID
	return r.rows, nil
}

func (r *serviceRepositoryStub) GetFunnelJourneyCounts(
	ctx context.Context,
	dateFrom time.Time,
	dateTo time.Time,
	cafeID string,
) (FunnelJourneyCounts, error) {
	r.capturedDateFrom = dateFrom
	r.capturedDateTo = dateTo
	r.capturedCafeID = cafeID
	return r.funnelCounts, nil
}

func TestGetNorthStarReport_PropagatesCafeFilterAndBuildsDaily(t *testing.T) {
	repo := &serviceRepositoryStub{
		rows: []DailyNorthStarMetrics{
			{
				Day:                 time.Date(2026, 2, 20, 0, 0, 0, 0, time.UTC),
				VisitIntentJourneys: 4,
				NorthStarJourneys:   2,
			},
		},
	}
	service := NewService(repo)
	now := time.Date(2026, 2, 21, 15, 30, 0, 0, time.UTC)
	cafeID := "550e8400-e29b-41d4-a716-446655440000"

	report, err := service.GetNorthStarReport(context.Background(), 2, cafeID, now)
	if err != nil {
		t.Fatalf("GetNorthStarReport returned error: %v", err)
	}

	if repo.capturedCafeID != cafeID {
		t.Fatalf("expected cafe filter %q, got %q", cafeID, repo.capturedCafeID)
	}

	wantFrom := time.Date(2026, 2, 20, 0, 0, 0, 0, time.UTC)
	wantTo := time.Date(2026, 2, 22, 0, 0, 0, 0, time.UTC)
	if !repo.capturedDateFrom.Equal(wantFrom) {
		t.Fatalf("unexpected dateFrom: got=%s want=%s", repo.capturedDateFrom, wantFrom)
	}
	if !repo.capturedDateTo.Equal(wantTo) {
		t.Fatalf("unexpected dateTo: got=%s want=%s", repo.capturedDateTo, wantTo)
	}

	if report.Summary.CafeID != cafeID {
		t.Fatalf("summary cafe_id mismatch: got=%q want=%q", report.Summary.CafeID, cafeID)
	}
	if report.Summary.VisitIntentJourneys != 4 || report.Summary.NorthStarJourneys != 2 {
		t.Fatalf("unexpected summary totals: %+v", report.Summary)
	}
	if len(report.Daily) != 2 {
		t.Fatalf("expected 2 daily points, got %d", len(report.Daily))
	}
	if report.Daily[0].Date != "2026-02-20" || report.Daily[0].VisitIntentJourneys != 4 || report.Daily[0].NorthStarJourneys != 2 {
		t.Fatalf("unexpected first daily point: %+v", report.Daily[0])
	}
	if report.Daily[1].Date != "2026-02-21" || report.Daily[1].VisitIntentJourneys != 0 || report.Daily[1].NorthStarJourneys != 0 {
		t.Fatalf("unexpected second daily point: %+v", report.Daily[1])
	}
}

func TestGetFunnelReport_BuildsStagesAndConversions(t *testing.T) {
	repo := &serviceRepositoryStub{
		funnelCounts: FunnelJourneyCounts{
			CardOpenJourneys:     100,
			ReviewReadJourneys:   60,
			RouteClickJourneys:   30,
			CheckInJourneys:      18,
			ReviewSubmitJourneys: 9,
		},
	}
	service := NewService(repo)
	now := time.Date(2026, 2, 21, 15, 30, 0, 0, time.UTC)
	cafeID := "550e8400-e29b-41d4-a716-446655440000"

	report, err := service.GetFunnelReport(context.Background(), 14, cafeID, now)
	if err != nil {
		t.Fatalf("GetFunnelReport returned error: %v", err)
	}

	if repo.capturedCafeID != cafeID {
		t.Fatalf("expected cafe filter %q, got %q", cafeID, repo.capturedCafeID)
	}
	if len(report.Stages) != 5 {
		t.Fatalf("expected 5 stages, got %d", len(report.Stages))
	}

	stage1 := report.Stages[0]
	if stage1.Key != "card_open" || stage1.Journeys != 100 || stage1.ConversionFromPrev != 1 || stage1.ConversionFromStart != 1 {
		t.Fatalf("unexpected stage1: %+v", stage1)
	}
	stage5 := report.Stages[4]
	if stage5.Key != "review_submit" || stage5.Journeys != 9 {
		t.Fatalf("unexpected stage5: %+v", stage5)
	}
	if stage5.ConversionFromPrev < 0.49 || stage5.ConversionFromPrev > 0.51 {
		t.Fatalf("unexpected stage5 conversion from prev: %v", stage5.ConversionFromPrev)
	}
	if stage5.ConversionFromStart < 0.089 || stage5.ConversionFromStart > 0.091 {
		t.Fatalf("unexpected stage5 conversion from start: %v", stage5.ConversionFromStart)
	}
}
