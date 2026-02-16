package reviews

import "testing"

func TestLoadFormulaVersioning_Defaults(t *testing.T) {
	t.Setenv("REVIEWS_API_CONTRACT_VERSION", "")
	t.Setenv("REVIEWS_RATING_FORMULA_VERSION", "")
	t.Setenv("REVIEWS_QUALITY_FORMULA_VERSION", "")
	t.Setenv("REVIEWS_FF_RATING_V3_ENABLED", "")
	t.Setenv("REVIEWS_FF_QUALITY_V2_ENABLED", "")

	cfg := loadFormulaVersioningFromEnv()
	if cfg.APIContractVersion != ReviewsAPIContractV1 {
		t.Fatalf("expected default API contract %q, got %q", ReviewsAPIContractV1, cfg.APIContractVersion)
	}
	if cfg.RatingFormula != RatingFormulaV2 {
		t.Fatalf("expected rating formula %q, got %q", RatingFormulaV2, cfg.RatingFormula)
	}
	if cfg.QualityFormula != QualityFormulaV1 {
		t.Fatalf("expected quality formula %q, got %q", QualityFormulaV1, cfg.QualityFormula)
	}
	if cfg.RatingFallback {
		t.Fatalf("did not expect rating fallback in defaults")
	}
	if cfg.QualityFallback {
		t.Fatalf("did not expect quality fallback in defaults")
	}
}

func TestLoadFormulaVersioning_FallbacksForFutureFormulas(t *testing.T) {
	t.Setenv("REVIEWS_API_CONTRACT_VERSION", "reviews_api_v1")
	t.Setenv("REVIEWS_RATING_FORMULA_VERSION", RatingFormulaV3)
	t.Setenv("REVIEWS_QUALITY_FORMULA_VERSION", QualityFormulaV2)
	t.Setenv("REVIEWS_FF_RATING_V3_ENABLED", "true")
	t.Setenv("REVIEWS_FF_QUALITY_V2_ENABLED", "true")

	cfg := loadFormulaVersioningFromEnv()
	if cfg.RequestedRatingFormula != RatingFormulaV3 {
		t.Fatalf("expected requested rating formula %q, got %q", RatingFormulaV3, cfg.RequestedRatingFormula)
	}
	if cfg.RequestedQualityFormula != QualityFormulaV2 {
		t.Fatalf("expected requested quality formula %q, got %q", QualityFormulaV2, cfg.RequestedQualityFormula)
	}
	if cfg.RatingFormula != RatingFormulaV2 {
		t.Fatalf("expected fallback rating formula %q, got %q", RatingFormulaV2, cfg.RatingFormula)
	}
	if cfg.QualityFormula != QualityFormulaV1 {
		t.Fatalf("expected fallback quality formula %q, got %q", QualityFormulaV1, cfg.QualityFormula)
	}
	if !cfg.RatingFallback {
		t.Fatalf("expected rating fallback=true")
	}
	if !cfg.QualityFallback {
		t.Fatalf("expected quality fallback=true")
	}
}

func TestEnvBool(t *testing.T) {
	values := map[string]bool{
		"true":  true,
		"1":     true,
		"yes":   true,
		"on":    true,
		"false": false,
		"0":     false,
		"no":    false,
		"off":   false,
	}
	for raw, expected := range values {
		key := "REVIEWS_TEST_BOOL_" + raw
		t.Setenv(key, raw)
		if actual := envBool(key, !expected); actual != expected {
			t.Fatalf("envBool(%q=%q) expected %v, got %v", key, raw, expected, actual)
		}
	}
}
