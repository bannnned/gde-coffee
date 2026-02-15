package photos

import (
	"backend/internal/config"
	"backend/internal/media"
)

type Service struct {
	repository *Repository
	s3         *media.Service
	cfg        config.MediaConfig
}

func NewService(repository *Repository, s3 *media.Service, cfg config.MediaConfig) *Service {
	return &Service{repository: repository, s3: s3, cfg: cfg}
}

func (s *Service) Repository() *Repository {
	return s.repository
}

func (s *Service) S3() *media.Service {
	return s.s3
}

func (s *Service) Config() config.MediaConfig {
	return s.cfg
}
