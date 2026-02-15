package favorites

import (
	"context"

	"backend/internal/config"
	"backend/internal/domains/photos"
	"backend/internal/model"
)

type Service struct {
	repository *Repository
	mediaCfg   config.MediaConfig
}

func NewService(repository *Repository, mediaCfg config.MediaConfig) *Service {
	return &Service{repository: repository, mediaCfg: mediaCfg}
}

func (s *Service) Add(ctx context.Context, userID, cafeID string) error {
	return s.repository.Add(ctx, userID, cafeID)
}

func (s *Service) Remove(ctx context.Context, userID, cafeID string) error {
	return s.repository.Remove(ctx, userID, cafeID)
}

func (s *Service) List(ctx context.Context, userID string) ([]model.CafeResponse, error) {
	items, err := s.repository.List(ctx, userID)
	if err != nil {
		return nil, err
	}
	if err := photos.AttachCafeCoverPhotos(ctx, s.repository.Pool(), items, s.mediaCfg); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) EnsureCafeExists(ctx context.Context, cafeID string) error {
	return photos.EnsureCafeExists(ctx, s.repository.Pool(), cafeID)
}
