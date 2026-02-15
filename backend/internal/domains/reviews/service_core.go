package reviews

import (
	"context"

	"github.com/jackc/pgx/v5"
)

type Service struct {
	repository *Repository
}

func NewService(repository *Repository) *Service {
	return &Service{repository: repository}
}

type queryer interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}
