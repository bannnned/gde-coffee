package reviews

import (
	"context"
	"errors"
	"log"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	sqlSelectHelpfulVoteAuthorAndWeight = `select r.user_id::text, hv.weight::float8
   from helpful_votes hv
   join reviews r on r.id = hv.review_id
  where hv.id = $1::uuid`

	sqlSelectVisitVerificationAuthorAndConfidence = `select r.user_id::text, vv.confidence
   from visit_verifications vv
   join reviews r on r.id = vv.review_id
  where vv.id = $1::uuid`

	sqlSelectAbuseReportAuthor = `select r.user_id::text
   from abuse_reports ar
   join reviews r on r.id = ar.review_id
  where ar.id = $1::uuid and ar.status = 'confirmed'`
)

func (s *Service) StartEventWorker(ctx context.Context, pollInterval time.Duration) {
	if pollInterval <= 0 {
		pollInterval = 2 * time.Second
	}

	log.Printf("reviews event worker started: interval=%s", pollInterval)
	for {
		select {
		case <-ctx.Done():
			log.Printf("reviews event worker stopped")
			return
		default:
		}

		evt, err := s.repository.ClaimNextEvent(ctx)
		if err != nil {
			log.Printf("reviews event worker claim error: %v", err)
			time.Sleep(pollInterval)
			continue
		}
		if evt == nil {
			time.Sleep(pollInterval)
			continue
		}

		handleErr := s.handleDomainEvent(ctx, *evt)
		if handleErr != nil {
			_ = s.repository.MarkEventFailed(ctx, evt.ID, evt.Attempts, handleErr.Error())
			continue
		}

		if err := s.repository.MarkEventProcessed(ctx, evt.ID); err != nil {
			log.Printf("reviews event worker mark processed error id=%d: %v", evt.ID, err)
		}
	}
}

func (s *Service) handleDomainEvent(ctx context.Context, evt domainEvent) error {
	switch evt.EventType {
	case EventReviewCreated, EventReviewUpdated:
		return s.recalculateCafeRatingSnapshot(ctx, evt.AggregateID)
	case EventHelpfulAdded:
		if err := s.applyHelpfulReputation(ctx, evt.Payload); err != nil {
			return err
		}
		return s.recalculateCafeRatingSnapshot(ctx, evt.AggregateID)
	case EventVisitVerified:
		if err := s.applyVisitReputation(ctx, evt.Payload); err != nil {
			return err
		}
		return s.recalculateCafeRatingSnapshot(ctx, evt.AggregateID)
	case EventAbuseConfirmed:
		if err := s.applyAbusePenalty(ctx, evt.Payload); err != nil {
			return err
		}
		return s.recalculateCafeRatingSnapshot(ctx, evt.AggregateID)
	case EventReviewPhotoProcessRequested:
		return s.processReviewPhotoUploadEvent(ctx, evt.Payload)
	default:
		return nil
	}
}

func (s *Service) applyHelpfulReputation(ctx context.Context, payload map[string]interface{}) error {
	voteID := payloadString(payload, "vote_id")
	if voteID == "" {
		return nil
	}

	var (
		reviewAuthorID string
		weight         float64
	)

	err := s.repository.Pool().QueryRow(
		ctx,
		sqlSelectHelpfulVoteAuthorAndWeight,
		voteID,
	).Scan(&reviewAuthorID, &weight)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}

	// Reputation v1: each helpful vote gives +2 points scaled by voter weight.
	points := int(math.Round(2.0 * weight))
	if points < 1 {
		points = 1
	}

	return s.repository.AddReputationEvent(
		ctx,
		reviewAuthorID,
		"helpful_received",
		points,
		"helpful_vote",
		voteID,
		map[string]interface{}{"weight": weight},
	)
}

func (s *Service) applyVisitReputation(ctx context.Context, payload map[string]interface{}) error {
	verificationID := payloadString(payload, "visit_verification_id")
	if verificationID == "" {
		return nil
	}

	var (
		reviewAuthorID string
		confidence     string
	)

	err := s.repository.Pool().QueryRow(
		ctx,
		sqlSelectVisitVerificationAuthorAndConfidence,
		verificationID,
	).Scan(&reviewAuthorID, &confidence)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}

	points := 0
	switch normalizeConfidence(confidence) {
	case "low":
		points = 1
	case "medium", "high":
		points = 3
	}
	if points == 0 {
		return nil
	}

	return s.repository.AddReputationEvent(
		ctx,
		reviewAuthorID,
		"visit_verified",
		points,
		"visit_verification",
		verificationID,
		nil,
	)
}

func (s *Service) applyAbusePenalty(ctx context.Context, payload map[string]interface{}) error {
	reportID := payloadString(payload, "abuse_report_id")
	if reportID == "" {
		return nil
	}

	var reviewAuthorID string
	err := s.repository.Pool().QueryRow(
		ctx,
		sqlSelectAbuseReportAuthor,
		reportID,
	).Scan(&reviewAuthorID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}

	return s.repository.AddReputationEvent(
		ctx,
		reviewAuthorID,
		"abuse_confirmed",
		-25,
		"abuse_report",
		reportID,
		nil,
	)
}
