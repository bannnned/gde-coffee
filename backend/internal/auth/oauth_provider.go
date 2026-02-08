package auth

import (
	"context"
)

type OAuthProfile struct {
	Provider       Provider
	ProviderUserID string
	Email          *string
	EmailVerified  bool
	DisplayName    *string
	AvatarURL      *string
}

type OAuthProvider interface {
	Provider() Provider
	AuthURL(state, redirectURI string) string
	Exchange(ctx context.Context, code, redirectURI string) (string, error)
	FetchProfile(ctx context.Context, token string) (OAuthProfile, error)
}
