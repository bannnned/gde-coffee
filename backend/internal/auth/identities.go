package auth

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Provider string

const (
	ProviderLocal    Provider = "local"
	ProviderGitHub   Provider = "github"
	ProviderYandex   Provider = "yandex"
	ProviderVK       Provider = "vk"
	ProviderTelegram Provider = "telegram"
)

type Identity struct {
	UserID          string
	Provider        Provider
	ProviderUserID  string
	Email           *string
	EmailNormalized *string
	DisplayName     *string
	AvatarURL       *string
	CreatedAt       time.Time
}

func NormalizeEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func GetIdentity(ctx context.Context, pool queryer, provider Provider, providerUserID string) (Identity, bool, error) {
	var id Identity
	row := pool.QueryRow(ctx, `
		select user_id::text, provider, provider_user_id, email, email_normalized, display_name, avatar_url, created_at
		from public.identities
		where provider = $1 and provider_user_id = $2
	`, string(provider), providerUserID)

	var email, emailNorm, displayName, avatarURL *string
	if err := row.Scan(&id.UserID, &id.Provider, &id.ProviderUserID, &email, &emailNorm, &displayName, &avatarURL, &id.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Identity{}, false, nil
		}
		return Identity{}, false, err
	}
	id.Email = email
	id.EmailNormalized = emailNorm
	id.DisplayName = displayName
	id.AvatarURL = avatarURL
	return id, true, nil
}

func CreateIdentity(ctx context.Context, execer execer, identity Identity) error {
	_, err := execer.Exec(
		ctx,
		`insert into public.identities
		 (user_id, provider, provider_user_id, email, email_normalized, display_name, avatar_url)
		 values ($1, $2, $3, $4, $5, $6, $7)`,
		identity.UserID,
		string(identity.Provider),
		identity.ProviderUserID,
		identity.Email,
		identity.EmailNormalized,
		identity.DisplayName,
		identity.AvatarURL,
	)
	return err
}

func ListUserIdentities(ctx context.Context, pool queryer, userID string) ([]Identity, error) {
	rows, err := pool.Query(ctx, `
		select user_id::text, provider, provider_user_id, email, email_normalized, display_name, avatar_url, created_at
		from public.identities
		where user_id = $1
		order by created_at asc
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Identity, 0, 4)
	for rows.Next() {
		var id Identity
		var email, emailNorm, displayName, avatarURL *string
		if err := rows.Scan(&id.UserID, &id.Provider, &id.ProviderUserID, &email, &emailNorm, &displayName, &avatarURL, &id.CreatedAt); err != nil {
			return nil, err
		}
		id.Email = email
		id.EmailNormalized = emailNorm
		id.DisplayName = displayName
		id.AvatarURL = avatarURL
		out = append(out, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func ResolveUserForIdentity(ctx context.Context, pool *pgxpool.Pool, identity Identity, mergeByEmail bool) (string, bool, error) {
	identity.ProviderUserID = strings.TrimSpace(identity.ProviderUserID)
	if identity.ProviderUserID == "" {
		return "", false, errors.New("provider_user_id is required")
	}

	if identity.Email != nil {
		emailNorm := NormalizeEmail(*identity.Email)
		if emailNorm != "" {
			identity.EmailNormalized = &emailNorm
		}
	}

	if identity.EmailNormalized != nil && strings.TrimSpace(*identity.EmailNormalized) == "" {
		identity.EmailNormalized = nil
	}

	// Fast path: identity exists
	foundIdentity, found, err := GetIdentity(ctx, pool, identity.Provider, identity.ProviderUserID)
	if err != nil {
		return "", false, err
	}
	if found {
		return foundIdentity.UserID, false, nil
	}

	tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", false, err
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	// Check again inside txn for race
	foundIdentity, found, err = GetIdentity(ctx, tx, identity.Provider, identity.ProviderUserID)
	if err != nil {
		return "", false, err
	}
	if found {
		return foundIdentity.UserID, false, nil
	}

	var userID string
	if mergeByEmail && identity.EmailNormalized != nil {
		err = tx.QueryRow(
			ctx,
			`select id::text from users where email_normalized = $1`,
			*identity.EmailNormalized,
		).Scan(&userID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return "", false, err
		}
	}

	created := false
	if userID == "" {
		created = true
		err = tx.QueryRow(
			ctx,
			`insert into users (email_normalized, display_name, avatar_url)
			 values ($1, $2, $3)
			 returning id::text`,
			identity.EmailNormalized,
			identity.DisplayName,
			identity.AvatarURL,
		).Scan(&userID)
		if err != nil {
			return "", false, err
		}
	}

	identity.UserID = userID
	if err := CreateIdentity(ctx, tx, identity); err != nil {
		if isUniqueViolation(err) {
			foundIdentity, found, err = GetIdentity(ctx, tx, identity.Provider, identity.ProviderUserID)
			if err != nil {
				return "", false, err
			}
			if found {
				return foundIdentity.UserID, false, nil
			}
		}
		return "", false, err
	}

	if err := tx.Commit(ctx); err != nil {
		return "", false, err
	}
	return userID, created, nil
}
