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

type userTasteSignal struct {
	TasteCode  string
	Polarity   string
	Score      float64
	Confidence float64
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

func (r *Repository) ListUserActiveTasteSignals(
	ctx context.Context,
	userID string,
	limit int,
) ([]userTasteSignal, error) {
	if strings.TrimSpace(userID) == "" {
		return []userTasteSignal{}, nil
	}
	if limit <= 0 {
		limit = 12
	}

	const query = `select
	taste_code,
	polarity,
	score::double precision,
	confidence::double precision
from public.user_taste_tags
where user_id = $1::uuid
  and status = 'active'
  and confidence > 0::numeric
order by abs(score::double precision) * confidence::double precision desc, updated_at desc
limit $2::int`

	rows, err := r.pool.Query(ctx, query, strings.TrimSpace(userID), limit)
	if err != nil {
		if err == pgx.ErrNoRows {
			return []userTasteSignal{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	result := make([]userTasteSignal, 0, limit)
	for rows.Next() {
		var row userTasteSignal
		if err := rows.Scan(&row.TasteCode, &row.Polarity, &row.Score, &row.Confidence); err != nil {
			return nil, err
		}
		row.TasteCode = strings.TrimSpace(strings.ToLower(row.TasteCode))
		row.Polarity = strings.TrimSpace(strings.ToLower(row.Polarity))
		if row.TasteCode == "" || row.Polarity == "" {
			continue
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) ListCafeTasteTokens(
	ctx context.Context,
	cafeIDs []string,
) (map[string][]string, error) {
	result := make(map[string][]string, len(cafeIDs))
	if len(cafeIDs) == 0 {
		return result, nil
	}

	const query = `select
	c.id::text,
	coalesce(array_remove(array_agg(distinct lower(trim(coalesce(t.tag->>'key', '')))), ''), '{}'::text[]) as tag_keys,
	coalesce(array_remove(array_agg(distinct lower(trim(coalesce(t.tag->>'label', '')))), ''), '{}'::text[]) as tag_labels
from public.cafes c
left join public.cafe_rating_snapshots crs on crs.cafe_id = c.id
left join lateral (
	select tag
	from jsonb_array_elements(coalesce(crs.components->'specific_tags', '[]'::jsonb)) as tag
	union all
	select tag
	from jsonb_array_elements(coalesce(crs.components->'descriptive_tags', '[]'::jsonb)) as tag
) t on true
where c.id = any($1::uuid[])
group by c.id`

	rows, err := r.pool.Query(ctx, query, cafeIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			cafeID string
			keys   []string
			labels []string
		)
		if err := rows.Scan(&cafeID, &keys, &labels); err != nil {
			return nil, err
		}
		merged := make([]string, 0, len(keys)+len(labels))
		for _, raw := range keys {
			token := normalizeTasteToken(raw)
			if token == "" {
				continue
			}
			merged = append(merged, token)
		}
		for _, raw := range labels {
			token := normalizeTasteToken(raw)
			if token == "" {
				continue
			}
			merged = append(merged, token)
		}
		result[strings.TrimSpace(cafeID)] = dedupeTasteTokens(merged)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
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

func (r *Repository) FindCafeByNameAddress(ctx context.Context, name, address string) (string, bool, error) {
	var cafeID string
	err := r.pool.QueryRow(
		ctx,
		`select id::text
		   from cafes
		  where lower(trim(name)) = lower(trim($1::text))
		    and lower(trim(coalesce(address, ''))) = lower(trim($2::text))
		  order by created_at asc
		  limit 1`,
		name,
		address,
	).Scan(&cafeID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", false, nil
		}
		return "", false, err
	}
	return strings.TrimSpace(cafeID), true, nil
}

func (r *Repository) InsertCafe(ctx context.Context, item normalizedCafeImportItem) (string, error) {
	amenities := item.Amenities
	if amenities == nil {
		amenities = []string{}
	}

	var cafeID string
	err := r.pool.QueryRow(
		ctx,
		`insert into cafes (name, address, description, lat, lng, amenities, geog)
		 values (
		   $1::text,
		   $2::text,
		   nullif($3::text, ''),
		   $4::double precision,
		   $5::double precision,
		   $6::text[],
		   ST_SetSRID(ST_MakePoint($5::double precision, $4::double precision), 4326)::geography
		 )
		 returning id::text`,
		item.Name,
		item.Address,
		item.Description,
		item.Latitude,
		item.Longitude,
		amenities,
	).Scan(&cafeID)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(cafeID), nil
}

func (r *Repository) UpdateCafeByID(ctx context.Context, cafeID string, item normalizedCafeImportItem) error {
	amenities := item.Amenities
	if amenities == nil {
		amenities = []string{}
	}

	result, err := r.pool.Exec(
		ctx,
		`update cafes
		    set name = $2::text,
		        address = $3::text,
		        lat = $4::double precision,
		        lng = $5::double precision,
		        geog = ST_SetSRID(ST_MakePoint($5::double precision, $4::double precision), 4326)::geography,
		        description = case when $6::boolean then nullif($7::text, '') else description end,
		        amenities = case when $8::boolean then $9::text[] else amenities end
		  where id = $1::uuid`,
		cafeID,
		item.Name,
		item.Address,
		item.Latitude,
		item.Longitude,
		item.HasDescription,
		item.Description,
		item.HasAmenitiesRaw,
		amenities,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *Repository) SearchAdminCafesByName(ctx context.Context, query string, limit int) ([]AdminCafeSearchItem, error) {
	pattern := "%" + strings.TrimSpace(query) + "%"
	rows, err := r.pool.Query(
		ctx,
		`select
		    id::text,
		    name,
		    coalesce(address, '') as address
		  from public.cafes
		  where name ilike $1
		  order by
		    case
		      when lower(name) = lower($2) then 0
		      when lower(name) like lower($2) || '%' then 1
		      else 2
		    end asc,
		    created_at desc
		  limit $3`,
		pattern,
		strings.TrimSpace(query),
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]AdminCafeSearchItem, 0, limit)
	for rows.Next() {
		var item AdminCafeSearchItem
		if err := rows.Scan(&item.ID, &item.Name, &item.Address); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) GetAdminCafeByID(ctx context.Context, cafeID string) (AdminCafeDetails, error) {
	var item AdminCafeDetails
	err := r.pool.QueryRow(
		ctx,
		`select
		    id::text,
		    name,
		    coalesce(address, '') as address,
		    coalesce(description, '') as description,
		    lat,
		    lng,
		    coalesce(amenities, '{}'::text[]) as amenities
		   from public.cafes
		  where id = $1::uuid`,
		cafeID,
	).Scan(
		&item.ID,
		&item.Name,
		&item.Address,
		&item.Description,
		&item.Latitude,
		&item.Longitude,
		&item.Amenities,
	)
	if err != nil {
		return AdminCafeDetails{}, err
	}
	item.ID = strings.TrimSpace(item.ID)
	item.Name = strings.TrimSpace(item.Name)
	item.Address = strings.TrimSpace(item.Address)
	item.Description = strings.TrimSpace(item.Description)
	if item.Amenities == nil {
		item.Amenities = []string{}
	}
	return item, nil
}

func (r *Repository) DeleteCafeByID(ctx context.Context, cafeID string) error {
	result, err := r.pool.Exec(ctx, `delete from public.cafes where id = $1::uuid`, cafeID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
