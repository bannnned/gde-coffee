package validation

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"backend/internal/config"
)

var uuidPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
var allowedAmenities = map[string]struct{}{
	"wifi":   {},
	"power":  {},
	"quiet":  {},
	"toilet": {},
	"laptop": {},
}

func ParseFloat(value string) (float64, error) {
	return strconv.ParseFloat(strings.TrimSpace(value), 64)
}

func IsFinite(value float64) bool {
	return !math.IsInf(value, 0) && !math.IsNaN(value)
}

func ParseAmenities(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	amenities := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		amenity, ok := NormalizeAmenity(part)
		if !ok {
			continue
		}
		if _, already := seen[amenity]; already {
			continue
		}
		seen[amenity] = struct{}{}
		amenities = append(amenities, amenity)
	}

	return amenities
}

func NormalizeAmenity(raw string) (string, bool) {
	amenity := strings.ToLower(strings.TrimSpace(raw))
	if amenity == "" {
		return "", false
	}
	if _, ok := allowedAmenities[amenity]; !ok {
		return "", false
	}
	return amenity, true
}

func ParseLimit(raw string, limits config.LimitsConfig) (int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return limits.DefaultResults, nil
	}

	limit, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("limit должен быть целым числом")
	}
	if limit <= 0 {
		return 0, fmt.Errorf("limit должен быть больше 0")
	}
	if limits.MaxResults > 0 && limit > limits.MaxResults {
		return 0, fmt.Errorf("limit должен быть <= %d", limits.MaxResults)
	}
	return limit, nil
}

func IsValidUUID(value string) bool {
	return uuidPattern.MatchString(strings.TrimSpace(value))
}
