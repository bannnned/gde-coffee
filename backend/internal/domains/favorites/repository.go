package favorites

import (
	"context"
	"strings"

	"backend/internal/model"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) Add(ctx context.Context, userID, cafeID string) error {
	_, err := r.pool.Exec(
		ctx,
		`insert into user_favorite_cafes (user_id, cafe_id)
		 values ($1::uuid, $2::uuid)
		 on conflict (user_id, cafe_id) do nothing`,
		userID,
		cafeID,
	)
	return err
}

func (r *Repository) Remove(ctx context.Context, userID, cafeID string) error {
	_, err := r.pool.Exec(
		ctx,
		`delete from user_favorite_cafes where user_id = $1::uuid and cafe_id = $2::uuid`,
		userID,
		cafeID,
	)
	return err
}

func (r *Repository) List(ctx context.Context, userID string) ([]model.CafeResponse, error) {
	rows, err := r.pool.Query(
		ctx,
		`select c.id::text,
		        c.name,
		        c.address,
		        coalesce(c.description, '') as description,
		        c.lat,
		        c.lng,
		        coalesce(c.amenities, '{}'::text[]) as amenities
		   from user_favorite_cafes uf
		   join cafes c on c.id = uf.cafe_id
		  where uf.user_id = $1::uuid
		  order by uf.created_at desc`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.CafeResponse, 0, 32)
	for rows.Next() {
		var (
			item        model.CafeResponse
			description string
		)
		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Address,
			&description,
			&item.Latitude,
			&item.Longitude,
			&item.Amenities,
		); err != nil {
			return nil, err
		}
		description = strings.TrimSpace(description)
		if description != "" {
			item.Description = &description
		}
		item.DistanceM = 0
		item.IsFavorite = true
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repository) Pool() *pgxpool.Pool {
	return r.pool
}
