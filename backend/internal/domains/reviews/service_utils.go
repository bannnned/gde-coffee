package reviews

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"math"
	"sort"
	"strings"
)

func sanitizePublishReviewRequest(req PublishReviewRequest) PublishReviewRequest {
	clean := PublishReviewRequest{
		CafeID:     strings.TrimSpace(req.CafeID),
		Rating:     req.Rating,
		DrinkName:  strings.TrimSpace(req.DrinkName),
		Summary:    strings.TrimSpace(req.Summary),
		PhotoCount: req.PhotoCount,
	}
	if clean.PhotoCount < 0 {
		clean.PhotoCount = 0
	}

	clean.TasteTags = normalizeTags(req.TasteTags)
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
