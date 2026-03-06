package taste

import "errors"

var (
	ErrTasteHypothesisNotFound = errors.New("taste hypothesis not found")
	ErrInferenceBusy           = errors.New("taste inference is already running for user")
	ErrInferenceUnavailable    = errors.New("taste inference repository is unavailable")
)

type validationError struct {
	message string
}

func (e *validationError) Error() string {
	return e.message
}

func errValidation(message string) error {
	return &validationError{message: message}
}
