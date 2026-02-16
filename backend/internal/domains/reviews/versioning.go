package reviews

import (
	"os"
	"strings"
)

const (
	ReviewsAPIContractV1 = "reviews_api_v1"

	RatingFormulaV2 = "rating_v2"
	RatingFormulaV3 = "rating_v3"

	QualityFormulaV1 = "quality_v1"
	QualityFormulaV2 = "quality_v2"
)

type formulaVersioning struct {
	APIContractVersion string

	RequestedRatingFormula  string
	RequestedQualityFormula string

	RatingFormula  string
	QualityFormula string

	RatingFallback  bool
	QualityFallback bool

	FlagRatingV3Enabled  bool
	FlagQualityV2Enabled bool
}

func loadFormulaVersioningFromEnv() formulaVersioning {
	apiContract := normalizeNonEmpty(
		strings.TrimSpace(os.Getenv("REVIEWS_API_CONTRACT_VERSION")),
		ReviewsAPIContractV1,
	)
	requestedRating := normalizeRatingFormulaVersion(
		strings.TrimSpace(os.Getenv("REVIEWS_RATING_FORMULA_VERSION")),
		RatingFormulaV2,
	)
	requestedQuality := normalizeQualityFormulaVersion(
		strings.TrimSpace(os.Getenv("REVIEWS_QUALITY_FORMULA_VERSION")),
		QualityFormulaV1,
	)

	flagRatingV3 := envBool("REVIEWS_FF_RATING_V3_ENABLED", false)
	flagQualityV2 := envBool("REVIEWS_FF_QUALITY_V2_ENABLED", false)

	appliedRating := requestedRating
	appliedQuality := requestedQuality
	ratingFallback := false
	qualityFallback := false

	// rating_v3 stays behind a flag and is not computed yet in this release.
	// If it is requested accidentally, we fall back to the stable rating_v2.
	if requestedRating == RatingFormulaV3 {
		appliedRating = RatingFormulaV2
		ratingFallback = true
		if !flagRatingV3 {
			ratingFallback = true
		}
	}

	// quality_v2 stays behind a flag and is not computed yet in this release.
	// Fallback keeps scoring deterministic while allowing safe flag rollout.
	if requestedQuality == QualityFormulaV2 {
		appliedQuality = QualityFormulaV1
		qualityFallback = true
		if !flagQualityV2 {
			qualityFallback = true
		}
	}

	return formulaVersioning{
		APIContractVersion:      apiContract,
		RequestedRatingFormula:  requestedRating,
		RequestedQualityFormula: requestedQuality,
		RatingFormula:           appliedRating,
		QualityFormula:          appliedQuality,
		RatingFallback:          ratingFallback,
		QualityFallback:         qualityFallback,
		FlagRatingV3Enabled:     flagRatingV3,
		FlagQualityV2Enabled:    flagQualityV2,
	}
}

func normalizeRatingFormulaVersion(raw string, fallback string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case RatingFormulaV2:
		return RatingFormulaV2
	case RatingFormulaV3:
		return RatingFormulaV3
	default:
		return fallback
	}
}

func normalizeQualityFormulaVersion(raw string, fallback string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case QualityFormulaV1:
		return QualityFormulaV1
	case QualityFormulaV2:
		return QualityFormulaV2
	default:
		return fallback
	}
}

func normalizeNonEmpty(value string, fallback string) string {
	next := strings.TrimSpace(value)
	if next == "" {
		return fallback
	}
	return next
}

func envBool(key string, fallback bool) bool {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	switch raw {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return fallback
	}
}

func (s *Service) appendVersionMetadata(payload map[string]interface{}) {
	if payload == nil {
		return
	}
	payload["api_contract_version"] = s.versioning.APIContractVersion
	payload["formula_versions"] = map[string]interface{}{
		"rating":  s.versioning.RatingFormula,
		"quality": s.versioning.QualityFormula,
	}
	payload["formula_requests"] = map[string]interface{}{
		"rating":  s.versioning.RequestedRatingFormula,
		"quality": s.versioning.RequestedQualityFormula,
	}
	payload["formula_fallbacks"] = map[string]interface{}{
		"rating":  s.versioning.RatingFallback,
		"quality": s.versioning.QualityFallback,
	}
	payload["feature_flags"] = map[string]interface{}{
		"rating_v3_enabled":  s.versioning.FlagRatingV3Enabled,
		"quality_v2_enabled": s.versioning.FlagQualityV2Enabled,
	}
}

func (s *Service) versioningSnapshot() map[string]interface{} {
	return map[string]interface{}{
		"api_contract_version": s.versioning.APIContractVersion,
		"formula_versions": map[string]interface{}{
			"rating":  s.versioning.RatingFormula,
			"quality": s.versioning.QualityFormula,
		},
		"formula_requests": map[string]interface{}{
			"rating":  s.versioning.RequestedRatingFormula,
			"quality": s.versioning.RequestedQualityFormula,
		},
		"formula_fallbacks": map[string]interface{}{
			"rating":  s.versioning.RatingFallback,
			"quality": s.versioning.QualityFallback,
		},
		"feature_flags": map[string]interface{}{
			"rating_v3_enabled":  s.versioning.FlagRatingV3Enabled,
			"quality_v2_enabled": s.versioning.FlagQualityV2Enabled,
		},
	}
}
