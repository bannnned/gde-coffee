package reviews

import (
	"strings"
	"testing"
	"time"
)

func TestLoadTimewebBearerTokenFromEnvDirect(t *testing.T) {
	t.Setenv("TIMEWEB_AI_BEARER_TOKEN", "direct-token")
	t.Setenv("TIMEWEB_AI_BEARER_TOKEN_P1", "part-1")
	t.Setenv("TIMEWEB_AI_BEARER_TOKEN_P2", "part-2")

	got := loadTimewebBearerTokenFromEnv()
	if got != "direct-token" {
		t.Fatalf("expected direct token, got %q", got)
	}
}

func TestLoadTimewebBearerTokenFromEnvSplitParts(t *testing.T) {
	t.Setenv("TIMEWEB_AI_BEARER_TOKEN", "")
	t.Setenv("TIMEWEB_AI_BEARER_TOKEN_P1", "abc")
	t.Setenv("TIMEWEB_AI_BEARER_TOKEN_P2", "123")
	t.Setenv("TIMEWEB_AI_BEARER_TOKEN_P3", "xyz")

	got := loadTimewebBearerTokenFromEnv()
	if got != "abc123xyz" {
		t.Fatalf("unexpected assembled token: %q", got)
	}
}

func TestNormalizeChatCompletionsURL(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "already_completions",
			in:   "https://agent.timeweb.cloud/api/v1/cloud-ai/agents/a1/v1/chat/completions",
			want: "https://agent.timeweb.cloud/api/v1/cloud-ai/agents/a1/v1/chat/completions",
		},
		{
			name: "base_v1_url",
			in:   "https://agent.timeweb.cloud/api/v1/cloud-ai/agents/a1/v1",
			want: "https://agent.timeweb.cloud/api/v1/cloud-ai/agents/a1/v1/chat/completions",
		},
		{
			name: "empty",
			in:   "   ",
			want: "",
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got := normalizeChatCompletionsURL(tc.in)
			if got != tc.want {
				t.Fatalf("unexpected normalized url: got=%q want=%q", got, tc.want)
			}
		})
	}
}

func TestNormalizeAITagLabels(t *testing.T) {
	got := normalizeAITagLabels([]string{" уютно ", "УЮТНО", "", "есть розетки"}, 5)
	if len(got) != 2 {
		t.Fatalf("expected 2 tags, got %d: %v", len(got), got)
	}
	if got[0] != "уютно" || got[1] != "есть розетки" {
		t.Fatalf("unexpected normalized tags: %v", got)
	}
}

func TestDecideAISummaryAttemptThresholdWait(t *testing.T) {
	previous := aiSummaryState{
		GeneratedAtStep: 5,
	}
	run, reason, nextThreshold := decideAISummaryAttempt(
		aiSummaryConfig{Enabled: true},
		previous,
		false,
		9,
	)
	if run {
		t.Fatalf("expected threshold wait (run=false), got run=true reason=%s", reason)
	}
	if reason != "threshold_wait" {
		t.Fatalf("expected reason=threshold_wait, got %q", reason)
	}
	if nextThreshold != 10 {
		t.Fatalf("expected next threshold=10, got %d", nextThreshold)
	}
}

func TestDecideAISummaryAttemptForce(t *testing.T) {
	run, reason, _ := decideAISummaryAttempt(
		aiSummaryConfig{Enabled: true},
		aiSummaryState{GeneratedAtStep: 10},
		true,
		11,
	)
	if !run {
		t.Fatalf("expected run=true for force, got false reason=%s", reason)
	}
	if reason != "manual_force" {
		t.Fatalf("expected reason=manual_force, got %q", reason)
	}
}

func TestDecideAISummaryAttemptThresholdReached(t *testing.T) {
	run, reason, nextThreshold := decideAISummaryAttempt(
		aiSummaryConfig{Enabled: true},
		aiSummaryState{},
		false,
		5,
	)
	if !run {
		t.Fatalf("expected run=true on first threshold, got false reason=%s", reason)
	}
	if reason != "threshold_reached" {
		t.Fatalf("expected reason=threshold_reached, got %q", reason)
	}
	if nextThreshold != 10 {
		t.Fatalf("expected next threshold=10, got %d", nextThreshold)
	}
}

func TestBuildAISummaryStaleNotice(t *testing.T) {
	now := time.Date(2026, 2, 22, 12, 0, 0, 0, time.UTC)
	stale := buildAISummaryStaleNotice([]aiReviewSignal{
		{CreatedAt: now.Add(-15 * 24 * time.Hour)},
		{CreatedAt: now.Add(-20 * 24 * time.Hour)},
	}, now)
	if stale == "" {
		t.Fatalf("expected stale notice for old reviews")
	}

	fresh := buildAISummaryStaleNotice([]aiReviewSignal{
		{CreatedAt: now.Add(-3 * 24 * time.Hour)},
	}, now)
	if fresh != "" {
		t.Fatalf("expected no stale notice for fresh reviews")
	}
}

func TestBuildAISummaryPromptReviewsTruncatesSummary(t *testing.T) {
	cfg := aiSummaryConfig{
		MaxInputReviews: 3,
		MinReviews:      3,
	}
	reviews := []aiReviewSignal{
		{
			ReviewID:      "r1",
			Rating:        5,
			Summary:       strings.Repeat("а", aiSummaryPromptSummaryRunes+80),
			HelpfulScore:  10,
			VisitVerified: true,
			CreatedAt:     time.Now().UTC(),
		},
		{
			ReviewID:      "r2",
			Rating:        4,
			Summary:       "хороший кофе",
			HelpfulScore:  9,
			VisitVerified: true,
			CreatedAt:     time.Now().UTC().Add(-time.Minute),
		},
		{
			ReviewID:      "r3",
			Rating:        4,
			Summary:       "уютная атмосфера",
			HelpfulScore:  8,
			VisitVerified: false,
			CreatedAt:     time.Now().UTC().Add(-2 * time.Minute),
		},
	}

	items, err := buildAISummaryPromptReviews(reviews, cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 prompt items, got %d", len(items))
	}
	if got := len([]rune(items[0].Summary)); got > aiSummaryPromptSummaryRunes {
		t.Fatalf("summary must be truncated to <= %d runes, got %d", aiSummaryPromptSummaryRunes, got)
	}
}

func TestComputeAISummaryInputHashStable(t *testing.T) {
	items := []aiSummaryPromptReview{
		{Rating: 5, Summary: "чистый эспрессо", VisitVerified: true},
		{Rating: 4, Summary: "быстрая подача", VisitVerified: false},
	}

	hashA, err := computeAISummaryInputHash("cafe-1", items)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	hashB, err := computeAISummaryInputHash("cafe-1", items)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if hashA != hashB {
		t.Fatalf("expected stable hash, got %q and %q", hashA, hashB)
	}

	hashC, err := computeAISummaryInputHash("cafe-1", []aiSummaryPromptReview{
		{Rating: 5, Summary: "другая выжимка", VisitVerified: true},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if hashA == hashC {
		t.Fatalf("expected hash to change for different prompt payload")
	}
}
