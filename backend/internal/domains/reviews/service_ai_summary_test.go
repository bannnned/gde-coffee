package reviews

import (
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

func TestDecideAISummaryAttemptCooldown(t *testing.T) {
	now := time.Date(2026, 2, 22, 10, 0, 0, 0, time.UTC)
	previous := aiSummaryState{
		GeneratedAt: now.Add(-12 * time.Hour),
	}
	run, reason, nextAllowed := decideAISummaryAttempt(
		aiSummaryConfig{Enabled: true},
		previous,
		false,
		now,
	)
	if run {
		t.Fatalf("expected cooldown (run=false), got run=true reason=%s", reason)
	}
	if reason != "cooldown" {
		t.Fatalf("expected reason=cooldown, got %q", reason)
	}
	if nextAllowed.IsZero() {
		t.Fatalf("expected non-zero nextAllowed")
	}
}

func TestDecideAISummaryAttemptForce(t *testing.T) {
	now := time.Date(2026, 2, 22, 10, 0, 0, 0, time.UTC)
	previous := aiSummaryState{
		GeneratedAt: now.Add(-1 * time.Hour),
	}
	run, reason, _ := decideAISummaryAttempt(
		aiSummaryConfig{Enabled: true},
		previous,
		true,
		now,
	)
	if !run {
		t.Fatalf("expected run=true for force, got false reason=%s", reason)
	}
	if reason != "manual_force" {
		t.Fatalf("expected reason=manual_force, got %q", reason)
	}
}
