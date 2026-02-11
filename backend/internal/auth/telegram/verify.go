package telegram

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	CodeInvalidSignature = "invalid_signature"
	CodeExpired          = "expired"
	CodeBadPayload       = "bad_payload"
)

const clockSkew = 2 * time.Minute

type LoginPayload struct {
	ID        int64
	Username  string
	FirstName string
	LastName  string
	PhotoURL  string
	AuthDate  int64
	Hash      string
}

type VerifyError struct {
	Code string
	Err  error
}

func (e *VerifyError) Error() string {
	if e == nil {
		return ""
	}
	if e.Err != nil {
		return e.Code + ": " + e.Err.Error()
	}
	return e.Code
}

func (e *VerifyError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func ErrorCode(err error) string {
	var v *VerifyError
	if errors.As(err, &v) {
		return v.Code
	}
	return ""
}

func VerifyLoginPayload(p LoginPayload, botToken string, maxAge time.Duration, now time.Time) error {
	if strings.TrimSpace(botToken) == "" {
		return &VerifyError{Code: CodeBadPayload, Err: errors.New("bot token missing")}
	}
	if p.ID == 0 || p.AuthDate == 0 || strings.TrimSpace(p.Hash) == "" {
		return &VerifyError{Code: CodeBadPayload, Err: errors.New("missing required fields")}
	}

	authTime := time.Unix(p.AuthDate, 0)
	if authTime.After(now.Add(clockSkew)) {
		return &VerifyError{Code: CodeBadPayload, Err: errors.New("auth_date is in the future")}
	}
	if now.Sub(authTime) > maxAge {
		return &VerifyError{Code: CodeExpired, Err: errors.New("auth_date expired")}
	}

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
	expected := mac.Sum(nil)

	hashStr := strings.ToLower(strings.TrimSpace(p.Hash))
	got, err := hex.DecodeString(hashStr)
	if err != nil {
		return &VerifyError{Code: CodeBadPayload, Err: errors.New("hash is not hex")}
	}
	if !hmac.Equal(expected, got) {
		return &VerifyError{Code: CodeInvalidSignature, Err: errors.New("hash mismatch")}
	}
	return nil
}
