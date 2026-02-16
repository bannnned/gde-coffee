package reviews

// calculateReviewQualityScore computes quality score using active formula version.
// The selector is intentionally explicit to allow safe gated rollout of v2/v3
// formulas via feature flags without changing call sites across the service.
func (s *Service) calculateReviewQualityScore(
	drinkID string,
	tagsCount int,
	summaryLength int,
	photoCount int,
	confidence string,
	confirmedReports int,
) (float64, string) {
	switch s.versioning.QualityFormula {
	case QualityFormulaV1:
		return calculateReviewQualityV1(
			drinkID,
			tagsCount,
			summaryLength,
			photoCount,
			confidence,
			confirmedReports,
		), QualityFormulaV1
	case QualityFormulaV2:
		// quality_v2 is not implemented in this release; fallback is resolved
		// in versioning, but keep an explicit guard for defensive correctness.
		return calculateReviewQualityV1(
			drinkID,
			tagsCount,
			summaryLength,
			photoCount,
			confidence,
			confirmedReports,
		), QualityFormulaV1
	default:
		return calculateReviewQualityV1(
			drinkID,
			tagsCount,
			summaryLength,
			photoCount,
			confidence,
			confirmedReports,
		), QualityFormulaV1
	}
}
