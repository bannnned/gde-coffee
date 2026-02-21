package tags

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) ListPopularDescriptiveTags(
	ctx context.Context,
	scope GeoScope,
	limit int,
) ([]popularTagRow, error) {
	const query = `with center as (
	select ST_SetSRID(ST_MakePoint($2::double precision, $1::double precision), 4326)::geography as p
), tags as (
	select
		lower(trim(tag->>'label')) as tag_key,
		trim(tag->>'label') as tag_label,
		case
			when jsonb_typeof(tag->'score') = 'number' then (tag->>'score')::double precision
			else 0::double precision
		end as tag_score
	from public.cafes c
	join public.cafe_rating_snapshots crs on crs.cafe_id = c.id
	cross join center
	cross join lateral jsonb_array_elements(coalesce(crs.components->'descriptive_tags', '[]'::jsonb)) as tag
	where c.geog is not null
	  and ($3::double precision <= 0 OR ST_DWithin(c.geog, center.p, $3::double precision))
	  and trim(coalesce(tag->>'label', '')) <> ''
)
select
	tag_key,
	min(tag_label) as tag_label,
	count(*)::int as cafes_count,
	coalesce(avg(tag_score), 0)::double precision as avg_weight
from tags
group by tag_key
order by cafes_count desc, avg_weight desc, tag_key asc
limit $4::int`

	rows, err := r.pool.Query(ctx, query, scope.Latitude, scope.Longitude, scope.RadiusM, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]popularTagRow, 0, limit)
	for rows.Next() {
		var row popularTagRow
		if err := rows.Scan(&row.Key, &row.Label, &row.Cafes, &row.AvgWeight); err != nil {
			return nil, err
		}
		row.Key = strings.TrimSpace(strings.ToLower(row.Key))
		row.Label = strings.TrimSpace(row.Label)
		if row.Key == "" || row.Label == "" {
			continue
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) ListDescriptiveTagOptions(
	ctx context.Context,
	scope GeoScope,
	search string,
	limit int,
) ([]string, error) {
	const query = `with center as (
	select ST_SetSRID(ST_MakePoint($2::double precision, $1::double precision), 4326)::geography as p
), tags as (
	select
		lower(trim(tag->>'label')) as tag_key,
		trim(tag->>'label') as tag_label
	from public.cafes c
	join public.cafe_rating_snapshots crs on crs.cafe_id = c.id
	cross join center
	cross join lateral jsonb_array_elements(coalesce(crs.components->'descriptive_tags', '[]'::jsonb)) as tag
	where c.geog is not null
	  and ($3::double precision <= 0 OR ST_DWithin(c.geog, center.p, $3::double precision))
	  and trim(coalesce(tag->>'label', '')) <> ''
), ranked as (
	select
		tag_key,
		min(tag_label) as tag_label,
		count(*)::int as cafes_count
	from tags
	group by tag_key
)
select tag_label
from ranked
where ($4::text = '' or tag_key like '%' || lower($4::text) || '%')
order by cafes_count desc, tag_label asc
limit $5::int`

	rows, err := r.pool.Query(ctx, query, scope.Latitude, scope.Longitude, scope.RadiusM, search, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]string, 0, limit)
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			return nil, err
		}
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		result = append(result, value)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) ListExistingDescriptiveTagLabels(
	ctx context.Context,
	scope GeoScope,
	keys []string,
) (map[string]string, error) {
	result := make(map[string]string, len(keys))
	if len(keys) == 0 {
		return result, nil
	}

	const query = `with center as (
	select ST_SetSRID(ST_MakePoint($2::double precision, $1::double precision), 4326)::geography as p
), tags as (
	select
		lower(trim(tag->>'label')) as tag_key,
		trim(tag->>'label') as tag_label
	from public.cafes c
	join public.cafe_rating_snapshots crs on crs.cafe_id = c.id
	cross join center
	cross join lateral jsonb_array_elements(coalesce(crs.components->'descriptive_tags', '[]'::jsonb)) as tag
	where c.geog is not null
	  and ($3::double precision <= 0 OR ST_DWithin(c.geog, center.p, $3::double precision))
	  and trim(coalesce(tag->>'label', '')) <> ''
)
select
	tag_key,
	min(tag_label) as tag_label
from tags
where tag_key = any($4::text[])
group by tag_key`

	rows, err := r.pool.Query(ctx, query, scope.Latitude, scope.Longitude, scope.RadiusM, keys)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var key, label string
		if err := rows.Scan(&key, &label); err != nil {
			return nil, err
		}
		key = strings.TrimSpace(strings.ToLower(key))
		label = strings.TrimSpace(label)
		if key == "" || label == "" {
			continue
		}
		result[key] = label
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) ListUserPreferences(
	ctx context.Context,
	userID string,
	category string,
	limit int,
) ([]string, error) {
	const query = `select tag_label
from public.user_tag_preferences
where user_id = $1::uuid
  and category = $2::text
order by position asc, updated_at desc
limit $3::int`

	rows, err := r.pool.Query(ctx, query, userID, category, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]string, 0, limit)
	for rows.Next() {
		var label string
		if err := rows.Scan(&label); err != nil {
			return nil, err
		}
		label = strings.TrimSpace(label)
		if label == "" {
			continue
		}
		result = append(result, label)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) ReplaceUserPreferences(
	ctx context.Context,
	userID string,
	category string,
	tags []string,
) error {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if _, err := tx.Exec(
		ctx,
		`delete from public.user_tag_preferences
where user_id = $1::uuid
  and category = $2::text`,
		userID,
		category,
	); err != nil {
		return err
	}

	for idx, label := range tags {
		key := strings.TrimSpace(strings.ToLower(label))
		label = strings.TrimSpace(label)
		if key == "" || label == "" {
			continue
		}
		if _, err := tx.Exec(
			ctx,
			`insert into public.user_tag_preferences (
	user_id,
	category,
	tag_key,
	tag_label,
	position,
	updated_at
) values (
	$1::uuid,
	$2::text,
	$3::text,
	$4::text,
	$5::int,
	now()
)`,
			userID,
			category,
			key,
			label,
			idx,
		); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
