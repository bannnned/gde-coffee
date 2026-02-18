package reviews

import "testing"

func TestCalculateReviewQualityV1BoundsAndPenalties(t *testing.T) {
	zero := calculateReviewQualityV1("", 0, 0, 0, "none", 0)
	if zero != 0 {
		t.Fatalf("expected zero quality score for empty inputs, got %v", zero)
	}

	maxed := calculateReviewQualityV1("espresso", 5, 220, 3, "high", 0)
	if maxed != 100 {
		t.Fatalf("expected max quality score=100, got %v", maxed)
	}

	penalizedOnce := calculateReviewQualityV1("espresso", 5, 220, 3, "high", 1)
	if penalizedOnce != 80 {
		t.Fatalf("expected single confirmed report penalty to yield 80, got %v", penalizedOnce)
	}

	penalizedMany := calculateReviewQualityV1("espresso", 5, 220, 3, "high", 6)
	if penalizedMany != 0 {
		t.Fatalf("expected score clamp at 0 under heavy penalties, got %v", penalizedMany)
	}
}

func TestVoteWeightFromReputationBoundsAndMonotonicity(t *testing.T) {
	low := voteWeightFromReputation(-50)
	mid := voteWeightFromReputation(500)
	high := voteWeightFromReputation(2500)

	if low != 0.8 {
		t.Fatalf("expected lower clamp 0.8, got %v", low)
	}
	if high != 1.5 {
		t.Fatalf("expected upper clamp 1.5, got %v", high)
	}
	if !(low < mid && mid < high) {
		t.Fatalf("expected monotonic weight growth low=%v mid=%v high=%v", low, mid, high)
	}
}

func TestNormalizeConfidenceAndVisitScore(t *testing.T) {
	cases := []struct {
		raw   string
		want  string
		score float64
	}{
		{raw: "LOW", want: "low", score: 0.4},
		{raw: "medium", want: "medium", score: 0.7},
		{raw: " high ", want: "high", score: 1.0},
		{raw: "unknown", want: "none", score: 0.0},
		{raw: "", want: "none", score: 0.0},
	}

	for _, tc := range cases {
		got := normalizeConfidence(tc.raw)
		if got != tc.want {
			t.Fatalf("normalizeConfidence(%q) expected %q, got %q", tc.raw, tc.want, got)
		}
		gotScore := visitScoreFromConfidence(tc.raw)
		if gotScore != tc.score {
			t.Fatalf("visitScoreFromConfidence(%q) expected %v, got %v", tc.raw, tc.score, gotScore)
		}
	}
}

func TestCalculateReviewQualityScoreFallsBackToV1ForV2(t *testing.T) {
	service := &Service{
		versioning: formulaVersioning{
			QualityFormula: QualityFormulaV2,
		},
	}

	score, formula := service.calculateReviewQualityScore(
		"espresso",
		3,
		140,
		2,
		"medium",
		0,
	)
	if formula != QualityFormulaV1 {
		t.Fatalf("expected v2 fallback to quality_v1, got %q", formula)
	}
	if score <= 0 || score > 100 {
		t.Fatalf("expected fallback score in (0,100], got %v", score)
	}
}
