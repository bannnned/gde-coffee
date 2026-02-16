package reviews

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"net/netip"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	checkInRadiusMeters            = 150.0
	checkInMinDwellSeconds         = 5 * 60
	checkInHighConfidenceSeconds   = 10 * 60
	checkInMediumConfidenceSeconds = 7 * 60
	checkInCrossCafeCooldown       = 5 * time.Minute
	checkInImpossibleSpeedKmh      = 220.0
	checkInMaxRecentDaily          = 12
)

const (
	sqlSelectCafeCoordinates = `select lat::float8, lng::float8
from cafes
where id = $1::uuid`

	sqlSelectLatestCheckInByUser = `select
	id::text,
	cafe_id::text,
	start_lat,
	start_lng,
	started_at
from review_checkins
where user_id = $1::uuid
  and status in ('started', 'verified')
order by started_at desc
limit 1`

	sqlSelectActiveCheckInByUserCafe = `select
	id::text,
	started_at,
	start_distance_m
from review_checkins
where user_id = $1::uuid
  and cafe_id = $2::uuid
  and status = 'started'
order by started_at desc
limit 1`

	sqlInsertCheckIn = `insert into review_checkins (
	user_id,
	cafe_id,
	status,
	start_lat,
	start_lng,
	start_distance_m,
	user_agent_hash,
	ip_prefix
)
values ($1::uuid, $2::uuid, 'started', $3, $4, $5, $6, $7)
returning
	id::text,
	started_at`

	sqlSelectCheckInByIDForUpdate = `select
	id::text,
	user_id::text,
	cafe_id::text,
	status,
	started_at,
	start_lat,
	start_lng,
	start_distance_m,
	coalesce(user_agent_hash, ''),
	coalesce(ip_prefix, '')
from review_checkins
where id = $1::uuid
for update`

	sqlSelectLatestCheckInForUserCafeForUpdate = `select
	id::text,
	user_id::text,
	cafe_id::text,
	status,
	started_at,
	start_lat,
	start_lng,
	start_distance_m,
	coalesce(user_agent_hash, ''),
	coalesce(ip_prefix, '')
from review_checkins
where user_id = $1::uuid
  and cafe_id = $2::uuid
  and status = 'started'
order by started_at desc
limit 1
for update`

	sqlUpdateCheckInAsVerified = `update review_checkins
set status = 'verified',
    verified_at = now(),
    verified_review_id = $2::uuid,
    verify_lat = $3,
    verify_lng = $4,
    verify_distance_m = $5,
    dwell_seconds = $6,
    confidence = $7,
    risk_flags = $8::text[],
    updated_at = now()
where id = $1::uuid`

	sqlSelectUserCreatedAt = `select created_at
from users
where id = $1::uuid`

	sqlCountRecentCheckInsByUser = `select count(*)
from review_checkins
where user_id = $1::uuid
  and started_at >= now() - interval '24 hours'`
)

type RequestSignals struct {
	UserAgent string
	ClientIP  string
	UserRole  string
}

type checkInState struct {
	ID             string
	UserID         string
	CafeID         string
	Status         string
	StartedAt      time.Time
	StartLat       float64
	StartLng       float64
	StartDistanceM int
	UserAgentHash  string
	IPPrefix       string
}

func (s *Service) StartCheckIn(
	ctx context.Context,
	userID string,
	cafeID string,
	idempotencyKey string,
	req StartCheckInRequest,
	signals RequestSignals,
) (idempotentResult, error) {
	isAdminBypass := isAdminRole(signals.UserRole)
	hash := requestHash(struct {
		UserID string  `json:"user_id"`
		CafeID string  `json:"cafe_id"`
		Lat    float64 `json:"lat"`
		Lng    float64 `json:"lng"`
	}{UserID: userID, CafeID: cafeID, Lat: req.Lat, Lng: req.Lng})
	scope := IdempotencyScopeCheckInStart + ":" + userID

	return s.repository.RunIdempotent(ctx, scope, idempotencyKey, hash, func(tx pgx.Tx) (int, map[string]interface{}, error) {
		cafeLat, cafeLng, err := s.lookupCafeCoordinatesTx(ctx, tx, cafeID)
		if err != nil {
			return 0, nil, err
		}

		distanceMeters := haversineMeters(req.Lat, req.Lng, cafeLat, cafeLng)
		if !isAdminBypass && distanceMeters > checkInRadiusMeters {
			return 0, nil, ErrCheckInTooFar
		}

		active, hasActive, err := s.lookupActiveCheckInByCafeTx(ctx, tx, userID, cafeID)
		if err != nil {
			return 0, nil, err
		}
		if hasActive {
			response := map[string]interface{}{
				"checkin_id":          active.ID,
				"cafe_id":             cafeID,
				"status":              "started",
				"distance_meters":     active.StartDistanceM,
				"min_dwell_seconds":   checkInMinDwellSeconds,
				"can_verify_after":    active.StartedAt.Add(time.Duration(checkInMinDwellSeconds) * time.Second).UTC().Format(time.RFC3339),
				"cross_cafe_cooldown": int(checkInCrossCafeCooldown.Seconds()),
			}
			return 200, response, nil
		}

		latest, hasLatest, err := s.lookupLatestCheckInTx(ctx, tx, userID)
		if err != nil {
			return 0, nil, err
		}
		if hasLatest && latest.CafeID != cafeID {
			if !isAdminBypass && time.Since(latest.StartedAt) < checkInCrossCafeCooldown {
				return 0, nil, ErrCheckInCooldown
			}
			if !isAdminBypass && isImpossibleTravel(latest.StartLat, latest.StartLng, req.Lat, req.Lng, latest.StartedAt, time.Now().UTC()) {
				return 0, nil, ErrCheckInSuspicious
			}
		}

		uaHash := shortHash(strings.TrimSpace(signals.UserAgent))
		ipPrefix := normalizeIPPrefix(signals.ClientIP)
		var (
			checkInID string
			startedAt time.Time
		)
		if err := tx.QueryRow(
			ctx,
			sqlInsertCheckIn,
			userID,
			cafeID,
			req.Lat,
			req.Lng,
			int(math.Round(distanceMeters)),
			uaHash,
			ipPrefix,
		).Scan(&checkInID, &startedAt); err != nil {
			return 0, nil, err
		}

		response := map[string]interface{}{
			"checkin_id":          checkInID,
			"cafe_id":             cafeID,
			"status":              "started",
			"distance_meters":     int(math.Round(distanceMeters)),
			"min_dwell_seconds":   checkInMinDwellSeconds,
			"can_verify_after":    startedAt.Add(time.Duration(checkInMinDwellSeconds) * time.Second).UTC().Format(time.RFC3339),
			"cross_cafe_cooldown": int(checkInCrossCafeCooldown.Seconds()),
		}
		return 200, response, nil
	})
}

func (s *Service) lookupCafeCoordinatesTx(ctx context.Context, tx pgx.Tx, cafeID string) (float64, float64, error) {
	var lat, lng float64
	if err := tx.QueryRow(ctx, sqlSelectCafeCoordinates, cafeID).Scan(&lat, &lng); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, 0, ErrNotFound
		}
		return 0, 0, err
	}
	return lat, lng, nil
}

func (s *Service) lookupLatestCheckInTx(ctx context.Context, tx pgx.Tx, userID string) (checkInState, bool, error) {
	var item checkInState
	err := tx.QueryRow(ctx, sqlSelectLatestCheckInByUser, userID).Scan(
		&item.ID,
		&item.CafeID,
		&item.StartLat,
		&item.StartLng,
		&item.StartedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return checkInState{}, false, nil
	}
	if err != nil {
		return checkInState{}, false, err
	}
	return item, true, nil
}

func (s *Service) lookupActiveCheckInByCafeTx(ctx context.Context, tx pgx.Tx, userID, cafeID string) (checkInState, bool, error) {
	var item checkInState
	err := tx.QueryRow(ctx, sqlSelectActiveCheckInByUserCafe, userID, cafeID).Scan(
		&item.ID,
		&item.StartedAt,
		&item.StartDistanceM,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return checkInState{}, false, nil
	}
	if err != nil {
		return checkInState{}, false, err
	}
	return item, true, nil
}

func isImpossibleTravel(latA, lngA, latB, lngB float64, from, to time.Time) bool {
	elapsedSec := to.Sub(from).Seconds()
	if elapsedSec <= 0 {
		return false
	}
	distanceMeters := haversineMeters(latA, lngA, latB, lngB)
	speedKmh := (distanceMeters / elapsedSec) * 3.6
	// If implied speed is unrealistically high, treat as fake location hop.
	return speedKmh > checkInImpossibleSpeedKmh
}

func shortHash(value string) string {
	if strings.TrimSpace(value) == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(strings.TrimSpace(value)))
	return hex.EncodeToString(sum[:8])
}

func normalizeIPPrefix(value string) string {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return ""
	}
	addr, err := netip.ParseAddr(raw)
	if err != nil {
		return ""
	}
	if addr.Is4() {
		bytes := addr.As4()
		return fmt.Sprintf("%d.%d.%d", bytes[0], bytes[1], bytes[2])
	}
	// IPv6 prefix is coarse on purpose: enough for consistency signal, not fingerprinting.
	prefix, err := addr.Prefix(64)
	if err != nil {
		return ""
	}
	return prefix.Masked().String()
}

func haversineMeters(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadius = 6371000.0
	rad := func(v float64) float64 { return v * math.Pi / 180.0 }
	dLat := rad(lat2 - lat1)
	dLng := rad(lng2 - lng1)
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(rad(lat1))*math.Cos(rad(lat2))*math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadius * c
}

func isAdminRole(role string) bool {
	return strings.EqualFold(strings.TrimSpace(role), "admin")
}
