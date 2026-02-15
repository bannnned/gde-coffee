package reviews

import (
	"math"
	"strings"
)

// calculateReviewQualityV1 implements the public formula agreed in stage 0.
func calculateReviewQualityV1(
	drinkName string,
	tagsCount int,
	summaryLength int,
	photoCount int,
	confidence string,
	confirmedReports int,
) float64 {
	drink := 0.0
	if strings.TrimSpace(drinkName) != "" {
		drink = 1.0
	}

	tags := clamp(float64(minInt(tagsCount, 5))/5.0, 0, 1)
	text := 0.0
	switch {
	case summaryLength >= 180:
		text = 1.0
	case summaryLength >= 100:
		text = 0.7
	case summaryLength >= 60:
		text = 0.4
	default:
		text = 0.0
	}

	photo := clamp(float64(minInt(photoCount, 3))/3.0, 0, 1)
	visit := visitScoreFromConfidence(confidence)

	// review_quality_v1 = base(feature weights) - moderation penalties.
	base := 100.0 * ((0.20 * drink) + (0.20 * tags) + (0.25 * text) + (0.20 * photo) + (0.15 * visit))
	penalty := float64(20 * maxInt(confirmedReports, 0))
	return clamp(math.Round(base-penalty), 0, 100)
}

func voteWeightFromReputation(reputationScore float64) float64 {
	// voter_weight = clamp(0.8 + 0.7*(rep/1000), 0.8, 1.5)
	return clamp(0.8+0.7*(clamp(reputationScore, 0, 1000)/1000.0), 0.8, 1.5)
}

func visitScoreFromConfidence(confidence string) float64 {
	switch normalizeConfidence(confidence) {
	case "low":
		return 0.4
	case "medium":
		return 0.7
	case "high":
		return 1.0
	default:
		return 0.0
	}
}

func normalizeConfidence(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "low", "medium", "high", "none":
		return strings.ToLower(strings.TrimSpace(raw))
	default:
		return "none"
	}
}
