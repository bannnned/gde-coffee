package feedback

import (
	"context"
	"strings"

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

func (r *Repository) ListAdmin(
	ctx context.Context,
	query string,
	limit int,
	offset int,
) (AdminFeedbackList, error) {
	query = strings.TrimSpace(query)
	searchPattern := ""
	if query != "" {
		searchPattern = "%" + query + "%"
	}

	var total int
	if err := r.pool.QueryRow(
		ctx,
		`select count(*)
		   from public.app_feedback af
		   join public.users u on u.id = af.user_id
		  where
		    ($1 = '' or af.message ilike $2 or af.contact ilike $2 or coalesce(u.email_normalized, '') ilike $2 or coalesce(u.display_name, '') ilike $2)`,
		query,
		searchPattern,
	).Scan(&total); err != nil {
		return AdminFeedbackList{}, err
	}

	rows, err := r.pool.Query(
		ctx,
		`select
		    af.id,
		    af.user_id::text,
		    coalesce(u.email_normalized, ''),
		    coalesce(u.display_name, ''),
		    af.message,
		    af.contact,
		    af.user_agent,
		    af.created_at
		  from public.app_feedback af
		  join public.users u on u.id = af.user_id
		  where
		    ($1 = '' or af.message ilike $2 or af.contact ilike $2 or coalesce(u.email_normalized, '') ilike $2 or coalesce(u.display_name, '') ilike $2)
		  order by af.created_at desc, af.id desc
		  limit $3
		  offset $4`,
		query,
		searchPattern,
		limit,
		offset,
	)
	if err != nil {
		return AdminFeedbackList{}, err
	}
	defer rows.Close()

	items := make([]AdminFeedbackItem, 0, limit)
	for rows.Next() {
		var item AdminFeedbackItem
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.UserEmail,
			&item.UserDisplayName,
			&item.Message,
			&item.Contact,
			&item.UserAgent,
			&item.CreatedAt,
		); err != nil {
			return AdminFeedbackList{}, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return AdminFeedbackList{}, err
	}

	return AdminFeedbackList{
		Items: items,
		Total: total,
	}, nil
}
