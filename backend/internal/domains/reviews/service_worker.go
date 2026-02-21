package reviews

import (
	"context"
	"errors"
	"log"
	"math"
	"time"

	"backend/internal/reputation"

	"github.com/jackc/pgx/v5"
)

const (
	inboxConsumerCafeRating  = "rating.recalculate.v1"
	inboxConsumerReputation  = "reputation.projector.v1"
	inboxConsumerReviewPhoto = "review.photo.pipeline.v1"

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

	log.Printf("reviews outbox dispatch worker started: interval=%s", pollInterval)
	for {
		select {
		case <-ctx.Done():
			log.Printf("reviews outbox dispatch worker stopped")
			return
		default:
		}

		evt, err := s.repository.ClaimNextEvent(ctx)
		if err != nil {
			log.Printf("reviews outbox dispatch worker claim error: %v", err)
			time.Sleep(pollInterval)
			continue
		}
		if evt == nil {
			time.Sleep(pollInterval)
			continue
		}

		dispatchErr := s.dispatchOutboxEvent(ctx, *evt)
		if dispatchErr != nil {
			_ = s.repository.MarkEventFailed(ctx, evt.ID, evt.Attempts, dispatchErr.Error())
			continue
		}

		if err := s.repository.MarkEventProcessed(ctx, evt.ID); err != nil {
			log.Printf("reviews outbox dispatch worker mark processed error id=%d: %v", evt.ID, err)
		}
	}
}

func (s *Service) dispatchOutboxEvent(ctx context.Context, evt domainEvent) error {
	consumers := inboxConsumersForEvent(evt.EventType)
	if len(consumers) == 0 {
		return nil
	}

	// Outbox -> inbox fan-out is idempotent via UNIQUE(outbox_event_id, consumer).
	// This lets us retry dispatcher failures safely without duplicating consumer jobs.
	return s.repository.EnqueueInboxEvents(ctx, evt, consumers)
}

func (s *Service) StartInboxWorker(ctx context.Context, pollInterval time.Duration) {
	if pollInterval <= 0 {
		pollInterval = 2 * time.Second
	}

	log.Printf("reviews inbox worker started: interval=%s", pollInterval)
	for {
		select {
		case <-ctx.Done():
			log.Printf("reviews inbox worker stopped")
			return
		default:
		}

		evt, err := s.repository.ClaimNextInboxEvent(ctx)
		if err != nil {
			log.Printf("reviews inbox worker claim error: %v", err)
			time.Sleep(pollInterval)
			continue
		}
		if evt == nil {
			time.Sleep(pollInterval)
			continue
		}

		handleErr := s.handleInboxEvent(ctx, *evt)
		if handleErr != nil {
			deadLettered, markErr := s.repository.MarkInboxEventFailed(ctx, *evt, handleErr.Error())
			if markErr != nil {
				log.Printf("reviews inbox worker mark failed error id=%d: %v", evt.ID, markErr)
			} else if deadLettered {
				log.Printf(
					"reviews inbox worker moved to DLQ: inbox_id=%d outbox_id=%d consumer=%s event=%s attempts=%d",
					evt.ID,
					evt.OutboxEventID,
					evt.Consumer,
					evt.EventType,
					evt.Attempts,
				)
			}
			continue
		}

		if err := s.repository.MarkInboxEventProcessed(ctx, evt.ID); err != nil {
			log.Printf("reviews inbox worker mark processed error id=%d: %v", evt.ID, err)
		}
	}
}

func (s *Service) handleInboxEvent(ctx context.Context, evt domainInboxEvent) error {
	switch evt.Consumer {
	case inboxConsumerCafeRating:
		return s.recalculateCafeRatingSnapshot(ctx, evt.AggregateID)
	case inboxConsumerReputation:
		return s.applyReputationProjection(ctx, evt)
	case inboxConsumerReviewPhoto:
		return s.processReviewPhotoUploadEvent(ctx, evt.Payload)
	default:
		return nil
	}
}

func (s *Service) applyReputationProjection(ctx context.Context, evt domainInboxEvent) error {
	switch evt.EventType {
	case EventHelpfulAdded:
		return s.applyHelpfulReputation(ctx, evt.Payload)
	case EventVisitVerified:
		return s.applyVisitReputation(ctx, evt.Payload)
	case EventAbuseConfirmed:
		return s.applyAbusePenalty(ctx, evt.Payload)
	default:
		return nil
	}
}

func inboxConsumersForEvent(eventType string) []string {
	switch eventType {
	case EventReviewCreated, EventReviewUpdated:
		return []string{inboxConsumerCafeRating}
	case EventHelpfulAdded, EventVisitVerified, EventAbuseConfirmed:
		return []string{inboxConsumerCafeRating, inboxConsumerReputation}
	case EventReviewPhotoProcessRequested:
		return []string{inboxConsumerReviewPhoto}
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
	points := int(math.Round(reputation.PointsHelpfulBase * weight))
	if points < 1 {
		points = 1
	}

	return s.repository.AddReputationEvent(
		ctx,
		reviewAuthorID,
		reputation.EventHelpfulReceived,
		points,
		reputation.SourceHelpfulVote,
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
		points = reputation.PointsVisitLow
	case "medium":
		points = reputation.PointsVisitMedium
	case "high":
		points = reputation.PointsVisitHigh
	}
	if points == 0 {
		return nil
	}

	return s.repository.AddReputationEvent(
		ctx,
		reviewAuthorID,
		reputation.EventVisitVerified,
		points,
		reputation.SourceVisitVerification,
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
		reputation.EventAbuseConfirmed,
		reputation.PointsAbuseConfirmed,
		reputation.SourceAbuseReport,
		reportID,
		nil,
	)
}
