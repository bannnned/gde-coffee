package taste

import "errors"

var (
	ErrTasteHypothesisNotFound = errors.New("taste hypothesis not found")
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
