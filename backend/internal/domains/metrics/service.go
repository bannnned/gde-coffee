package metrics

import (
	"context"
	"time"
)

type repository interface {
	InsertEvents(ctx context.Context, events []EventInput) (int, error)
	ListDailyNorthStarMetrics(ctx context.Context, dateFrom time.Time, dateTo time.Time, cafeID string) ([]DailyNorthStarMetrics, error)
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
	if days <= 0 {
		days = DefaultRangeDays
	}
	if days > MaxRangeDays {
		days = MaxRangeDays
	}

	nowUTC := now.UTC()
	dateTo := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 0, 0, 0, 0, time.UTC).Add(24 * time.Hour)
	dateFrom := dateTo.AddDate(0, 0, -days)

	rawDaily, err := s.repository.ListDailyNorthStarMetrics(ctx, dateFrom, dateTo, cafeID)
	if err != nil {
		return NorthStarReport{}, err
	}

	dailyMap := make(map[string]DailyNorthStarMetrics, len(rawDaily))
	for _, row := range rawDaily {
		key := row.Day.UTC().Format("2006-01-02")
		dailyMap[key] = row
	}

	daily := make([]NorthStarDailyPoint, 0, days)
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
			Days:                days,
			CafeID:              cafeID,
			VisitIntentJourneys: totalIntent,
			NorthStarJourneys:   totalNorthStar,
			Rate:                safeRate(totalNorthStar, totalIntent),
		},
		Daily: daily,
	}, nil
}

func safeRate(numerator int, denominator int) float64 {
	if denominator <= 0 {
		return 0
	}
	return float64(numerator) / float64(denominator)
}
