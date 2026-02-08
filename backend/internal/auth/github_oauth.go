package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	githubStateCookie = "gh_state"
	githubStateTTL    = 10 * time.Minute
)

type githubTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
}

type githubUser struct {
	ID        int64   `json:"id"`
	Login     string  `json:"login"`
	Name      *string `json:"name"`
	AvatarURL *string `json:"avatar_url"`
	Email     *string `json:"email"`
}

type githubEmail struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

func (h Handler) GitHubStart(c *gin.Context) {
	if h.Security.BaseURL == "" || h.GitHubClientID == "" {
		respondError(c, http.StatusInternalServerError, "internal", "github oauth not configured", nil)
		return
	}

	state, err := generateState()
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "state generate failed", nil)
		return
	}

	setOAuthStateCookie(c, state, h.CookieSecure)

	redirectURI := strings.TrimRight(h.Security.BaseURL, "/") + "/api/auth/github/callback"
	params := url.Values{}
	params.Set("client_id", h.GitHubClientID)
	params.Set("redirect_uri", redirectURI)
	params.Set("scope", h.GitHubScope)
	params.Set("state", state)
	params.Set("allow_signup", "true")

	authURL := "https://github.com/login/oauth/authorize?" + params.Encode()
	c.Redirect(http.StatusFound, authURL)
}

func (h Handler) GitHubCallback(c *gin.Context) {
	if h.Security.BaseURL == "" || h.GitHubClientID == "" || h.GitHubClientSecret == "" {
		respondError(c, http.StatusInternalServerError, "internal", "github oauth not configured", nil)
		return
	}

	code := strings.TrimSpace(c.Query("code"))
	state := strings.TrimSpace(c.Query("state"))
	if code == "" || state == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "code and state are required", nil)
		return
	}

	cookieState, err := c.Cookie(githubStateCookie)
	clearOAuthStateCookie(c, h.CookieSecure)
	if err != nil || cookieState == "" || !secureCompare(cookieState, state) {
		respondError(c, http.StatusBadRequest, "invalid_state", "state mismatch", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	token, err := h.githubExchangeCode(ctx, code)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "github token exchange failed", nil)
		return
	}

	user, err := h.githubFetchUser(ctx, token)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "github user fetch failed", nil)
		return
	}

	email := user.Email
	if email == nil || strings.TrimSpace(*email) == "" {
		email = h.githubFetchPrimaryEmail(ctx, token)
	}

	identity := Identity{
		Provider:       ProviderGitHub,
		ProviderUserID: fmt.Sprintf("%d", user.ID),
		DisplayName:    user.Name,
		AvatarURL:      user.AvatarURL,
	}
	if email != nil && strings.TrimSpace(*email) != "" {
		emailVal := NormalizeEmail(*email)
		if emailVal != "" {
			identity.Email = &emailVal
			identity.EmailNormalized = &emailVal
		}
	}

	userID, _, err := ResolveUserForIdentity(ctx, h.Pool, identity, true)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "identity resolve failed", nil)
		return
	}

	sessionID, _, err := createSession(ctx, h.Pool, userID, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "session create failed", nil)
		return
	}
	setSessionCookie(c, sessionID, h.CookieSecure)

	redirect := strings.TrimRight(h.Security.BaseURL, "/") + "/settings"
	c.Redirect(http.StatusFound, redirect)
}

func (h Handler) githubExchangeCode(ctx context.Context, code string) (string, error) {
	redirectURI := strings.TrimRight(h.Security.BaseURL, "/") + "/api/auth/github/callback"
	form := url.Values{}
	form.Set("client_id", h.GitHubClientID)
	form.Set("client_secret", h.GitHubClientSecret)
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://github.com/login/oauth/access_token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("github token exchange status %d", resp.StatusCode)
	}

	var out githubTokenResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return "", err
	}
	if out.AccessToken == "" {
		return "", fmt.Errorf("github token missing")
	}
	return out.AccessToken, nil
}

func (h Handler) githubFetchUser(ctx context.Context, token string) (*githubUser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "gde-kofe-backend")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("github user status %d", resp.StatusCode)
	}

	var user githubUser
	if err := json.Unmarshal(body, &user); err != nil {
		return nil, err
	}
	return &user, nil
}

func (h Handler) githubFetchPrimaryEmail(ctx context.Context, token string) *string {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user/emails", nil)
	if err != nil {
		return nil
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "gde-kofe-backend")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil
	}

	var emails []githubEmail
	if err := json.Unmarshal(body, &emails); err != nil {
		return nil
	}

	for _, e := range emails {
		if e.Primary && e.Verified {
			val := e.Email
			return &val
		}
	}
	for _, e := range emails {
		if e.Verified {
			val := e.Email
			return &val
		}
	}
	if len(emails) > 0 {
		val := emails[0].Email
		return &val
	}
	return nil
}

func generateState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func setOAuthStateCookie(c *gin.Context, value string, secure bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(githubStateCookie, value, int(githubStateTTL.Seconds()), "/", "", secure, true)
}

func clearOAuthStateCookie(c *gin.Context, secure bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(githubStateCookie, "", -1, "/", "", secure, true)
}

func secureCompare(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
