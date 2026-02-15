package cafes

import (
	"context"
	"strings"

	"backend/internal/config"
	"backend/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) QueryCafes(ctx context.Context, params ListParams, limits config.LimitsConfig) ([]model.CafeResponse, error) {
	dbLimit := params.Limit
	if dbLimit <= 0 {
		dbLimit = limits.DefaultResults
	}

	var amenitiesParam []string
	if len(params.RequiredAmenities) > 0 {
		amenitiesParam = params.RequiredAmenities
	}

	var userIDArg any
	if params.UserID != nil && strings.TrimSpace(*params.UserID) != "" {
		userIDArg = strings.TrimSpace(*params.UserID)
	}

	const sqlDistance = `WITH params AS (
  SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS p
)
SELECT
  id::text AS id,
  name,
  address,
  COALESCE(description, '') AS description,
  lat,
  lng,
  COALESCE(amenities, '{}'::text[]) AS amenities,
  ST_Distance(geog, params.p) AS distance_m,
  (fav.user_id is not null) as is_favorite
FROM public.cafes
CROSS JOIN params
LEFT JOIN public.user_favorite_cafes fav
  ON fav.cafe_id = cafes.id
 AND fav.user_id = $6::uuid
WHERE
  geog IS NOT NULL
  AND ($3 = 0 OR ST_DWithin(geog, params.p, $3))
  AND (
    $4::text[] IS NULL
    OR cardinality($4::text[]) = 0
    OR COALESCE(amenities, '{}'::text[]) @> $4::text[]
  )
  AND ($7::boolean = false OR fav.user_id IS NOT NULL)
ORDER BY distance_m ASC
LIMIT $5;`

	rows, err := r.pool.Query(
		ctx,
		sqlDistance,
		params.Latitude,
		params.Longitude,
		params.RadiusM,
		amenitiesParam,
		dbLimit,
		userIDArg,
		params.FavoritesOnly,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.CafeResponse, 0, 32)
	for rows.Next() {
		var (
			id      string
			name    string
			address string
			desc    string
			latDB   float64
			lngDB   float64
			ams     []string
			dist    float64
			isFav   bool
		)

		if err := rows.Scan(
			&id,
			&name,
			&address,
			&desc,
			&latDB,
			&lngDB,
			&ams,
			&dist,
			&isFav,
		); err != nil {
			return nil, err
		}

		var description *string
		desc = strings.TrimSpace(desc)
		if desc != "" {
			description = &desc
		}

		out = append(out, model.CafeResponse{
			ID:          id,
			Name:        name,
			Address:     address,
			Description: description,
			Latitude:    latDB,
			Longitude:   lngDB,
			Amenities:   ams,
			DistanceM:   dist,
			IsFavorite:  isFav,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if params.Limit > 0 && len(out) > params.Limit {
		out = out[:params.Limit]
	}

	return out, nil
}

func (r *Repository) UpdateDescription(ctx context.Context, cafeID, description string) (string, error) {
	var saved string
	err := r.pool.QueryRow(
		ctx,
		`update cafes
		    set description = $2
		  where id = $1::uuid
		  returning COALESCE(description, '')`,
		cafeID,
		description,
	).Scan(&saved)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(saved), nil
}

func (r *Repository) EnsureCafeExists(ctx context.Context, cafeID string) error {
	var exists bool
	if err := r.pool.QueryRow(ctx, `select exists(select 1 from cafes where id = $1::uuid)`, cafeID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return pgx.ErrNoRows
	}
	return nil
}
