package reviews

import (
	"context"
)

const (
	defaultDrinkSearchLimit = 12
	maxDrinkSearchLimit     = 30

	sqlSearchDrinks = `select
	id,
	name,
	aliases
from drinks
where is_active = true
  and (
	$1 = ''
	or lower(name) like '%' || lower($1) || '%'
	or exists (
		select 1
		  from unnest(aliases) as alias
		 where lower(alias) like '%' || lower($1) || '%'
	)
  )
order by
	case
		when lower(name) = lower($1) then 0
		when lower(name) like lower($1) || '%' then 1
		else 2
	end,
	popularity_rank asc,
	name asc
limit $2`
)

func (s *Service) SearchDrinks(
	ctx context.Context,
	query string,
	limit int,
) ([]map[string]interface{}, error) {
	q := normalizeDrinkText(query)
	if limit <= 0 {
		limit = defaultDrinkSearchLimit
	}
	if limit > maxDrinkSearchLimit {
		limit = maxDrinkSearchLimit
	}

	rows, err := s.repository.Pool().Query(ctx, sqlSearchDrinks, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]map[string]interface{}, 0, limit)
	for rows.Next() {
		var (
			id      string
			name    string
			aliases []string
		)
		if err := rows.Scan(&id, &name, &aliases); err != nil {
			return nil, err
		}
		id = normalizeDrinkToken(id)
		name = normalizeDrinkText(name)
		aliases = normalizeDrinkAliases(aliases)
		result = append(result, map[string]interface{}{
			"id":      id,
			"name":    name,
			"aliases": aliases,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}
