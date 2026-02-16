package reviews

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"math"
	"net/url"
	"regexp"
	"sort"
	"strings"
)

func sanitizePublishReviewRequest(req PublishReviewRequest) PublishReviewRequest {
	clean := PublishReviewRequest{
		CafeID:  strings.TrimSpace(req.CafeID),
		Rating:  req.Rating,
		DrinkID: strings.TrimSpace(req.DrinkID),
		Summary: strings.TrimSpace(req.Summary),
	}
	clean.TasteTags = normalizeTags(req.TasteTags)
	clean.Photos = normalizePhotos(req.Photos)
	return clean
}

func normalizeTags(tags []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(tags))
	for _, raw := range tags {
		tag := strings.ToLower(strings.TrimSpace(raw))
		if tag == "" {
			continue
		}
		if _, ok := seen[tag]; ok {
			continue
		}
		seen[tag] = struct{}{}
		out = append(out, tag)
		if len(out) >= 10 {
			break
		}
	}
	sort.Strings(out)
	return out
}

func normalizePhotos(photos []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(photos))
	for _, raw := range photos {
		value := strings.TrimSpace(raw)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
		if len(out) >= 8 {
			break
		}
	}
	return out
}

func validPhotoURL(raw string) bool {
	value := strings.TrimSpace(raw)
	if value == "" {
		return false
	}
	if strings.HasPrefix(value, "/") {
		return true
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed == nil {
		return false
	}
	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if scheme != "http" && scheme != "https" {
		return false
	}
	return strings.TrimSpace(parsed.Host) != ""
}

var (
	reMultiSpace = regexp.MustCompile(`\s+`)
	reWordToken  = regexp.MustCompile(`[\p{L}\p{N}]+`)
	reURLLike    = regexp.MustCompile(`(?i)(https?://|www\.|t\.me/|telegram\.me/)`)
)

func normalizeSummaryForFingerprint(value string) string {
	lowered := strings.ToLower(strings.TrimSpace(value))
	if lowered == "" {
		return ""
	}
	normalized := reMultiSpace.ReplaceAllString(lowered, " ")
	return strings.TrimSpace(normalized)
}

func summaryFingerprint(value string) string {
	normalized := normalizeSummaryForFingerprint(value)
	if normalized == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(normalized))
	return hex.EncodeToString(sum[:])
}

func looksLikeSpamSummary(value string) bool {
	summary := strings.TrimSpace(value)
	if summary == "" {
		return false
	}
	if reURLLike.MatchString(summary) {
		return true
	}

	// Heuristic anti-spam check:
	// long identical rune runs and highly repetitive token patterns are usually low-signal spam.
	runes := []rune(strings.ToLower(summary))
	run := 1
	maxRun := 1
	for i := 1; i < len(runes); i++ {
		if runes[i] == runes[i-1] {
			run++
			if run > maxRun {
				maxRun = run
			}
			continue
		}
		run = 1
	}
	if maxRun >= 8 {
		return true
	}

	tokens := reWordToken.FindAllString(strings.ToLower(summary), -1)
	if len(tokens) < 6 {
		return false
	}

	maxFreq := 0
	unique := map[string]struct{}{}
	freq := map[string]int{}
	for _, token := range tokens {
		if token == "" {
			continue
		}
		unique[token] = struct{}{}
		freq[token]++
		if freq[token] > maxFreq {
			maxFreq = freq[token]
		}
	}

	if maxFreq*2 >= len(tokens) {
		return true
	}
	return len(tokens) >= 12 && len(unique) <= 3
}

func payloadString(payload map[string]interface{}, key string) string {
	if payload == nil {
		return ""
	}
	value, ok := payload[key]
	if !ok || value == nil {
		return ""
	}
	str, _ := value.(string)
	return strings.TrimSpace(str)
}

func requestHash(value interface{}) string {
	payload, _ := json.Marshal(value)
	h := sha256.Sum256(payload)
	return hex.EncodeToString(h[:])
}

func clamp(value, low, high float64) float64 {
	if value < low {
		return low
	}
	if value > high {
		return high
	}
	return value
}

func roundFloat(value float64, decimals int) float64 {
	if decimals < 0 {
		return value
	}
	factor := math.Pow10(decimals)
	return math.Round(value*factor) / factor
}

func utfRuneLen(value string) int {
	return len([]rune(strings.TrimSpace(value)))
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func truncateError(value string) string {
	if len(value) <= 4000 {
		return value
	}
	return value[:4000]
}
