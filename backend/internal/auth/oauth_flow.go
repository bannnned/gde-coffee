package auth

import (
	"context"
	"errors"
	"log"
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
		log.Printf("oauth %s: missing base url", provider)
		h.oauthRedirect(c, provider, dest, "internal", "")
		return
	}
	p, ok := h.oauthProvider(provider)
	if !ok || p == nil {
		log.Printf("oauth %s: provider not configured", provider)
		h.oauthRedirect(c, provider, dest, "internal", "")
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
		log.Printf("oauth %s: create state failed: %v", provider, err)
		h.oauthRedirect(c, provider, dest, "internal", "")
		return
	}

	authURL := p.AuthURL(state, redirectURI)
	c.Redirect(http.StatusFound, authURL)
}

func (h Handler) oauthCallback(c *gin.Context, provider Provider, expectedFlow string) {
	dest := oauthDefaultRedirect(expectedFlow)
	if h.Security.BaseURL == "" {
		log.Printf("oauth %s: missing base url", provider)
		h.oauthRedirect(c, provider, dest, "internal", "")
		return
	}
	p, ok := h.oauthProvider(provider)
	if !ok || p == nil {
		log.Printf("oauth %s: provider not configured", provider)
		h.oauthRedirect(c, provider, dest, "internal", "")
		return
	}

	code := strings.TrimSpace(c.Query("code"))
	state := strings.TrimSpace(c.Query("state"))
	errParam := strings.TrimSpace(c.Query("error"))
	if state == "" {
		h.oauthRedirect(c, provider, dest, "invalid_state", "")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	stateRec, err := ConsumeOAuthState(ctx, h.Pool, provider, state)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.oauthRedirect(c, provider, dest, "invalid_state", "")
			return
		}
		log.Printf("oauth %s: consume state failed: %v", provider, err)
		h.oauthRedirect(c, provider, dest, "invalid_state", "")
		return
	}

	if stateRec.RedirectURI == "" {
		log.Printf("oauth %s: empty redirect uri", provider)
		h.oauthRedirect(c, provider, dest, "invalid_state", "")
		return
	}
	parsedRedirect, err := url.Parse(stateRec.RedirectURI)
	if err != nil || parsedRedirect.Path == "" {
		log.Printf("oauth %s: invalid redirect uri: %v", provider, err)
		h.oauthRedirect(c, provider, dest, "invalid_state", "")
		return
	}
	if !strings.EqualFold(parsedRedirect.Path, c.FullPath()) {
		log.Printf("oauth %s: redirect uri mismatch expected path=%s got=%s", provider, c.FullPath(), parsedRedirect.Path)
		h.oauthRedirect(c, provider, dest, "invalid_state", "")
		return
	}
	if stateRec.Flow != expectedFlow {
		log.Printf("oauth %s: flow mismatch expected=%s got=%s", provider, expectedFlow, stateRec.Flow)
		h.oauthRedirect(c, provider, dest, "invalid_state", "")
		return
	}
	if errParam != "" {
		log.Printf("oauth %s: cancelled: %s", provider, errParam)
		h.oauthRedirect(c, provider, dest, "cancelled", "")
		return
	}
	if code == "" {
		h.oauthRedirect(c, provider, dest, "invalid_state", "")
		return
	}

	tokenValue := ""
	var tokenEmail *string
	tokenEmailVerified := false
	if withMeta, ok := p.(OAuthProviderWithMeta); ok {
		meta, err := withMeta.ExchangeWithMeta(ctx, code, stateRec.RedirectURI)
		if err != nil {
			log.Printf("oauth %s: exchange failed: %v", provider, err)
			h.oauthRedirect(c, provider, dest, "exchange_failed", "")
			return
		}
		tokenValue = meta.AccessToken
		tokenEmail = meta.Email
		tokenEmailVerified = meta.EmailVerified
	} else {
		token, err := p.Exchange(ctx, code, stateRec.RedirectURI)
		if err != nil {
			log.Printf("oauth %s: exchange failed: %v", provider, err)
			h.oauthRedirect(c, provider, dest, "exchange_failed", "")
			return
		}
		tokenValue = token
	}

	profile, err := p.FetchProfile(ctx, tokenValue)
	if err != nil {
		log.Printf("oauth %s: profile fetch failed: %v", provider, err)
		h.oauthRedirect(c, provider, dest, "profile_failed", "")
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
			log.Printf("oauth %s: resolve user failed: %v", provider, err)
			h.oauthRedirect(c, provider, dest, "internal", "")
			return
		}

		sessionID, _, err := createSession(ctx, h.Pool, userID, c.ClientIP(), c.GetHeader("User-Agent"))
		if err != nil {
			log.Printf("oauth %s: session create failed: %v", provider, err)
			h.oauthRedirect(c, provider, dest, "internal", "")
			return
		}
		setSessionCookie(c, sessionID, h.CookieSecure)

		h.oauthRedirect(c, provider, dest, "", "ok")
		return
	case oauthFlowLink:
		if stateRec.UserID == nil || *stateRec.UserID == "" {
			h.oauthRedirect(c, provider, dest, "invalid_state", "")
			return
		}
		targetUserID := *stateRec.UserID

		foundIdentity, found, err := GetIdentity(ctx, h.Pool, provider, identity.ProviderUserID)
		if err != nil {
			log.Printf("oauth %s: identity lookup failed: %v", provider, err)
			h.oauthRedirect(c, provider, dest, "internal", "")
			return
		}
		if found {
			if foundIdentity.UserID != targetUserID {
				h.oauthRedirect(c, provider, dest, "already_linked", "")
				return
			}
		} else {
			identity.UserID = targetUserID
			if err := CreateIdentity(ctx, h.Pool, identity); err != nil {
				if isUniqueViolation(err) {
					h.oauthRedirect(c, provider, dest, "already_linked", "")
					return
				}
				log.Printf("oauth %s: identity create failed: %v", provider, err)
				h.oauthRedirect(c, provider, dest, "internal", "")
				return
			}
		}

		if identity.AvatarURL != nil && strings.TrimSpace(*identity.AvatarURL) != "" {
			if _, err := h.Pool.Exec(
				ctx,
				`update users set avatar_url = $2 where id = $1 and (avatar_url is null or avatar_url = '')`,
				targetUserID,
				*identity.AvatarURL,
			); err != nil {
				log.Printf("oauth %s: update avatar failed: %v", provider, err)
			}
		}

		h.oauthRedirect(c, provider, dest, "", "linked")
		return
	default:
		h.oauthRedirect(c, provider, dest, "invalid_state", "")
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

func (h Handler) oauthRedirect(c *gin.Context, provider Provider, destPath, errCode, result string) {
	base := strings.TrimRight(h.Security.BaseURL, "/")
	target := destPath
	if base != "" {
		target = base + destPath
	}
	params := url.Values{}
	params.Set("oauth", string(provider))
	if errCode != "" {
		params.Set("error", errCode)
	} else if result != "" {
		params.Set("result", result)
	}

	sep := "?"
	if strings.Contains(target, "?") {
		sep = "&"
	}
	c.Redirect(http.StatusFound, target+sep+params.Encode())
}
