package reputation

import (
	"math"
	"testing"
	"time"
)

func TestComputeScoreAppliesDailyCaps(t *testing.T) {
	now := time.Date(2026, 2, 21, 12, 0, 0, 0, time.UTC)
	day := now.Add(-2 * time.Hour)
	events := []ScoreEvent{
		{ID: 1, EventType: EventHelpfulReceived, Points: 12, CreatedAt: day},
		{ID: 2, EventType: EventHelpfulReceived, Points: 12, CreatedAt: day.Add(1 * time.Minute)},
		{ID: 3, EventType: EventVisitVerified, Points: 10, CreatedAt: day.Add(2 * time.Minute)},
		{ID: 4, EventType: EventVisitVerified, Points: 20, CreatedAt: day.Add(3 * time.Minute)},
	}

	score := ComputeScore(events, now)
	// helpful: capped to 20, visit: capped to 24
	want := 44.0
	if math.Abs(score-want) > 0.0001 {
		t.Fatalf("unexpected score: got=%v want=%v", score, want)
	}
}

func TestComputeScoreAppliesDecayByAge(t *testing.T) {
	now := time.Date(2026, 2, 21, 12, 0, 0, 0, time.UTC)
	events := []ScoreEvent{
		{ID: 1, EventType: EventHelpfulReceived, Points: 10, CreatedAt: now.AddDate(0, 0, -20)},
		{ID: 2, EventType: EventHelpfulReceived, Points: 10, CreatedAt: now.AddDate(0, 0, -120)},
		{ID: 3, EventType: EventHelpfulReceived, Points: 10, CreatedAt: now.AddDate(0, 0, -250)},
		{ID: 4, EventType: EventHelpfulReceived, Points: 10, CreatedAt: now.AddDate(0, 0, -600)},
	}

	score := ComputeScore(events, now)
	want := 10.0 + 7.0 + 4.0 + 2.0
	if math.Abs(score-want) > 0.0001 {
		t.Fatalf("unexpected score decay: got=%v want=%v", score, want)
	}
}

func TestLevelFromScore(t *testing.T) {
	level := LevelFromScore(150)
	if level.Level != 3 {
		t.Fatalf("unexpected level: got=%d want=%d", level.Level, 3)
	}
	if level.NextScore != 180 {
		t.Fatalf("unexpected next score: got=%v", level.NextScore)
	}
	if level.PointsToNext < 29.9 || level.PointsToNext > 30.1 {
		t.Fatalf("unexpected points to next: got=%v", level.PointsToNext)
	}
	if level.Progress <= 0 || level.Progress >= 1 {
		t.Fatalf("unexpected progress: got=%v", level.Progress)
	}
}
