package metrics

import (
	"context"
	"time"
)

type repository interface {
	InsertEvents(ctx context.Context, events []EventInput) (int, error)
	ListDailyNorthStarMetrics(ctx context.Context, dateFrom time.Time, dateTo time.Time, cafeID string) ([]DailyNorthStarMetrics, error)
	GetFunnelJourneyCounts(ctx context.Context, dateFrom time.Time, dateTo time.Time, cafeID string) (FunnelJourneyCounts, error)
}

type Service struct {
	repository repository
}

func NewService(repository repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) IngestEvents(ctx context.Context, events []EventInput) (int, error) {
	return s.repository.InsertEvents(ctx, events)
}

func (s *Service) GetNorthStarReport(
	ctx context.Context,
	days int,
	cafeID string,
	now time.Time,
) (NorthStarReport, error) {
	dateFrom, dateTo, normalizedDays := buildDateRange(days, now)

	rawDaily, err := s.repository.ListDailyNorthStarMetrics(ctx, dateFrom, dateTo, cafeID)
	if err != nil {
		return NorthStarReport{}, err
	}

	dailyMap := make(map[string]DailyNorthStarMetrics, len(rawDaily))
	for _, row := range rawDaily {
		key := row.Day.UTC().Format("2006-01-02")
		dailyMap[key] = row
	}

	daily := make([]NorthStarDailyPoint, 0, normalizedDays)
	totalIntent := 0
	totalNorthStar := 0
	for day := dateFrom; day.Before(dateTo); day = day.Add(24 * time.Hour) {
		key := day.Format("2006-01-02")
		row := dailyMap[key]
		totalIntent += row.VisitIntentJourneys
		totalNorthStar += row.NorthStarJourneys
		daily = append(daily, NorthStarDailyPoint{
			Date:                key,
			VisitIntentJourneys: row.VisitIntentJourneys,
			NorthStarJourneys:   row.NorthStarJourneys,
			Rate:                safeRate(row.NorthStarJourneys, row.VisitIntentJourneys),
		})
	}

	return NorthStarReport{
		Summary: NorthStarSummary{
			From:                dateFrom.Format(time.RFC3339),
			To:                  dateTo.Format(time.RFC3339),
			Days:                normalizedDays,
			CafeID:              cafeID,
			VisitIntentJourneys: totalIntent,
			NorthStarJourneys:   totalNorthStar,
			Rate:                safeRate(totalNorthStar, totalIntent),
		},
		Daily: daily,
	}, nil
}

func (s *Service) GetFunnelReport(
	ctx context.Context,
	days int,
	cafeID string,
	now time.Time,
) (FunnelReport, error) {
	dateFrom, dateTo, normalizedDays := buildDateRange(days, now)
	counts, err := s.repository.GetFunnelJourneyCounts(ctx, dateFrom, dateTo, cafeID)
	if err != nil {
		return FunnelReport{}, err
	}

	stages := []FunnelStage{
		{
			Key:                 "card_open",
			Label:               "Карточка открыта",
			Journeys:            counts.CardOpenJourneys,
			ConversionFromPrev:  1,
			ConversionFromStart: 1,
		},
		{
			Key:                 "review_read",
			Label:               "Прочитан отзыв",
			Journeys:            counts.ReviewReadJourneys,
			ConversionFromPrev:  safeRate(counts.ReviewReadJourneys, counts.CardOpenJourneys),
			ConversionFromStart: safeRate(counts.ReviewReadJourneys, counts.CardOpenJourneys),
		},
		{
			Key:                 "route_click",
			Label:               "Открыт маршрут",
			Journeys:            counts.RouteClickJourneys,
			ConversionFromPrev:  safeRate(counts.RouteClickJourneys, counts.ReviewReadJourneys),
			ConversionFromStart: safeRate(counts.RouteClickJourneys, counts.CardOpenJourneys),
		},
		{
			Key:                 "checkin_start",
			Label:               "Начат check-in",
			Journeys:            counts.CheckInJourneys,
			ConversionFromPrev:  safeRate(counts.CheckInJourneys, counts.RouteClickJourneys),
			ConversionFromStart: safeRate(counts.CheckInJourneys, counts.CardOpenJourneys),
		},
		{
			Key:                 "review_submit",
			Label:               "Опубликован отзыв",
			Journeys:            counts.ReviewSubmitJourneys,
			ConversionFromPrev:  safeRate(counts.ReviewSubmitJourneys, counts.CheckInJourneys),
			ConversionFromStart: safeRate(counts.ReviewSubmitJourneys, counts.CardOpenJourneys),
		},
	}

	return FunnelReport{
		Summary: FunnelSummary{
			From:   dateFrom.Format(time.RFC3339),
			To:     dateTo.Format(time.RFC3339),
			Days:   normalizedDays,
			CafeID: cafeID,
		},
		Stages: stages,
	}, nil
}

func safeRate(numerator int, denominator int) float64 {
	if denominator <= 0 {
		return 0
	}
	return float64(numerator) / float64(denominator)
}

func buildDateRange(days int, now time.Time) (time.Time, time.Time, int) {
	if days <= 0 {
		days = DefaultRangeDays
	}
	if days > MaxRangeDays {
		days = MaxRangeDays
	}

	nowUTC := now.UTC()
	dateTo := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 0, 0, 0, 0, time.UTC).Add(24 * time.Hour)
	dateFrom := dateTo.AddDate(0, 0, -days)
	return dateFrom, dateTo, days
}
