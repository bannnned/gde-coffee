package telegram

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"
)

func makeHash(botToken string, p LoginPayload) string {
	data := map[string]string{
		"id":        strconv.FormatInt(p.ID, 10),
		"auth_date": strconv.FormatInt(p.AuthDate, 10),
	}
	if strings.TrimSpace(p.Username) != "" {
		data["username"] = p.Username
	}
	if strings.TrimSpace(p.FirstName) != "" {
		data["first_name"] = p.FirstName
	}
	if strings.TrimSpace(p.LastName) != "" {
		data["last_name"] = p.LastName
	}
	if strings.TrimSpace(p.PhotoURL) != "" {
		data["photo_url"] = p.PhotoURL
	}

	keys := make([]string, 0, len(data))
	for k := range data {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	lines := make([]string, 0, len(keys))
	for _, k := range keys {
		lines = append(lines, k+"="+data[k])
	}
	dataCheck := strings.Join(lines, "\n")

	secretSum := sha256.Sum256([]byte(botToken))
	mac := hmac.New(sha256.New, secretSum[:])
	_, _ = mac.Write([]byte(dataCheck))
	return hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyLoginPayload_OK(t *testing.T) {
	botToken := "test-token"
	now := time.Now()
	p := LoginPayload{
		ID:        12345,
		Username:  "user",
		FirstName: "First",
		LastName:  "Last",
		PhotoURL:  "https://example.com/avatar.png",
		AuthDate:  now.Unix(),
	}
	p.Hash = makeHash(botToken, p)

	if err := VerifyLoginPayload(p, botToken, 10*time.Minute, now); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestVerifyLoginPayload_InvalidSignature(t *testing.T) {
	botToken := "test-token"
	now := time.Now()
	p := LoginPayload{
		ID:       12345,
		AuthDate: now.Unix(),
		Hash:     "deadbeef",
	}

	err := VerifyLoginPayload(p, botToken, 10*time.Minute, now)
	if err == nil || ErrorCode(err) != CodeInvalidSignature {
		t.Fatalf("expected invalid_signature, got %v", err)
	}
}

func TestVerifyLoginPayload_Expired(t *testing.T) {
	botToken := "test-token"
	now := time.Now()
	p := LoginPayload{
		ID:       12345,
		AuthDate: now.Add(-20 * time.Minute).Unix(),
	}
	p.Hash = makeHash(botToken, p)

	err := VerifyLoginPayload(p, botToken, 10*time.Minute, now)
	if err == nil || ErrorCode(err) != CodeExpired {
		t.Fatalf("expected expired, got %v", err)
	}
}
