package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type GitHubProvider struct {
	ClientID     string
	ClientSecret string
	Scope        string
	HTTPClient   *http.Client
}

func NewGitHubProvider(clientID, clientSecret, scope string) *GitHubProvider {
	if scope == "" {
		scope = "read:user user:email"
	}
	return &GitHubProvider{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Scope:        scope,
		HTTPClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (p *GitHubProvider) Provider() Provider {
	return ProviderGitHub
}

func (p *GitHubProvider) AuthURL(state, redirectURI string) string {
	params := url.Values{}
	params.Set("client_id", p.ClientID)
	params.Set("redirect_uri", redirectURI)
	params.Set("scope", p.Scope)
	params.Set("state", state)
	params.Set("allow_signup", "true")
	return "https://github.com/login/oauth/authorize?" + params.Encode()
}

func (p *GitHubProvider) Exchange(ctx context.Context, code, redirectURI string) (string, error) {
	form := url.Values{}
	form.Set("client_id", p.ClientID)
	form.Set("client_secret", p.ClientSecret)
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://github.com/login/oauth/access_token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := p.HTTPClient.Do(req)
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

func (p *GitHubProvider) FetchProfile(ctx context.Context, token string) (OAuthProfile, error) {
	user, err := p.fetchUser(ctx, token)
	if err != nil {
		return OAuthProfile{}, err
	}

	email := user.Email
	emailVerified := false
	if email == nil || strings.TrimSpace(*email) == "" {
		email = p.fetchPrimaryEmail(ctx, token)
		if email != nil {
			emailVerified = true
		}
	} else {
		// public email from /user is not guaranteed verified
		emailVerified = false
	}

	profile := OAuthProfile{
		Provider:       ProviderGitHub,
		ProviderUserID: fmt.Sprintf("%d", user.ID),
		DisplayName:    user.Name,
		AvatarURL:      user.AvatarURL,
		Email:          email,
		EmailVerified:  emailVerified,
	}
	return profile, nil
}

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

func (p *GitHubProvider) fetchUser(ctx context.Context, token string) (*githubUser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "gde-kofe-backend")

	resp, err := p.HTTPClient.Do(req)
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

func (p *GitHubProvider) fetchPrimaryEmail(ctx context.Context, token string) *string {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user/emails", nil)
	if err != nil {
		return nil
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "gde-kofe-backend")

	resp, err := p.HTTPClient.Do(req)
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
