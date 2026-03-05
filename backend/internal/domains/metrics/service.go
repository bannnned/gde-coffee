package metrics

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"
)

type repository interface {
	InsertEvents(ctx context.Context, events []EventInput) (int, error)
	ListDailyNorthStarMetrics(ctx context.Context, dateFrom time.Time, dateTo time.Time, cafeID string) ([]DailyNorthStarMetrics, error)
	GetFunnelJourneyCounts(ctx context.Context, dateFrom time.Time, dateTo time.Time, cafeID string) (FunnelJourneyCounts, error)
	GetMapPerfSnapshot(ctx context.Context, dateFrom time.Time, dateTo time.Time) (MapPerfSnapshot, error)
	ListMapPerfDailyMetrics(ctx context.Context, dateFrom time.Time, dateTo time.Time) ([]MapPerfDailyMetrics, error)
	ListMapPerfNetworkMetrics(ctx context.Context, dateFrom time.Time, dateTo time.Time) ([]MapPerfNetworkMetrics, error)
	ResetExpiredMapPerfAlertStates(ctx context.Context, now time.Time) error
	ListMapPerfAlertStates(ctx context.Context) ([]MapPerfAlertState, error)
	UpsertMapPerfAlertState(ctx context.Context, state MapPerfAlertState) error
	InsertMapPerfAlertAction(ctx context.Context, action MapPerfAlertAction) error
	ListRecentMapPerfAlertActions(ctx context.Context, limit int) ([]MapPerfAlertAction, error)
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

func (s *Service) GetMapPerfReport(
	ctx context.Context,
	days int,
	now time.Time,
) (MapPerfReport, error) {
	nowUTC := now.UTC()
	if err := s.repository.ResetExpiredMapPerfAlertStates(ctx, nowUTC); err != nil {
		return MapPerfReport{}, err
	}
	dateFrom, dateTo, normalizedDays := buildDateRange(days, now)
	snapshot, err := s.repository.GetMapPerfSnapshot(ctx, dateFrom, dateTo)
	if err != nil {
		return MapPerfReport{}, err
	}
	dailyRows, err := s.repository.ListMapPerfDailyMetrics(ctx, dateFrom, dateTo)
	if err != nil {
		return MapPerfReport{}, err
	}
	networkRows, err := s.repository.ListMapPerfNetworkMetrics(ctx, dateFrom, dateTo)
	if err != nil {
		return MapPerfReport{}, err
	}
	alertStates, err := s.repository.ListMapPerfAlertStates(ctx)
	if err != nil {
		return MapPerfReport{}, err
	}
	alertActions, err := s.repository.ListRecentMapPerfAlertActions(ctx, 40)
	if err != nil {
		return MapPerfReport{}, err
	}

	dailyByDate := make(map[string]MapPerfDailyMetrics, len(dailyRows))
	for _, row := range dailyRows {
		key := row.Day.UTC().Format("2006-01-02")
		dailyByDate[key] = row
	}

	daily := make([]MapPerfDailyPoint, 0, normalizedDays)
	for day := dateFrom; day.Before(dateTo); day = day.Add(24 * time.Hour) {
		key := day.Format("2006-01-02")
		row := dailyByDate[key]
		daily = append(daily, MapPerfDailyPoint{
			Date:                   key,
			FirstRenderEvents:      row.FirstRenderEvents,
			FirstRenderP50Ms:       row.FirstRenderP50Ms,
			FirstRenderP95Ms:       row.FirstRenderP95Ms,
			FirstInteractionEvents: row.FirstInteractionEvents,
			FirstInteractionP50Ms:  row.FirstInteractionP50Ms,
			FirstInteractionP95Ms:  row.FirstInteractionP95Ms,
			InteractionCoverage:    safeRate(row.FirstInteractionEvents, row.FirstRenderEvents),
		})
	}

	network := make([]MapPerfNetworkPoint, 0, len(networkRows))
	for _, row := range networkRows {
		network = append(network, MapPerfNetworkPoint{
			EffectiveType:          row.EffectiveType,
			FirstRenderEvents:      row.FirstRenderEvents,
			FirstRenderP50Ms:       row.FirstRenderP50Ms,
			FirstRenderP95Ms:       row.FirstRenderP95Ms,
			FirstInteractionEvents: row.FirstInteractionEvents,
			FirstInteractionP50Ms:  row.FirstInteractionP50Ms,
			FirstInteractionP95Ms:  row.FirstInteractionP95Ms,
			InteractionCoverage:    safeRate(row.FirstInteractionEvents, row.FirstRenderEvents),
		})
	}

	interactionCoverage := safeRate(snapshot.FirstInteractionEvents, snapshot.FirstRenderEvents)
	trendDeltaPct := computeRecentTrendDeltaPct(daily)
	alertStateByKey := make(map[string]MapPerfAlertState, len(alertStates))
	for _, state := range alertStates {
		alertStateByKey[state.AlertKey] = state
	}
	alerts := buildMapPerfAlerts(snapshot, interactionCoverage, trendDeltaPct)
	alerts = applyMapPerfAlertStates(alerts, alertStateByKey, nowUTC)
	actions := buildMapPerfAlertActionPoints(alertActions)

	return MapPerfReport{
		Summary: MapPerfSummary{
			From:                   dateFrom.Format(time.RFC3339),
			To:                     dateTo.Format(time.RFC3339),
			Days:                   normalizedDays,
			FirstRenderEvents:      snapshot.FirstRenderEvents,
			FirstRenderP50Ms:       snapshot.FirstRenderP50Ms,
			FirstRenderP95Ms:       snapshot.FirstRenderP95Ms,
			FirstInteractionEvents: snapshot.FirstInteractionEvents,
			FirstInteractionP50Ms:  snapshot.FirstInteractionP50Ms,
			FirstInteractionP95Ms:  snapshot.FirstInteractionP95Ms,
			InteractionCoverage:    interactionCoverage,
		},
		Daily:   daily,
		Network: network,
		Alerts:  alerts,
		History: buildMapPerfHistory(daily),
		Actions: actions,
	}, nil
}

func (s *Service) UpdateMapPerfAlertState(ctx context.Context, input UpdateMapPerfAlertStateInput) error {
	alertKey := input.AlertKey
	if !isSupportedAlertKey(alertKey) {
		return validationError("alert_key не поддерживается.")
	}
	action := input.Action
	if action != "ack" && action != "snooze" && action != "reset" {
		return validationError("action должен быть ack, snooze или reset.")
	}
	owner := strings.TrimSpace(input.Owner)
	comment := strings.TrimSpace(input.Comment)
	if len(owner) > 120 {
		return validationError("owner слишком длинный (максимум 120 символов).")
	}
	if len(comment) > 500 {
		return validationError("comment слишком длинный (максимум 500 символов).")
	}
	if action == "ack" && owner == "" {
		return validationError("owner обязателен для ack.")
	}

	now := input.OccurredAt.UTC()
	if now.IsZero() {
		now = time.Now().UTC()
	}

	nextState := MapPerfAlertState{
		AlertKey:       alertKey,
		State:          AlertStateActive,
		SnoozedUntil:   nil,
		AcknowledgedAt: nil,
		AcknowledgedBy: input.ActorUserID,
		Owner:          owner,
		Comment:        comment,
	}
	switch action {
	case "ack":
		nextState.State = AlertStateAcked
		nextState.AcknowledgedAt = &now
	case "snooze":
		hours := input.SnoozeHours
		if hours <= 0 {
			hours = 24
		}
		if hours > 24*7 {
			hours = 24 * 7
		}
		until := now.Add(time.Duration(hours) * time.Hour)
		nextState.State = AlertStateSnoozed
		nextState.SnoozedUntil = &until
		nextState.AcknowledgedAt = &now
	case "reset":
		nextState.State = AlertStateActive
		nextState.Owner = ""
		nextState.Comment = ""
	}
	if err := s.repository.UpsertMapPerfAlertState(ctx, nextState); err != nil {
		return err
	}
	snoozeHours := 0
	if action == "snooze" {
		snoozeHours = input.SnoozeHours
		if snoozeHours <= 0 {
			snoozeHours = 24
		}
		if snoozeHours > 24*7 {
			snoozeHours = 24 * 7
		}
	}
	return s.repository.InsertMapPerfAlertAction(ctx, MapPerfAlertAction{
		AlertKey:    alertKey,
		Action:      action,
		ActorUserID: input.ActorUserID,
		SnoozeHours: snoozeHours,
		CreatedAt:   now,
		Owner:       owner,
		Comment:     comment,
	})
}

func classifyLatency(valueMs float64, goodThreshold float64, watchThreshold float64) string {
	if valueMs <= 0 {
		return "watch"
	}
	if valueMs <= goodThreshold {
		return "good"
	}
	if valueMs <= watchThreshold {
		return "watch"
	}
	return "risk"
}

func classifyCoverage(value float64, goodThreshold float64, watchThreshold float64) string {
	if value <= 0 {
		return "risk"
	}
	if value >= goodThreshold {
		return "good"
	}
	if value >= watchThreshold {
		return "watch"
	}
	return "risk"
}

func severityFromStatus(status string) string {
	if status == "risk" {
		return "risk"
	}
	return "watch"
}

func computeRecentTrendDeltaPct(daily []MapPerfDailyPoint) float64 {
	withData := make([]MapPerfDailyPoint, 0, len(daily))
	for _, point := range daily {
		if point.FirstRenderEvents > 0 && point.FirstRenderP95Ms > 0 {
			withData = append(withData, point)
		}
	}
	if len(withData) < 4 {
		return 0
	}

	recent := withData[maxInt(0, len(withData)-3):]
	prevEnd := maxInt(0, len(withData)-3)
	prevStart := maxInt(0, prevEnd-3)
	previous := withData[prevStart:prevEnd]
	if len(previous) == 0 {
		return 0
	}

	recentAvg := averageRenderP95(recent)
	prevAvg := averageRenderP95(previous)
	if prevAvg <= 0 {
		return 0
	}
	return ((recentAvg - prevAvg) / prevAvg) * 100
}

func averageRenderP95(points []MapPerfDailyPoint) float64 {
	if len(points) == 0 {
		return 0
	}
	sum := 0.0
	count := 0
	for _, point := range points {
		if point.FirstRenderP95Ms > 0 {
			sum += point.FirstRenderP95Ms
			count++
		}
	}
	if count == 0 {
		return 0
	}
	return sum / float64(count)
}

func buildMapPerfAlerts(snapshot MapPerfSnapshot, interactionCoverage float64, trendDeltaPct float64) []MapPerfAlert {
	if snapshot.FirstRenderEvents <= 0 {
		return nil
	}
	alerts := make([]MapPerfAlert, 0, 4)

	renderStatus := classifyLatency(snapshot.FirstRenderP95Ms, 2200, 3200)
	if renderStatus != "good" {
		alerts = append(alerts, MapPerfAlert{
			Key:      "render_p95",
			Severity: severityFromStatus(renderStatus),
			Label:    "Render p95",
			Value:    fmt.Sprintf("%d мс", int(math.Round(snapshot.FirstRenderP95Ms))),
			Target:   "цель ≤ 3200 мс",
			State:    AlertStateActive,
		})
	}

	interactionStatus := classifyLatency(snapshot.FirstInteractionP95Ms, 2800, 4200)
	if interactionStatus != "good" {
		alerts = append(alerts, MapPerfAlert{
			Key:      "interaction_p95",
			Severity: severityFromStatus(interactionStatus),
			Label:    "Interaction p95",
			Value:    fmt.Sprintf("%d мс", int(math.Round(snapshot.FirstInteractionP95Ms))),
			Target:   "цель ≤ 4200 мс",
			State:    AlertStateActive,
		})
	}

	coverageStatus := classifyCoverage(interactionCoverage, 0.55, 0.4)
	if coverageStatus != "good" {
		alerts = append(alerts, MapPerfAlert{
			Key:      "coverage",
			Severity: severityFromStatus(coverageStatus),
			Label:    "Interaction coverage",
			Value:    fmt.Sprintf("%.1f%%", interactionCoverage*100),
			Target:   "цель ≥ 55%",
			State:    AlertStateActive,
		})
	}

	if trendDeltaPct >= 15 {
		alerts = append(alerts, MapPerfAlert{
			Key:      "trend",
			Severity: "watch",
			Label:    "Render trend",
			Value:    fmt.Sprintf("+%.1f%%", trendDeltaPct),
			Target:   "рост < 15%",
			State:    AlertStateActive,
		})
	}

	return alerts
}

func applyMapPerfAlertStates(alerts []MapPerfAlert, states map[string]MapPerfAlertState, now time.Time) []MapPerfAlert {
	result := make([]MapPerfAlert, 0, len(alerts))
	for _, alert := range alerts {
		state, ok := states[alert.Key]
		if !ok {
			result = append(result, alert)
			continue
		}
		switch state.State {
		case AlertStateSnoozed:
			if state.SnoozedUntil != nil && state.SnoozedUntil.After(now) {
				alert.State = AlertStateSnoozed
				alert.SnoozedUntil = state.SnoozedUntil.UTC().Format(time.RFC3339)
				if state.AcknowledgedAt != nil {
					alert.AcknowledgedAt = state.AcknowledgedAt.UTC().Format(time.RFC3339)
				}
				alert.AcknowledgedBy = state.AcknowledgedBy
				alert.Owner = state.Owner
				alert.Comment = state.Comment
				result = append(result, alert)
				continue
			}
			alert.State = AlertStateActive
		case AlertStateAcked:
			alert.State = AlertStateAcked
			if state.AcknowledgedAt != nil {
				alert.AcknowledgedAt = state.AcknowledgedAt.UTC().Format(time.RFC3339)
			}
			alert.AcknowledgedBy = state.AcknowledgedBy
			alert.Owner = state.Owner
			alert.Comment = state.Comment
		default:
			alert.State = AlertStateActive
		}
		result = append(result, alert)
	}
	return result
}

func buildMapPerfAlertActionPoints(actions []MapPerfAlertAction) []MapPerfAlertActionPoint {
	result := make([]MapPerfAlertActionPoint, 0, len(actions))
	for _, action := range actions {
		result = append(result, MapPerfAlertActionPoint{
			AlertKey:    action.AlertKey,
			Action:      action.Action,
			ActorUserID: action.ActorUserID,
			SnoozeHours: action.SnoozeHours,
			CreatedAt:   action.CreatedAt.UTC().Format(time.RFC3339),
			Owner:       action.Owner,
			Comment:     action.Comment,
		})
	}
	return result
}

func isSupportedAlertKey(value string) bool {
	switch value {
	case "render_p95", "interaction_p95", "coverage", "trend":
		return true
	default:
		return false
	}
}

func buildMapPerfHistory(daily []MapPerfDailyPoint) []MapPerfHistoryPoint {
	history := make([]MapPerfHistoryPoint, 0, 20)
	prevStatus := ""
	prevRenderP95 := 0.0
	for _, point := range daily {
		if point.FirstRenderEvents <= 0 {
			continue
		}
		renderStatus := classifyLatency(point.FirstRenderP95Ms, 2200, 3200)
		interactionStatus := classifyLatency(point.FirstInteractionP95Ms, 2800, 4200)
		coverageStatus := classifyCoverage(point.InteractionCoverage, 0.55, 0.4)
		status := maxStatus(renderStatus, interactionStatus, coverageStatus)
		trendDeltaPct := 0.0
		if prevRenderP95 > 0 && point.FirstRenderP95Ms > 0 {
			trendDeltaPct = ((point.FirstRenderP95Ms - prevRenderP95) / prevRenderP95) * 100
		}

		if len(history) == 0 || prevStatus != status || math.Abs(trendDeltaPct) >= 15 {
			history = append(history, MapPerfHistoryPoint{
				Date:                  point.Date,
				Status:                status,
				FirstRenderP95Ms:      point.FirstRenderP95Ms,
				FirstInteractionP95Ms: point.FirstInteractionP95Ms,
				InteractionCoverage:   point.InteractionCoverage,
				TrendDeltaPct:         trendDeltaPct,
			})
			if len(history) > 20 {
				history = history[len(history)-20:]
			}
		}

		prevStatus = status
		if point.FirstRenderP95Ms > 0 {
			prevRenderP95 = point.FirstRenderP95Ms
		}
	}
	return history
}

func maxStatus(values ...string) string {
	best := "good"
	for _, value := range values {
		if value == "risk" {
			return "risk"
		}
		if value == "watch" {
			best = "watch"
		}
	}
	return best
}

func maxInt(a int, b int) int {
	if a > b {
		return a
	}
	return b
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
