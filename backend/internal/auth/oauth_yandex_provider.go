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

type YandexProvider struct {
	ClientID     string
	ClientSecret string
	Scope        string
	HTTPClient   *http.Client
}

func NewYandexProvider(clientID, clientSecret, scope string) *YandexProvider {
	if scope == "" {
		scope = "login:email login:info"
	}
	return &YandexProvider{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Scope:        scope,
		HTTPClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (p *YandexProvider) Provider() Provider {
	return ProviderYandex
}

func (p *YandexProvider) AuthURL(state, redirectURI string) string {
	params := url.Values{}
	params.Set("client_id", p.ClientID)
	params.Set("redirect_uri", redirectURI)
	params.Set("response_type", "code")
	params.Set("scope", p.Scope)
	params.Set("state", state)
	return "https://oauth.yandex.ru/authorize?" + params.Encode()
}

func (p *YandexProvider) Exchange(ctx context.Context, code, redirectURI string) (string, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("client_id", p.ClientID)
	form.Set("client_secret", p.ClientSecret)
	form.Set("redirect_uri", redirectURI)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth.yandex.ru/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

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
		return "", fmt.Errorf("yandex token exchange status %d", resp.StatusCode)
	}

	var out yandexTokenResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return "", err
	}
	if out.AccessToken == "" {
		return "", fmt.Errorf("yandex token missing")
	}
	return out.AccessToken, nil
}

func (p *YandexProvider) FetchProfile(ctx context.Context, token string) (OAuthProfile, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://login.yandex.ru/info?format=json", nil)
	if err != nil {
		return OAuthProfile{}, err
	}
	req.Header.Set("Authorization", "OAuth "+token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "gde-kofe-backend")

	resp, err := p.HTTPClient.Do(req)
	if err != nil {
		return OAuthProfile{}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return OAuthProfile{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return OAuthProfile{}, fmt.Errorf("yandex profile status %d", resp.StatusCode)
	}

	var prof yandexProfile
	if err := json.Unmarshal(body, &prof); err != nil {
		return OAuthProfile{}, err
	}
	if strings.TrimSpace(prof.ID) == "" {
		return OAuthProfile{}, fmt.Errorf("yandex profile missing id")
	}

	var displayName *string
	if strings.TrimSpace(prof.DisplayName) != "" {
		val := prof.DisplayName
		displayName = &val
	} else if strings.TrimSpace(prof.RealName) != "" {
		val := prof.RealName
		displayName = &val
	} else if strings.TrimSpace(prof.Login) != "" {
		val := prof.Login
		displayName = &val
	}

	email := pickYandexEmail(prof)
	emailVerified := false
	if email != nil && strings.TrimSpace(*email) != "" {
		emailVerified = true
	}

	var avatarURL *string
	if strings.TrimSpace(prof.DefaultAvatarID) != "" && !prof.IsAvatarEmpty {
		val := fmt.Sprintf("https://avatars.yandex.net/get-yapic/%s/islands-200", prof.DefaultAvatarID)
		avatarURL = &val
	}

	return OAuthProfile{
		Provider:       ProviderYandex,
		ProviderUserID: prof.ID,
		Email:          email,
		EmailVerified:  emailVerified,
		DisplayName:    displayName,
		AvatarURL:      avatarURL,
	}, nil
}

type yandexTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

type yandexProfile struct {
	ID              string   `json:"id"`
	Login           string   `json:"login"`
	DisplayName     string   `json:"display_name"`
	RealName        string   `json:"real_name"`
	DefaultEmail    string   `json:"default_email"`
	Emails          []string `json:"emails"`
	DefaultAvatarID string   `json:"default_avatar_id"`
	IsAvatarEmpty   bool     `json:"is_avatar_empty"`
}

func pickYandexEmail(prof yandexProfile) *string {
	if strings.TrimSpace(prof.DefaultEmail) != "" {
		val := prof.DefaultEmail
		return &val
	}
	for _, e := range prof.Emails {
		if strings.TrimSpace(e) != "" {
			val := e
			return &val
		}
	}
	return nil
}
