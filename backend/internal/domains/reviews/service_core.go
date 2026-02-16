package reviews

import (
	"context"
	"time"

	"backend/internal/auth"
	"backend/internal/config"
	"backend/internal/media"

	"github.com/jackc/pgx/v5"
)

type Service struct {
	repository    *Repository
	createLimiter *auth.RateLimiter
	updateLimiter *auth.RateLimiter
	mediaService  *media.Service
	mediaCfg      config.MediaConfig
}

func NewService(repository *Repository) *Service {
	return &Service{
		repository:    repository,
		createLimiter: auth.NewRateLimiter(6, 10*time.Minute),
		updateLimiter: auth.NewRateLimiter(20, 10*time.Minute),
	}
}

func (s *Service) SetMedia(service *media.Service, cfg config.MediaConfig) {
	if s == nil {
		return
	}
	s.mediaService = service
	s.mediaCfg = cfg
}

type queryer interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}
