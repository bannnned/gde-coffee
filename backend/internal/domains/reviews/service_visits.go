package reviews

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const sqlUpsertVisitVerification = `insert into visit_verifications (review_id, user_id, cafe_id, confidence, verified_at, dwell_seconds)
 values (
	$1::uuid,
	$2::uuid,
	$3::uuid,
	$4,
	case when $4 = 'none' then null else now() end,
	$5
 )
 on conflict (review_id)
 do update set confidence = excluded.confidence,
               verified_at = case
								when excluded.confidence = 'none' then null
								else coalesce(visit_verifications.verified_at, now())
							  end,
               dwell_seconds = greatest(visit_verifications.dwell_seconds, excluded.dwell_seconds),
               updated_at = now()
 returning id::text`

func (s *Service) VerifyVisit(
	ctx context.Context,
	userID string,
	reviewID string,
	idempotencyKey string,
	req VerifyVisitRequest,
	signals RequestSignals,
) (idempotentResult, error) {
	if req.Lat != nil || req.Lng != nil || strings.TrimSpace(req.CheckInID) != "" {
		return s.verifyVisitByCheckIn(ctx, userID, reviewID, idempotencyKey, req, signals)
	}
	return s.verifyVisitLegacy(ctx, userID, reviewID, idempotencyKey, req)
}

func (s *Service) verifyVisitByCheckIn(
	ctx context.Context,
	userID string,
	reviewID string,
	idempotencyKey string,
	req VerifyVisitRequest,
	signals RequestSignals,
) (idempotentResult, error) {
	checkInID := strings.TrimSpace(req.CheckInID)
	lat, lng, hasCoords := extractVisitCoordinates(req)
	isAdminBypass := isAdminRole(signals.UserRole)

	hash := requestHash(struct {
		UserID   string  `json:"user_id"`
		ReviewID string  `json:"review_id"`
		CheckIn  string  `json:"checkin_id"`
		Lat      float64 `json:"lat"`
		Lng      float64 `json:"lng"`
	}{UserID: userID, ReviewID: reviewID, CheckIn: checkInID, Lat: lat, Lng: lng})
	scope := IdempotencyScopeCheckIn + ":" + userID

	return s.repository.RunIdempotent(ctx, scope, idempotencyKey, hash, func(tx pgx.Tx) (int, map[string]interface{}, error) {
		var reviewAuthorID, cafeID string
		err := tx.QueryRow(
			ctx,
			sqlSelectPublishedReviewAuthorAndCafe,
			reviewID,
		).Scan(&reviewAuthorID, &cafeID)
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil, ErrNotFound
		}
		if err != nil {
			return 0, nil, err
		}
		if reviewAuthorID != userID {
			return 0, nil, ErrForbidden
		}

		checkIn, err := s.loadCheckInForVerificationTx(ctx, tx, userID, cafeID, checkInID)
		if err != nil {
			return 0, nil, err
		}

		cafeLat, cafeLng, err := s.lookupCafeCoordinatesTx(ctx, tx, cafeID)
		if err != nil {
			return 0, nil, err
		}

		if !hasCoords {
			lat = checkIn.StartLat
			lng = checkIn.StartLng
		}
		verifyDistance := int(math.Round(haversineMeters(lat, lng, cafeLat, cafeLng)))
		if !isAdminBypass && float64(verifyDistance) > checkInRadiusMeters {
			return 0, nil, ErrCheckInTooFar
		}

		dwellSeconds := int(time.Since(checkIn.StartedAt).Seconds())
		if !isAdminBypass && dwellSeconds < checkInMinDwellSeconds {
			return 0, nil, ErrCheckInTooEarly
		}

		riskFlags, err := s.collectCheckInRiskFlagsTx(ctx, tx, userID, checkIn, signals)
		if err != nil {
			return 0, nil, err
		}
		confidence := deriveCheckInConfidence(dwellSeconds, maxInt(checkIn.StartDistanceM, verifyDistance), riskFlags)

		var verificationID string
		err = tx.QueryRow(
			ctx,
			sqlUpsertVisitVerification,
			reviewID,
			userID,
			cafeID,
			confidence,
			dwellSeconds,
		).Scan(&verificationID)
		if err != nil {
			return 0, nil, err
		}

		if _, err := tx.Exec(
			ctx,
			sqlUpdateCheckInAsVerified,
			checkIn.ID,
			reviewID,
			lat,
			lng,
			verifyDistance,
			dwellSeconds,
			confidence,
			riskFlags,
		); err != nil {
			return 0, nil, err
		}

		if confidence != "none" {
			payload := map[string]interface{}{
				"visit_verification_id": verificationID,
				"review_id":             reviewID,
				"cafe_id":               cafeID,
			}
			dedupeKey := fmt.Sprintf("%s:%s:%s", scope, idempotencyKey, EventVisitVerified)
			if err := s.repository.EnqueueEventTx(ctx, tx, EventVisitVerified, cafeID, dedupeKey, payload); err != nil {
				return 0, nil, err
			}
		}

		response := map[string]interface{}{
			"verification_id": verificationID,
			"review_id":       reviewID,
			"confidence":      confidence,
			"checkin_id":      checkIn.ID,
			"dwell_seconds":   dwellSeconds,
		}
		return 200, response, nil
	})
}

func (s *Service) verifyVisitLegacy(
	ctx context.Context,
	userID string,
	reviewID string,
	idempotencyKey string,
	req VerifyVisitRequest,
) (idempotentResult, error) {
	confidence := normalizeConfidence(req.Confidence)
	dwellSeconds := req.DwellSeconds
	if dwellSeconds < 0 {
		dwellSeconds = 0
	}

	hash := requestHash(struct {
		UserID      string `json:"user_id"`
		ReviewID    string `json:"review_id"`
		Confidence  string `json:"confidence"`
		DwellSecond int    `json:"dwell_seconds"`
	}{UserID: userID, ReviewID: reviewID, Confidence: confidence, DwellSecond: dwellSeconds})
	scope := IdempotencyScopeCheckIn + ":" + userID

	return s.repository.RunIdempotent(ctx, scope, idempotencyKey, hash, func(tx pgx.Tx) (int, map[string]interface{}, error) {
		var reviewAuthorID, cafeID string
		err := tx.QueryRow(
			ctx,
			sqlSelectPublishedReviewAuthorAndCafe,
			reviewID,
		).Scan(&reviewAuthorID, &cafeID)
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil, ErrNotFound
		}
		if err != nil {
			return 0, nil, err
		}

		if reviewAuthorID != userID {
			return 0, nil, ErrForbidden
		}

		var verificationID string
		err = tx.QueryRow(
			ctx,
			sqlUpsertVisitVerification,
			reviewID,
			userID,
			cafeID,
			confidence,
			dwellSeconds,
		).Scan(&verificationID)
		if err != nil {
			return 0, nil, err
		}

		if confidence != "none" {
			payload := map[string]interface{}{
				"visit_verification_id": verificationID,
				"review_id":             reviewID,
				"cafe_id":               cafeID,
			}
			dedupeKey := fmt.Sprintf("%s:%s:%s", scope, idempotencyKey, EventVisitVerified)
			if err := s.repository.EnqueueEventTx(ctx, tx, EventVisitVerified, cafeID, dedupeKey, payload); err != nil {
				return 0, nil, err
			}
		}

		response := map[string]interface{}{
			"verification_id": verificationID,
			"review_id":       reviewID,
			"confidence":      confidence,
		}
		return 200, response, nil
	})
}

func extractVisitCoordinates(req VerifyVisitRequest) (float64, float64, bool) {
	if req.Lat == nil || req.Lng == nil {
		return 0, 0, false
	}
	return *req.Lat, *req.Lng, true
}

func (s *Service) loadCheckInForVerificationTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
	cafeID string,
	checkInID string,
) (checkInState, error) {
	var item checkInState
	var row pgx.Row
	if strings.TrimSpace(checkInID) != "" {
		row = tx.QueryRow(ctx, sqlSelectCheckInByIDForUpdate, checkInID)
	} else {
		row = tx.QueryRow(ctx, sqlSelectLatestCheckInForUserCafeForUpdate, userID, cafeID)
	}
	err := row.Scan(
		&item.ID,
		&item.UserID,
		&item.CafeID,
		&item.Status,
		&item.StartedAt,
		&item.StartLat,
		&item.StartLng,
		&item.StartDistanceM,
		&item.UserAgentHash,
		&item.IPPrefix,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return item, ErrNotFound
	}
	if err != nil {
		return item, err
	}
	if item.UserID != userID {
		return item, ErrForbidden
	}
	if item.CafeID != cafeID {
		return item, ErrConflict
	}
	if item.Status != "started" && item.Status != "verified" {
		return item, ErrConflict
	}
	return item, nil
}

func (s *Service) collectCheckInRiskFlagsTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
	checkIn checkInState,
	signals RequestSignals,
) ([]string, error) {
	flags := make([]string, 0, 4)
	currentUA := shortHash(signals.UserAgent)
	currentIP := normalizeIPPrefix(signals.ClientIP)
	if checkIn.UserAgentHash != "" && currentUA != "" && checkIn.UserAgentHash != currentUA {
		flags = append(flags, "ua_mismatch")
	}
	if checkIn.IPPrefix != "" && currentIP != "" && checkIn.IPPrefix != currentIP {
		flags = append(flags, "ip_mismatch")
	}

	var userCreatedAt time.Time
	if err := tx.QueryRow(ctx, sqlSelectUserCreatedAt, userID).Scan(&userCreatedAt); err == nil {
		if time.Since(userCreatedAt) < 24*time.Hour {
			flags = append(flags, "new_account")
		}
	}

	var recentCount int
	if err := tx.QueryRow(ctx, sqlCountRecentCheckInsByUser, userID).Scan(&recentCount); err != nil {
		return nil, err
	}
	if recentCount > checkInMaxRecentDaily {
		flags = append(flags, "high_activity")
	}
	return flags, nil
}

func deriveCheckInConfidence(dwellSeconds int, maxDistanceMeters int, riskFlags []string) string {
	confidence := "low"

	// Base confidence uses measurable signals: dwell time + geo distance.
	if dwellSeconds >= checkInHighConfidenceSeconds && maxDistanceMeters <= 100 {
		confidence = "high"
	} else if dwellSeconds >= checkInMediumConfidenceSeconds && maxDistanceMeters <= int(checkInRadiusMeters) {
		confidence = "medium"
	}

	// Risk flags can only reduce trust level, never increase it.
	if containsRiskFlag(riskFlags, "ua_mismatch") || containsRiskFlag(riskFlags, "ip_mismatch") {
		confidence = minConfidence(confidence, "medium")
	}
	if containsRiskFlag(riskFlags, "new_account") || containsRiskFlag(riskFlags, "high_activity") {
		confidence = minConfidence(confidence, "low")
	}
	return confidence
}

func containsRiskFlag(flags []string, value string) bool {
	target := strings.TrimSpace(value)
	for _, item := range flags {
		if strings.TrimSpace(item) == target {
			return true
		}
	}
	return false
}

func minConfidence(a, b string) string {
	rank := func(value string) int {
		switch normalizeConfidence(value) {
		case "high":
			return 3
		case "medium":
			return 2
		case "low":
			return 1
		default:
			return 0
		}
	}
	if rank(a) <= rank(b) {
		return normalizeConfidence(a)
	}
	return normalizeConfidence(b)
}
