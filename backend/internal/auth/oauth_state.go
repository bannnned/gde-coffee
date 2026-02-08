package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const oauthStateTTL = 10 * time.Minute

const (
	oauthFlowLogin = "login"
	oauthFlowLink  = "link"
)

type oauthState struct {
	Provider    Provider
	Flow        string
	UserID      *string
	Expires     time.Time
	RedirectURI string
}

func CreateOAuthState(ctx context.Context, pool *pgxpool.Pool, provider Provider, flow string, userID *string, redirectURI string) (string, error) {
	raw, err := GenerateToken(32)
	if err != nil {
		return "", err
	}
	hash := HashToken(raw)
	expires := time.Now().Add(oauthStateTTL)

	_, err = pool.Exec(ctx, `
		insert into oauth_states (provider, flow, token_hash, user_id, expires_at, redirect_uri)
		values ($1, $2, $3, $4, $5, $6)
	`, string(provider), flow, hash, userID, expires, redirectURI)
	if err != nil {
		return "", err
	}
	return raw, nil
}

func ConsumeOAuthState(ctx context.Context, pool *pgxpool.Pool, provider Provider, raw string) (oauthState, error) {
	if raw == "" {
		return oauthState{}, errors.New("state is required")
	}
	hash := HashToken(raw)

	tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return oauthState{}, err
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	var st oauthState
	var userID *string
	if err := tx.QueryRow(ctx, `
		select provider, flow, user_id, expires_at, redirect_uri
		from oauth_states
		where token_hash = $1 and provider = $2 and consumed_at is null and expires_at > now()
		for update
	`, hash, string(provider)).Scan(&st.Provider, &st.Flow, &userID, &st.Expires, &st.RedirectURI); err != nil {
		return oauthState{}, err
	}

	_, err = tx.Exec(ctx, `update oauth_states set consumed_at = now() where token_hash = $1`, hash)
	if err != nil {
		return oauthState{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return oauthState{}, err
	}

	st.UserID = userID
	return st, nil
}
