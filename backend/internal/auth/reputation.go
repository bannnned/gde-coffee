package auth

import (
	"context"
	"strings"

	"backend/internal/reputation"
)

const sqlSelectUserReputationScore = `select coalesce(sum(
	case
		when created_at >= now() - interval '365 days' then points::numeric
		else points::numeric * 0.5
	end
), 0)::float8
from reputation_events
where user_id = $1::uuid`

func populateUserReputation(ctx context.Context, q queryer, user *User) error {
	if user == nil {
		return nil
	}
	user.ReputationBadge = reputation.BadgeFromScore(0)
	user.TrustedMember = false
	if strings.TrimSpace(user.ID) == "" {
		return nil
	}

	var score float64
	if err := q.QueryRow(ctx, sqlSelectUserReputationScore, user.ID).Scan(&score); err != nil {
		return err
	}
	user.ReputationBadge = reputation.BadgeFromScore(score)
	user.TrustedMember = reputation.IsTrustedParticipant(score)
	return nil
}
