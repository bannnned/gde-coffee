package reviews

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	defaultAdminDrinksLimit   = 60
	maxAdminDrinksLimit       = 200
	defaultUnknownDrinksLimit = 50
	maxUnknownDrinksLimit     = 200

	sqlListAdminDrinks = `select
	id,
	name,
	coalesce(aliases, '{}'::text[]),
	coalesce(description, ''),
	coalesce(category, 'other'),
	coalesce(popularity_rank, 100),
	coalesce(is_active, true),
	updated_at
from drinks
where ($1 = ''
	or name like '%' || $1 || '%'
	or exists (
		select 1
		  from unnest(coalesce(aliases, '{}'::text[])) alias
		 where alias like '%' || $1 || '%'
	)
)
  and ($2::boolean or is_active = true)
order by is_active desc, popularity_rank asc, name asc
limit $3`

	sqlInsertDrink = `insert into drinks (
	id,
	name,
	aliases,
	description,
	category,
	popularity_rank,
	is_active,
	created_at,
	updated_at
)
values ($1, $2, $3::text[], $4, $5, $6, $7, now(), now())
returning id, name, aliases, description, category, popularity_rank, is_active, updated_at`

	sqlSelectDrinkByIDAnyStatus = `select id,
	name,
	coalesce(aliases, '{}'::text[]),
	coalesce(description, ''),
	coalesce(category, 'other'),
	coalesce(popularity_rank, 100),
	coalesce(is_active, true),
	updated_at
from drinks
where id = $1`

	sqlUpdateDrink = `update drinks
set name = $2,
	aliases = $3::text[],
	description = $4,
	category = $5,
	popularity_rank = $6,
	is_active = $7,
	updated_at = now()
where id = $1
returning id, name, aliases, description, category, popularity_rank, is_active, updated_at`

	sqlListUnknownDrinkFormats = `select
	id,
	name,
	mentions_count,
	first_seen_at,
	last_seen_at,
	status,
	coalesce(mapped_drink_id, ''),
	coalesce(notes, ''),
	updated_at
from drink_unknown_formats
where ($1 = '' or status = $1)
order by
	case
		when status = 'new' then 0
		when status = 'ignored' then 1
		else 2
	end,
	mentions_count desc,
	last_seen_at desc,
	id asc
limit $2
offset $3`

	sqlSelectUnknownDrinkForUpdate = `select id,
	name,
	status,
	coalesce(mapped_drink_id, '')
from drink_unknown_formats
where id = $1
for update`

	sqlUpdateUnknownDrinkAsMapped = `update drink_unknown_formats
set status = 'mapped',
		mapped_drink_id = $2,
		updated_at = now()
where id = $1
returning id,
		name,
		mentions_count,
		first_seen_at,
		last_seen_at,
		status,
		coalesce(mapped_drink_id, ''),
		coalesce(notes, ''),
		updated_at`

	sqlUpdateUnknownDrinkAsIgnored = `update drink_unknown_formats
set status = 'ignored',
	updated_at = now()
where id = $1
returning id,
	name,
	mentions_count,
	first_seen_at,
	last_seen_at,
	status,
	coalesce(mapped_drink_id, ''),
	coalesce(notes, ''),
	updated_at`
)

type adminDrinkRecord struct {
	ID             string
	Name           string
	Aliases        []string
	Description    string
	Category       string
	PopularityRank int
	IsActive       bool
	UpdatedAt      time.Time
}

type unknownDrinkRecord struct {
	ID            int64
	Name          string
	Mentions      int
	FirstSeenAt   time.Time
	LastSeenAt    time.Time
	Status        string
	MappedDrinkID string
	Notes         string
	UpdatedAt     time.Time
}

func (s *Service) ListAdminDrinks(
	ctx context.Context,
	query string,
	includeInactive bool,
	limit int,
) ([]map[string]interface{}, error) {
	q := normalizeDrinkText(query)
	if limit <= 0 {
		limit = defaultAdminDrinksLimit
	}
	if limit > maxAdminDrinksLimit {
		limit = maxAdminDrinksLimit
	}

	rows, err := s.repository.Pool().Query(ctx, sqlListAdminDrinks, q, includeInactive, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]map[string]interface{}, 0, limit)
	for rows.Next() {
		rec, err := scanAdminDrink(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, adminDrinkToMap(rec))
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func (s *Service) CreateDrink(
	ctx context.Context,
	req AdminCreateDrinkRequest,
) (map[string]interface{}, error) {
	normalized, err := normalizeAdminCreateDrink(req)
	if err != nil {
		return nil, err
	}

	var rec adminDrinkRecord
	err = s.repository.Pool().QueryRow(
		ctx,
		sqlInsertDrink,
		normalized.ID,
		normalized.Name,
		normalized.Aliases,
		normalized.Description,
		normalized.Category,
		normalized.PopularityRank,
		normalized.IsActive,
	).Scan(
		&rec.ID,
		&rec.Name,
		&rec.Aliases,
		&rec.Description,
		&rec.Category,
		&rec.PopularityRank,
		&rec.IsActive,
		&rec.UpdatedAt,
	)
	if isUniqueViolation(err) {
		return nil, ErrConflict
	}
	if err != nil {
		return nil, err
	}
	return adminDrinkToMap(rec), nil
}

func (s *Service) UpdateDrink(
	ctx context.Context,
	drinkID string,
	req AdminUpdateDrinkRequest,
) (map[string]interface{}, error) {
	id := normalizeDrinkToken(drinkID)
	if id == "" {
		return nil, ErrInvalidDrink
	}

	current, err := s.loadDrinkByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if current.ID == "" {
		return nil, ErrNotFound
	}

	next, err := applyAdminDrinkPatch(current, req)
	if err != nil {
		return nil, err
	}

	var rec adminDrinkRecord
	err = s.repository.Pool().QueryRow(
		ctx,
		sqlUpdateDrink,
		id,
		next.Name,
		next.Aliases,
		next.Description,
		next.Category,
		next.PopularityRank,
		next.IsActive,
	).Scan(
		&rec.ID,
		&rec.Name,
		&rec.Aliases,
		&rec.Description,
		&rec.Category,
		&rec.PopularityRank,
		&rec.IsActive,
		&rec.UpdatedAt,
	)
	if isUniqueViolation(err) {
		return nil, ErrConflict
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return adminDrinkToMap(rec), nil
}

func (s *Service) ListUnknownDrinkFormats(
	ctx context.Context,
	status string,
	limit int,
	offset int,
) ([]map[string]interface{}, error) {
	normalizedStatus := strings.TrimSpace(strings.ToLower(status))
	switch normalizedStatus {
	case "", "new", "mapped", "ignored":
	default:
		return nil, ErrConflict
	}

	if limit <= 0 {
		limit = defaultUnknownDrinksLimit
	}
	if limit > maxUnknownDrinksLimit {
		limit = maxUnknownDrinksLimit
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := s.repository.Pool().Query(ctx, sqlListUnknownDrinkFormats, normalizedStatus, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]map[string]interface{}, 0, limit)
	for rows.Next() {
		rec, err := scanUnknownDrink(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, unknownDrinkToMap(rec))
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func (s *Service) MapUnknownDrinkFormat(
	ctx context.Context,
	unknownID int64,
	drinkID string,
	addAlias bool,
) (map[string]interface{}, error) {
	id := normalizeDrinkToken(drinkID)
	if unknownID <= 0 {
		return nil, ErrConflict
	}
	if id == "" {
		return nil, ErrInvalidDrink
	}

	tx, err := s.repository.Pool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var unknown unknownDrinkRecord
	err = tx.QueryRow(ctx, sqlSelectUnknownDrinkForUpdate, unknownID).Scan(
		&unknown.ID,
		&unknown.Name,
		&unknown.Status,
		&unknown.MappedDrinkID,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	var target adminDrinkRecord
	err = tx.QueryRow(ctx, sqlSelectDrinkByIDAnyStatus, id).Scan(
		&target.ID,
		&target.Name,
		&target.Aliases,
		&target.Description,
		&target.Category,
		&target.PopularityRank,
		&target.IsActive,
		&target.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvalidDrink
	}
	if err != nil {
		return nil, err
	}

	if addAlias {
		aliases := append([]string{}, target.Aliases...)
		// Keep unknown user wording as an alias to improve future auto-match.
		aliases = append(aliases, normalizeDrinkText(unknown.Name))
		aliases = normalizeDrinkAliases(aliases)
		if _, err := tx.Exec(
			ctx,
			`update drinks set aliases = $2::text[], updated_at = now() where id = $1`,
			target.ID,
			aliases,
		); err != nil {
			return nil, err
		}
	}

	var mapped unknownDrinkRecord
	if err := tx.QueryRow(ctx, sqlUpdateUnknownDrinkAsMapped, unknown.ID, target.ID).Scan(
		&mapped.ID,
		&mapped.Name,
		&mapped.Mentions,
		&mapped.FirstSeenAt,
		&mapped.LastSeenAt,
		&mapped.Status,
		&mapped.MappedDrinkID,
		&mapped.Notes,
		&mapped.UpdatedAt,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return unknownDrinkToMap(mapped), nil
}

func (s *Service) IgnoreUnknownDrinkFormat(
	ctx context.Context,
	unknownID int64,
) (map[string]interface{}, error) {
	if unknownID <= 0 {
		return nil, ErrConflict
	}

	var rec unknownDrinkRecord
	err := s.repository.Pool().QueryRow(ctx, sqlUpdateUnknownDrinkAsIgnored, unknownID).Scan(
		&rec.ID,
		&rec.Name,
		&rec.Mentions,
		&rec.FirstSeenAt,
		&rec.LastSeenAt,
		&rec.Status,
		&rec.MappedDrinkID,
		&rec.Notes,
		&rec.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	return unknownDrinkToMap(rec), nil
}

func (s *Service) loadDrinkByID(ctx context.Context, drinkID string) (adminDrinkRecord, error) {
	var rec adminDrinkRecord
	err := s.repository.Pool().QueryRow(ctx, sqlSelectDrinkByIDAnyStatus, drinkID).Scan(
		&rec.ID,
		&rec.Name,
		&rec.Aliases,
		&rec.Description,
		&rec.Category,
		&rec.PopularityRank,
		&rec.IsActive,
		&rec.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return adminDrinkRecord{}, nil
	}
	if err != nil {
		return adminDrinkRecord{}, err
	}
	return rec, nil
}

func normalizeAdminCreateDrink(req AdminCreateDrinkRequest) (adminDrinkRecord, error) {
	name := normalizeDrinkText(req.Name)
	if name == "" {
		return adminDrinkRecord{}, ErrConflict
	}

	id := normalizeDrinkToken(req.ID)
	if id == "" {
		id = normalizeDrinkToken(name)
	}
	if id == "" {
		return adminDrinkRecord{}, ErrConflict
	}

	aliases := normalizeDrinkAliases(req.Aliases)
	description := strings.TrimSpace(req.Description)
	category := normalizeDrinkCategory(req.Category)
	rank := 100
	if req.PopularityRank != nil {
		rank = *req.PopularityRank
	}
	if rank < 0 {
		return adminDrinkRecord{}, ErrConflict
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	return adminDrinkRecord{
		ID:             id,
		Name:           name,
		Aliases:        aliases,
		Description:    description,
		Category:       category,
		PopularityRank: rank,
		IsActive:       isActive,
	}, nil
}

func applyAdminDrinkPatch(current adminDrinkRecord, req AdminUpdateDrinkRequest) (adminDrinkRecord, error) {
	next := current
	if req.Name != nil {
		name := normalizeDrinkText(*req.Name)
		if name == "" {
			return adminDrinkRecord{}, ErrConflict
		}
		if name != next.Name {
			next.Aliases = append(next.Aliases, next.Name)
			next.Name = name
		}
	}
	if req.Aliases != nil {
		next.Aliases = normalizeDrinkAliases(*req.Aliases)
	} else {
		next.Aliases = normalizeDrinkAliases(next.Aliases)
	}
	if req.Description != nil {
		next.Description = strings.TrimSpace(*req.Description)
	}
	if req.Category != nil {
		next.Category = normalizeDrinkCategory(*req.Category)
	}
	if req.PopularityRank != nil {
		if *req.PopularityRank < 0 {
			return adminDrinkRecord{}, ErrConflict
		}
		next.PopularityRank = *req.PopularityRank
	}
	if req.IsActive != nil {
		next.IsActive = *req.IsActive
	}

	next.Aliases = normalizeDrinkAliases(next.Aliases)
	next.Aliases = removeAlias(next.Aliases, next.Name)
	return next, nil
}

func removeAlias(values []string, name string) []string {
	if len(values) == 0 {
		return values
	}
	normalizedName := normalizeDrinkText(name)
	out := make([]string, 0, len(values))
	for _, value := range values {
		if normalizeDrinkText(value) == normalizedName {
			continue
		}
		out = append(out, value)
	}
	sort.Strings(out)
	return out
}

func scanAdminDrink(row pgx.Row) (adminDrinkRecord, error) {
	var rec adminDrinkRecord
	err := row.Scan(
		&rec.ID,
		&rec.Name,
		&rec.Aliases,
		&rec.Description,
		&rec.Category,
		&rec.PopularityRank,
		&rec.IsActive,
		&rec.UpdatedAt,
	)
	if err != nil {
		return adminDrinkRecord{}, err
	}
	rec.ID = normalizeDrinkToken(rec.ID)
	rec.Name = normalizeDrinkText(rec.Name)
	rec.Aliases = normalizeDrinkAliases(rec.Aliases)
	rec.Category = normalizeDrinkCategory(rec.Category)
	rec.Description = strings.TrimSpace(rec.Description)
	return rec, nil
}

func scanUnknownDrink(row pgx.Row) (unknownDrinkRecord, error) {
	var rec unknownDrinkRecord
	err := row.Scan(
		&rec.ID,
		&rec.Name,
		&rec.Mentions,
		&rec.FirstSeenAt,
		&rec.LastSeenAt,
		&rec.Status,
		&rec.MappedDrinkID,
		&rec.Notes,
		&rec.UpdatedAt,
	)
	if err != nil {
		return unknownDrinkRecord{}, err
	}
	rec.Name = normalizeDrinkText(rec.Name)
	rec.Status = strings.TrimSpace(strings.ToLower(rec.Status))
	rec.MappedDrinkID = normalizeDrinkToken(rec.MappedDrinkID)
	rec.Notes = strings.TrimSpace(rec.Notes)
	return rec, nil
}

func adminDrinkToMap(rec adminDrinkRecord) map[string]interface{} {
	return map[string]interface{}{
		"id":              rec.ID,
		"name":            rec.Name,
		"aliases":         rec.Aliases,
		"description":     rec.Description,
		"category":        rec.Category,
		"popularity_rank": rec.PopularityRank,
		"is_active":       rec.IsActive,
		"updated_at":      rec.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func unknownDrinkToMap(rec unknownDrinkRecord) map[string]interface{} {
	return map[string]interface{}{
		"id":              rec.ID,
		"name":            rec.Name,
		"mentions_count":  rec.Mentions,
		"first_seen_at":   rec.FirstSeenAt.UTC().Format(time.RFC3339),
		"last_seen_at":    rec.LastSeenAt.UTC().Format(time.RFC3339),
		"status":          rec.Status,
		"mapped_drink_id": rec.MappedDrinkID,
		"notes":           rec.Notes,
		"updated_at":      rec.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && strings.TrimSpace(pgErr.Code) == "23505"
}
