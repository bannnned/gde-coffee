package reviews

import (
	"context"
	"time"

	"backend/internal/auth"

	"github.com/jackc/pgx/v5"
)

type Service struct {
	repository    *Repository
	createLimiter *auth.RateLimiter
	updateLimiter *auth.RateLimiter
}

func NewService(repository *Repository) *Service {
	return &Service{
		repository:    repository,
		createLimiter: auth.NewRateLimiter(6, 10*time.Minute),
		updateLimiter: auth.NewRateLimiter(20, 10*time.Minute),
	}
}

type queryer interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}
