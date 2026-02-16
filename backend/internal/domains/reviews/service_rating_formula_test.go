package reviews

import (
	"testing"
	"time"
)

func TestBayesianMeanSmoothing(t *testing.T) {
	global := 4.0
	localMean := 5.0
	m := 20.0

	gotSmallSample := bayesianMean(localMean, 2, global, m)
	gotLargeSample := bayesianMean(localMean, 200, global, m)

	if gotSmallSample <= global || gotSmallSample >= localMean {
		t.Fatalf("small sample should be between global and local means, got=%f", gotSmallSample)
	}
	if gotLargeSample <= gotSmallSample {
		t.Fatalf("large sample should move closer to local mean, gotSmall=%f gotLarge=%f", gotSmallSample, gotLargeSample)
	}
}

func TestBestReviewCandidateOrdering(t *testing.T) {
	baseTime := time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC)
	current := bestReviewCandidate{
		ReviewID:      "a",
		HelpfulScore:  3.0,
		QualityScore:  70,
		VisitVerified: false,
		CreatedAt:     baseTime,
	}

	moreHelpful := current
	moreHelpful.ReviewID = "b"
	moreHelpful.HelpfulScore = 3.5
	if !isBetterBestReviewCandidate(moreHelpful, current) {
		t.Fatalf("expected candidate with higher helpful score to win")
	}

	sameHelpfulBetterQuality := current
	sameHelpfulBetterQuality.ReviewID = "c"
	sameHelpfulBetterQuality.QualityScore = 90
	if !isBetterBestReviewCandidate(sameHelpfulBetterQuality, current) {
		t.Fatalf("expected candidate with better quality to win when helpful score is equal")
	}

	sameHelpfulAndQualityVerified := current
	sameHelpfulAndQualityVerified.ReviewID = "d"
	sameHelpfulAndQualityVerified.QualityScore = current.QualityScore
	sameHelpfulAndQualityVerified.VisitVerified = true
	if !isBetterBestReviewCandidate(sameHelpfulAndQualityVerified, current) {
		t.Fatalf("expected verified candidate to win as next tiebreak")
	}

	newer := current
	newer.ReviewID = "e"
	newer.CreatedAt = baseTime.Add(2 * time.Hour)
	if !isBetterBestReviewCandidate(newer, current) {
		t.Fatalf("expected newer review to win when previous metrics are equal")
	}
}
