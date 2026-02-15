package reviews

import "errors"

var (
	ErrIdempotencyConflict   = errors.New("idempotency key already used with different payload")
	ErrIdempotencyInProgress = errors.New("idempotent request in progress")
	ErrNotFound              = errors.New("not found")
	ErrForbidden             = errors.New("forbidden")
	ErrConflict              = errors.New("conflict")
)
