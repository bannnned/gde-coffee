package feedback

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) Create(ctx context.Context, input CreateFeedbackInput) error {
	_, err := r.pool.Exec(
		ctx,
		`insert into public.app_feedback (user_id, message, contact, user_agent)
		 values ($1, $2, $3, $4)`,
		input.UserID,
		input.Message,
		input.Contact,
		input.UserAgent,
	)
	return err
}
