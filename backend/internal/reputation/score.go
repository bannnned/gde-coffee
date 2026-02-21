package reputation

import (
	"sort"
	"strings"
	"time"
)

const (
	FormulaVersion          = "reputation_v1_1"
	ScoreMin                = 0.0
	ScoreMax                = 1000.0
	DailyCapHelpfulReceived = 20.0
	DailyCapVisitVerified   = 24.0
	decayFreshDays          = 90
	decayWarmDays           = 180
	decayAgedDays           = 365
	decayFreshMultiplier    = 1.0
	decayWarmMultiplier     = 0.7
	decayAgedMultiplier     = 0.4
	decayLegacyMultiplier   = 0.2
)

type ScoreEvent struct {
	ID        int64
	EventType string
	Points    float64
	CreatedAt time.Time
}

type EventContribution struct {
	Event           ScoreEvent
	AppliedPoints   float64
	DecayMultiplier float64
	EffectivePoints float64
}

type LevelDescriptor struct {
	Level        int
	Label        string
	CurrentScore float64
	NextScore    float64
	Progress     float64
	PointsToNext float64
}

type levelTier struct {
	MinScore float64
	Label    string
}

var levelTiers = []levelTier{
	{MinScore: 0, Label: "Участник"},
	{MinScore: 40, Label: "Активный участник"},
	{MinScore: 120, Label: "Надежный участник"},
	{MinScore: 180, Label: "Проверенный участник"},
	{MinScore: 320, Label: "Эксперт сообщества"},
	{MinScore: 500, Label: "Амбассадор сообщества"},
	{MinScore: 750, Label: "Легенда сообщества"},
}

func ComputeScore(events []ScoreEvent, now time.Time) float64 {
	_, total := EvaluateScoreEvents(events, now)
	return total
}

func EvaluateScoreEvents(events []ScoreEvent, now time.Time) ([]EventContribution, float64) {
	normalizedNow := now.UTC()
	ordered := make([]ScoreEvent, len(events))
	copy(ordered, events)
	sort.SliceStable(ordered, func(i int, j int) bool {
		left := ordered[i].CreatedAt.UTC()
		right := ordered[j].CreatedAt.UTC()
		if left.Equal(right) {
			return ordered[i].ID < ordered[j].ID
		}
		return left.Before(right)
	})

	helpfulDailyEarned := make(map[string]float64)
	visitDailyEarned := make(map[string]float64)
	contributions := make([]EventContribution, 0, len(ordered))
	total := 0.0

	for _, event := range ordered {
		applied := applyDailyCap(event, helpfulDailyEarned, visitDailyEarned)
		multiplier := decayMultiplier(event.CreatedAt, normalizedNow)
		effective := applied * multiplier

		contributions = append(contributions, EventContribution{
			Event:           event,
			AppliedPoints:   applied,
			DecayMultiplier: multiplier,
			EffectivePoints: effective,
		})
		total += effective
	}

	return contributions, clamp(total, ScoreMin, ScoreMax)
}

func applyDailyCap(event ScoreEvent, helpfulDailyEarned map[string]float64, visitDailyEarned map[string]float64) float64 {
	points := event.Points
	if points <= 0 {
		return points
	}

	dayKey := event.CreatedAt.UTC().Format("2006-01-02")
	normalizedType := strings.ToLower(strings.TrimSpace(event.EventType))

	switch normalizedType {
	case EventHelpfulReceived:
		earned := helpfulDailyEarned[dayKey]
		remaining := maxFloat(0, DailyCapHelpfulReceived-earned)
		applied := minFloat(points, remaining)
		helpfulDailyEarned[dayKey] = earned + applied
		return applied
	case EventVisitVerified:
		earned := visitDailyEarned[dayKey]
		remaining := maxFloat(0, DailyCapVisitVerified-earned)
		applied := minFloat(points, remaining)
		visitDailyEarned[dayKey] = earned + applied
		return applied
	default:
		return points
	}
}

func decayMultiplier(createdAt time.Time, now time.Time) float64 {
	if createdAt.IsZero() {
		return decayLegacyMultiplier
	}
	if createdAt.After(now) {
		return decayFreshMultiplier
	}

	ageDays := int(now.Sub(createdAt).Hours() / 24)
	switch {
	case ageDays <= decayFreshDays:
		return decayFreshMultiplier
	case ageDays <= decayWarmDays:
		return decayWarmMultiplier
	case ageDays <= decayAgedDays:
		return decayAgedMultiplier
	default:
		return decayLegacyMultiplier
	}
}

func LevelFromScore(score float64) LevelDescriptor {
	normalized := clamp(score, ScoreMin, ScoreMax)
	tierIndex := 0
	for idx := len(levelTiers) - 1; idx >= 0; idx-- {
		if normalized >= levelTiers[idx].MinScore {
			tierIndex = idx
			break
		}
	}

	tier := levelTiers[tierIndex]
	isMaxTier := tierIndex == len(levelTiers)-1
	if isMaxTier {
		return LevelDescriptor{
			Level:        tierIndex + 1,
			Label:        tier.Label,
			CurrentScore: tier.MinScore,
			NextScore:    tier.MinScore,
			Progress:     1,
			PointsToNext: 0,
		}
	}

	next := levelTiers[tierIndex+1]
	span := maxFloat(1, next.MinScore-tier.MinScore)
	progress := clamp((normalized-tier.MinScore)/span, 0, 1)
	pointsToNext := maxFloat(0, next.MinScore-normalized)

	return LevelDescriptor{
		Level:        tierIndex + 1,
		Label:        tier.Label,
		CurrentScore: tier.MinScore,
		NextScore:    next.MinScore,
		Progress:     progress,
		PointsToNext: pointsToNext,
	}
}

func minFloat(left float64, right float64) float64 {
	if left < right {
		return left
	}
	return right
}

func maxFloat(left float64, right float64) float64 {
	if left > right {
		return left
	}
	return right
}

func clamp(value float64, minValue float64, maxValue float64) float64 {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}
