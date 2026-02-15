package auth

import (
	"context"
	"net/http"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

const (
	displayNameMinChars = 2
	displayNameMaxChars = 40
)

var displayNamePattern = regexp.MustCompile(`^[\p{L}\p{N}][\p{L}\p{N} ._\-]*[\p{L}\p{N}]$`)

var forbiddenNicknamePatterns = []*regexp.Regexp{
	regexp.MustCompile(`^(хуй|хуйня|хуев|хуёв|хуесос|хуило)\p{L}*$`),
	regexp.MustCompile(`^(пизд)\p{L}*$`),
	regexp.MustCompile(`^(еб|ёб)\p{L}*$`),
	regexp.MustCompile(`^(бля|бляд)\p{L}*$`),
	regexp.MustCompile(`^(сука|суки|сучка|сучки)$`),
	regexp.MustCompile(`^(мудак|мудач)\p{L}*$`),
	regexp.MustCompile(`^(гандон)\p{L}*$`),
	regexp.MustCompile(`^(пидор|пидарас|пидр)\p{L}*$`),
	regexp.MustCompile(`^(шлюх)\p{L}*$`),
	regexp.MustCompile(`^(fuck|fck|shit|bitch|cunt|dick|cock|pussy|whore|slut|faggot|nigger)\p{L}*$`),
	regexp.MustCompile(`^(blyat|blyad|ebat|pizd|huy|xuy)\p{L}*$`),
}

type profileNameUpdateRequest struct {
	DisplayName string `json:"display_name"`
	Name        string `json:"displayName"`
}

func (h Handler) ProfileNameUpdate(c *gin.Context) {
	userID, ok := UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
		return
	}

	var req profileNameUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "invalid json body", nil)
		return
	}

	raw := strings.TrimSpace(req.DisplayName)
	if raw == "" {
		raw = strings.TrimSpace(req.Name)
	}
	displayName := normalizeDisplayName(raw)
	if displayName == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "display_name is required", nil)
		return
	}
	if utf8.RuneCountInString(displayName) < displayNameMinChars {
		respondError(c, http.StatusBadRequest, "invalid_argument", "display_name is too short", gin.H{
			"min_chars": displayNameMinChars,
		})
		return
	}
	if utf8.RuneCountInString(displayName) > displayNameMaxChars {
		respondError(c, http.StatusBadRequest, "invalid_argument", "display_name is too long", gin.H{
			"max_chars": displayNameMaxChars,
		})
		return
	}
	if !displayNamePattern.MatchString(displayName) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "display_name has invalid characters", nil)
		return
	}
	if containsForbiddenNickname(displayName) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "display_name is not allowed", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), queryTimeout)
	defer cancel()

	var user User
	err := h.Pool.QueryRow(
		ctx,
		`update users
		    set display_name = $2
		  where id = $1
		  returning id::text, coalesce(email_normalized, ''), display_name, avatar_url, email_verified_at, role`,
		userID,
		displayName,
	).Scan(&user.ID, &user.Email, &user.DisplayName, &user.AvatarURL, &user.EmailVerifiedAt, &user.Role)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db update failed", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func normalizeDisplayName(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func containsForbiddenNickname(value string) bool {
	for _, token := range tokenizeForModeration(value) {
		for _, pattern := range forbiddenNicknamePatterns {
			if pattern.MatchString(token) {
				return true
			}
		}
	}
	return false
}

func tokenizeForModeration(value string) []string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.ReplaceAll(normalized, "ё", "е")

	tokens := make([]string, 0, 6)
	var b strings.Builder
	flush := func() {
		if b.Len() == 0 {
			return
		}
		token := collapseRepeatingRunes(b.String())
		if token != "" {
			tokens = append(tokens, token)
		}
		b.Reset()
	}

	for _, r := range normalized {
		if mapped, ok := mapLeetRune(r); ok {
			b.WriteRune(mapped)
			continue
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			continue
		}
		flush()
	}
	flush()
	return tokens
}

func mapLeetRune(r rune) (rune, bool) {
	switch r {
	case '0':
		return 'o', true
	case '1', '!':
		return 'i', true
	case '3':
		return 'e', true
	case '4', '@':
		return 'a', true
	case '5', '$':
		return 's', true
	case '7':
		return 't', true
	default:
		return 0, false
	}
}

func collapseRepeatingRunes(value string) string {
	if value == "" {
		return ""
	}
	var b strings.Builder
	var prev rune
	count := 0
	for i, r := range value {
		if i == 0 {
			prev = r
			count = 1
			b.WriteRune(r)
			continue
		}
		if r == prev {
			count++
			if count <= 2 {
				b.WriteRune(r)
			}
			continue
		}
		prev = r
		count = 1
		b.WriteRune(r)
	}
	return b.String()
}
