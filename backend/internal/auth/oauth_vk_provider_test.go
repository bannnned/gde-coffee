package auth

import (
	"net/url"
	"testing"
)

func TestNormalizeVKScope(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "empty", input: "", want: ""},
		{name: "spaces", input: "   ", want: ""},
		{name: "single", input: "email", want: "email"},
		{name: "mixed separators", input: "email profile;friends", want: "email,profile,friends"},
		{name: "duplicates", input: "email, email profile", want: "email,profile"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeVKScope(tt.input)
			if got != tt.want {
				t.Fatalf("normalizeVKScope(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestVKAuthURLSkipsScopeWhenEmpty(t *testing.T) {
	p := NewVKProvider("client", "secret", "", "5.131")
	authURL := p.AuthURL("state", "https://gde-kofe.ru/api/auth/vk/callback")

	parsed, err := url.Parse(authURL)
	if err != nil {
		t.Fatalf("parse auth url: %v", err)
	}

	values := parsed.Query()
	if _, ok := values["scope"]; ok {
		t.Fatalf("expected scope to be omitted when empty, got %q", values.Get("scope"))
	}
}
