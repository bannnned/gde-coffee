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
)
