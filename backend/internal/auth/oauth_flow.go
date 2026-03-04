package auth

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func (h Handler) oauthProvider(provider Provider) (OAuthProvider, bool) {
	if h.OAuthProviders == nil {
		return nil, false
	}
	p, ok := h.OAuthProviders[provider]
	return p, ok
}

func (h Handler) oauthStart(c *gin.Context, provider Provider, flow string, userID *string, redirectPath string) {
	dest := oauthDefaultRedirect(flow)
	if h.Security.BaseURL == "" {
		slog.Warn("oauth missing base url", "provider", provider)
		h.oauthRedirect(c, provider, dest, "internal", "", "")
		return
	}
	p, ok := h.oauthProvider(provider)
	if !ok || p == nil {
		slog.Warn("oauth provider not configured", "provider", provider)
		h.oauthRedirect(c, provider, dest, "internal", "", "")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	redirectBase := strings.TrimRight(h.Security.BaseURL, "/")
	if h.OAuthRedirectBase != nil {
		if override := strings.TrimSpace(h.OAuthRedirectBase[provider]); override != "" {
			redirectBase = strings.TrimRight(override, "/")
		}
	}
	redirectURI := redirectBase + redirectPath
	state, err := CreateOAuthState(ctx, h.Pool, provider, flow, userID, redirectURI)
	if err != nil {
		slog.Warn("oauth create state failed", "provider", provider, "error", err)
		h.oauthRedirect(c, provider, dest, "internal", "", "")
		return
	}

	authURL := p.AuthURL(state, redirectURI)
	c.Redirect(http.StatusFound, authURL)
}

func (h Handler) oauthCallback(c *gin.Context, provider Provider, expectedFlow string) {
	dest := oauthDefaultRedirect(expectedFlow)
	if h.Security.BaseURL == "" {
		slog.Warn("oauth missing base url", "provider", provider)
		h.oauthRedirect(c, provider, dest, "internal", "", "")
		return
	}
	p, ok := h.oauthProvider(provider)
	if !ok || p == nil {
		slog.Warn("oauth provider not configured", "provider", provider)
		h.oauthRedirect(c, provider, dest, "internal", "", "")
		return
	}

	code := strings.TrimSpace(c.Query("code"))
	state := strings.TrimSpace(c.Query("state"))
	errParam := strings.TrimSpace(c.Query("error"))
	errDescription := strings.TrimSpace(c.Query("error_description"))
	if state == "" {
		h.oauthRedirect(c, provider, dest, "invalid_state", "", "")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	stateRec, err := ConsumeOAuthState(ctx, h.Pool, provider, state)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.oauthRedirect(c, provider, dest, "invalid_state", "", "")
			return
		}
		slog.Warn("oauth consume state failed", "provider", provider, "error", err)
		h.oauthRedirect(c, provider, dest, "invalid_state", "", "")
		return
	}

	if stateRec.RedirectURI == "" {
		slog.Warn("oauth empty redirect uri", "provider", provider)
		h.oauthRedirect(c, provider, dest, "invalid_state", "", "")
		return
	}
	parsedRedirect, err := url.Parse(stateRec.RedirectURI)
	if err != nil || parsedRedirect.Path == "" {
		slog.Warn("oauth invalid redirect uri", "provider", provider, "error", err)
		h.oauthRedirect(c, provider, dest, "invalid_state", "", "")
		return
	}
	if !strings.EqualFold(parsedRedirect.Path, c.FullPath()) {
		slog.Warn("oauth redirect uri mismatch", "provider", provider, "expected", c.FullPath(), "got", parsedRedirect.Path)
		h.oauthRedirect(c, provider, dest, "invalid_state", "", "")
		return
	}
	if stateRec.Flow != expectedFlow {
		slog.Warn("oauth flow mismatch", "provider", provider, "expected", expectedFlow, "got", stateRec.Flow)
		h.oauthRedirect(c, provider, dest, "invalid_state", "", "")
		return
	}
	if errParam != "" {
		slog.Warn("oauth provider error", "provider", provider, "error_code", errParam, "description", errDescription)
		h.oauthRedirect(c, provider, dest, strings.ToLower(errParam), errDescription, "")
		return
	}
	if code == "" {
		h.oauthRedirect(c, provider, dest, "invalid_state", "", "")
		return
	}

	tokenValue := ""
	var tokenEmail *string
	tokenEmailVerified := false
	if withMeta, ok := p.(OAuthProviderWithMeta); ok {
		meta, err := withMeta.ExchangeWithMeta(ctx, code, stateRec.RedirectURI)
		if err != nil {
			slog.Warn("oauth exchange failed", "provider", provider, "error", err)
			h.oauthRedirect(c, provider, dest, "exchange_failed", "", "")
			return
		}
		tokenValue = meta.AccessToken
		tokenEmail = meta.Email
		tokenEmailVerified = meta.EmailVerified
	} else {
		token, err := p.Exchange(ctx, code, stateRec.RedirectURI)
		if err != nil {
			slog.Warn("oauth exchange failed", "provider", provider, "error", err)
			h.oauthRedirect(c, provider, dest, "exchange_failed", "", "")
			return
		}
		tokenValue = token
	}

	profile, err := p.FetchProfile(ctx, tokenValue)
	if err != nil {
		slog.Warn("oauth profile fetch failed", "provider", provider, "error", err)
		h.oauthRedirect(c, provider, dest, "profile_failed", "", "")
		return
	}
	if profile.Email == nil && tokenEmail != nil {
		profile.Email = tokenEmail
		profile.EmailVerified = tokenEmailVerified
	}

	identity := identityFromProfile(provider, profile)

	switch stateRec.Flow {
	case oauthFlowLogin:
		mergeByEmail := profile.EmailVerified
		userID, _, err := ResolveUserForIdentity(ctx, h.Pool, identity, mergeByEmail)
		if err != nil {
			slog.Warn("oauth resolve user failed", "provider", provider, "error", err)
			h.oauthRedirect(c, provider, dest, "internal", "", "")
			return
		}
		if err := updateUserAvatarIfEmpty(ctx, h.Pool, userID, identity.AvatarURL); err != nil {
			slog.Warn("oauth avatar update failed", "provider", provider, "error", err)
		}

		sessionID, _, err := createSession(ctx, h.Pool, userID, c.ClientIP(), c.GetHeader("User-Agent"))
		if err != nil {
			slog.Error("oauth session create failed", "provider", provider, "error", err)
			h.oauthRedirect(c, provider, dest, "internal", "", "")
			return
		}
		setSessionCookie(c, sessionID, h.CookieSecure)

		h.oauthRedirect(c, provider, dest, "", "", "ok")
		return
	case oauthFlowLink:
		if stateRec.UserID == nil || *stateRec.UserID == "" {
			h.oauthRedirect(c, provider, dest, "invalid_state", "", "")
			return
		}
		targetUserID := *stateRec.UserID

		foundIdentity, found, err := GetIdentity(ctx, h.Pool, provider, identity.ProviderUserID)
		if err != nil {
			slog.Warn("oauth identity lookup failed", "provider", provider, "error", err)
			h.oauthRedirect(c, provider, dest, "internal", "", "")
			return
		}
		if found {
			if foundIdentity.UserID != targetUserID {
				h.oauthRedirect(c, provider, dest, "already_linked", "", "")
				return
			}
		} else {
			identity.UserID = targetUserID
			if err := CreateIdentity(ctx, h.Pool, identity); err != nil {
				if isUniqueViolation(err) {
					h.oauthRedirect(c, provider, dest, "already_linked", "", "")
					return
				}
				slog.Warn("oauth identity create failed", "provider", provider, "error", err)
				h.oauthRedirect(c, provider, dest, "internal", "", "")
				return
			}
		}

		if err := updateUserAvatarIfEmpty(ctx, h.Pool, targetUserID, identity.AvatarURL); err != nil {
			slog.Warn("oauth avatar update failed", "provider", provider, "error", err)
		}

		h.oauthRedirect(c, provider, dest, "", "", "linked")
		return
	default:
		h.oauthRedirect(c, provider, dest, "invalid_state", "", "")
		return
	}
}

func identityFromProfile(provider Provider, profile OAuthProfile) Identity {
	identity := Identity{
		Provider:       provider,
		ProviderUserID: profile.ProviderUserID,
		DisplayName:    profile.DisplayName,
		AvatarURL:      profile.AvatarURL,
	}
	if profile.Email != nil {
		emailVal := NormalizeEmail(*profile.Email)
		if emailVal != "" {
			identity.Email = &emailVal
			identity.EmailNormalized = &emailVal
		}
	}
	return identity
}

func oauthDefaultRedirect(flow string) string {
	if flow == oauthFlowLink {
		return "/settings"
	}
	return "/login"
}

func (h Handler) oauthRedirect(c *gin.Context, provider Provider, destPath, errCode, errDescription, result string) {
	base := strings.TrimRight(h.Security.BaseURL, "/")
	target := destPath
	if base != "" {
		target = base + destPath
	}
	params := url.Values{}
	params.Set("oauth", string(provider))
	if errCode != "" {
		params.Set("error", errCode)
		if errDescription != "" {
			params.Set("error_description", errDescription)
		}
	} else if result != "" {
		params.Set("result", result)
	}

	sep := "?"
	if strings.Contains(target, "?") {
		sep = "&"
	}
	c.Redirect(http.StatusFound, target+sep+params.Encode())
}
