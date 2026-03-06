package cafes

import (
	"strings"
	"testing"

	"backend/internal/model"
)

func TestApplyTastePersonalizationBoostsMatchingCafe(t *testing.T) {
	base := []model.CafeResponse{
		{ID: "11111111-1111-1111-1111-111111111111", Name: "Near Cafe"},
		{ID: "22222222-2222-2222-2222-222222222222", Name: "Berry Cafe"},
	}
	signals := []userTasteSignal{
		{
			TasteCode:  "fruity_berry",
			Polarity:   "positive",
			Score:      0.9,
			Confidence: 0.8,
		},
	}
	cafeTokens := map[string][]string{
		"22222222-2222-2222-2222-222222222222": {"berries", "sweet"},
	}

	ranked := applyTastePersonalization(base, signals, cafeTokens)
	if len(ranked) != 2 {
		t.Fatalf("expected 2 items, got %d", len(ranked))
	}
	if ranked[0].ID != "22222222-2222-2222-2222-222222222222" {
		t.Fatalf("expected berry cafe first, got %s", ranked[0].ID)
	}
	if ranked[0].Explainability == nil || !strings.Contains(*ranked[0].Explainability, "Под ваш вкус") {
		t.Fatalf("expected positive explainability, got %#v", ranked[0].Explainability)
	}
}

func TestApplyTastePersonalizationDemotesNegativeMatch(t *testing.T) {
	base := []model.CafeResponse{
		{ID: "11111111-1111-1111-1111-111111111111", Name: "Bitter Cafe"},
		{ID: "22222222-2222-2222-2222-222222222222", Name: "Neutral Cafe"},
	}
	signals := []userTasteSignal{
		{
			TasteCode:  "roasted_bitter",
			Polarity:   "negative",
			Score:      0.85,
			Confidence: 0.9,
		},
	}
	cafeTokens := map[string][]string{
		"11111111-1111-1111-1111-111111111111": {"bitter", "dark roast"},
	}

	ranked := applyTastePersonalization(base, signals, cafeTokens)
	if len(ranked) != 2 {
		t.Fatalf("expected 2 items, got %d", len(ranked))
	}
	if ranked[0].ID != "22222222-2222-2222-2222-222222222222" {
		t.Fatalf("expected neutral cafe first, got %s", ranked[0].ID)
	}
	if ranked[1].Explainability == nil || !strings.Contains(*ranked[1].Explainability, "Меньше совпадений") {
		t.Fatalf("expected negative explainability for demoted cafe, got %#v", ranked[1].Explainability)
	}
}
