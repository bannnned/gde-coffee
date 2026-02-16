package reviews

import "errors"

var (
	ErrIdempotencyConflict   = errors.New("idempotency key already used with different payload")
	ErrIdempotencyInProgress = errors.New("idempotent request in progress")
	ErrNotFound              = errors.New("not found")
	ErrForbidden             = errors.New("forbidden")
	ErrConflict              = errors.New("conflict")
	ErrAlreadyExists         = errors.New("already exists")
	ErrRateLimited           = errors.New("rate limited")
	ErrSpamDetected          = errors.New("spam detected")
	ErrDuplicateContent      = errors.New("duplicate content")
	ErrInvalidDrink          = errors.New("invalid drink")
	ErrCheckInTooFar         = errors.New("check-in is outside radius")
	ErrCheckInTooEarly       = errors.New("check-in dwell is too short")
	ErrCheckInCooldown       = errors.New("check-in cooldown is active")
	ErrCheckInSuspicious     = errors.New("check-in looks suspicious")
)
