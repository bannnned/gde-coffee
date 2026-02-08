package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type VKProvider struct {
	ClientID     string
	ClientSecret string
	Scope        string
	APIVersion   string
	HTTPClient   *http.Client
}

func NewVKProvider(clientID, clientSecret, scope, apiVersion string) *VKProvider {
	if scope == "" {
		scope = "email"
	}
	if apiVersion == "" {
		apiVersion = "5.131"
	}
	return &VKProvider{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Scope:        scope,
		APIVersion:   apiVersion,
		HTTPClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (p *VKProvider) Provider() Provider {
	return ProviderVK
}

func (p *VKProvider) AuthURL(state, redirectURI string) string {
	params := url.Values{}
	params.Set("client_id", p.ClientID)
	params.Set("redirect_uri", redirectURI)
	params.Set("response_type", "code")
	if strings.TrimSpace(p.Scope) != "" {
		params.Set("scope", p.Scope)
	}
	params.Set("state", state)
	params.Set("display", "page")
	if p.APIVersion != "" {
		params.Set("v", p.APIVersion)
	}
	return "https://oauth.vk.com/authorize?" + params.Encode()
}

func (p *VKProvider) Exchange(ctx context.Context, code, redirectURI string) (string, error) {
	meta, err := p.ExchangeWithMeta(ctx, code, redirectURI)
	if err != nil {
		return "", err
	}
	return meta.AccessToken, nil
}

func (p *VKProvider) ExchangeWithMeta(ctx context.Context, code, redirectURI string) (OAuthToken, error) {
	form := url.Values{}
	form.Set("client_id", p.ClientID)
	form.Set("client_secret", p.ClientSecret)
	form.Set("redirect_uri", redirectURI)
	form.Set("code", code)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth.vk.com/access_token", strings.NewReader(form.Encode()))
	if err != nil {
		return OAuthToken{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := p.HTTPClient.Do(req)
	if err != nil {
		return OAuthToken{}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return OAuthToken{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return OAuthToken{}, fmt.Errorf("vk token exchange status %d", resp.StatusCode)
	}

	var out vkTokenResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return OAuthToken{}, err
	}
	if out.Error != "" {
		return OAuthToken{}, fmt.Errorf("vk token exchange error: %s", out.Error)
	}
	if out.AccessToken == "" {
		return OAuthToken{}, fmt.Errorf("vk token missing")
	}

	var email *string
	emailVerified := false
	if strings.TrimSpace(out.Email) != "" {
		val := out.Email
		email = &val
		emailVerified = true
	}

	return OAuthToken{
		AccessToken:   out.AccessToken,
		Email:         email,
		EmailVerified: emailVerified,
	}, nil
}

func (p *VKProvider) FetchProfile(ctx context.Context, token string) (OAuthProfile, error) {
	params := url.Values{}
	params.Set("access_token", token)
	params.Set("v", p.APIVersion)
	params.Set("fields", "photo_200")

	urlStr := "https://api.vk.com/method/users.get?" + params.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, urlStr, nil)
	if err != nil {
		return OAuthProfile{}, err
	}
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
		return OAuthProfile{}, fmt.Errorf("vk profile status %d", resp.StatusCode)
	}

	var out vkUserResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return OAuthProfile{}, err
	}
	if out.Error != nil {
		return OAuthProfile{}, fmt.Errorf("vk api error %d", out.Error.ErrorCode)
	}
	if len(out.Response) == 0 {
		return OAuthProfile{}, fmt.Errorf("vk profile empty")
	}

	user := out.Response[0]
	displayName := strings.TrimSpace(strings.Join([]string{user.FirstName, user.LastName}, " "))
	var namePtr *string
	if displayName != "" {
		namePtr = &displayName
	}

	var avatarPtr *string
	if strings.TrimSpace(user.Photo200) != "" {
		avatar := user.Photo200
		avatarPtr = &avatar
	}

	return OAuthProfile{
		Provider:       ProviderVK,
		ProviderUserID: strconv.FormatInt(user.ID, 10),
		DisplayName:    namePtr,
		AvatarURL:      avatarPtr,
		Email:          nil,
		EmailVerified:  false,
	}, nil
}

type vkTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	UserID      int64  `json:"user_id"`
	Email       string `json:"email"`
	Error       string `json:"error"`
	ErrorDesc   string `json:"error_description"`
}

type vkAPIError struct {
	ErrorCode int    `json:"error_code"`
	ErrorMsg  string `json:"error_msg"`
}

type vkUserResponse struct {
	Response []vkUser    `json:"response"`
	Error    *vkAPIError `json:"error"`
}

type vkUser struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Photo200  string `json:"photo_200"`
}
