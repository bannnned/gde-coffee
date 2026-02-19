package cafes

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"strings"
)

type normalizedCafeImportItem struct {
	Name            string
	Address         string
	Latitude        float64
	Longitude       float64
	Description     string
	HasDescription  bool
	Amenities       []string
	HasAmenitiesRaw bool
}

func decodeAdminCafeImportRequest(raw []byte) (adminCafeImportRequest, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return adminCafeImportRequest{}, fmt.Errorf("пустой JSON")
	}

	var wrapped adminCafeImportRequest
	if err := json.Unmarshal(trimmed, &wrapped); err == nil && wrapped.Cafes != nil {
		return wrapped, nil
	}

	var list []adminCafeImportItem
	if err := json.Unmarshal(trimmed, &list); err == nil {
		return adminCafeImportRequest{Cafes: list}, nil
	}

	if err := json.Unmarshal(trimmed, &wrapped); err != nil {
		return adminCafeImportRequest{}, err
	}
	return wrapped, nil
}

func normalizeAdminCafeImportMode(raw string) (string, error) {
	mode := strings.ToLower(strings.TrimSpace(raw))
	if mode == "" {
		return AdminCafeImportModeSkipExisting, nil
	}
	switch mode {
	case "skip", "skip_existing", "create_only":
		return AdminCafeImportModeSkipExisting, nil
	case "upsert":
		return AdminCafeImportModeUpsert, nil
	default:
		return "", fmt.Errorf("mode должен быть skip_existing или upsert")
	}
}

func normalizeCafeImportItem(raw adminCafeImportItem) (normalizedCafeImportItem, []adminCafeImportIssue) {
	name := strings.TrimSpace(raw.Name)
	address := strings.TrimSpace(raw.Address)

	issues := make([]adminCafeImportIssue, 0, 4)
	if name == "" {
		issues = append(issues, adminCafeImportIssue{
			Field:   "name",
			Message: "Название обязательно.",
		})
	}
	if address == "" {
		issues = append(issues, adminCafeImportIssue{
			Field:   "address",
			Message: "Адрес обязателен.",
		})
	}

	if raw.Latitude == nil {
		issues = append(issues, adminCafeImportIssue{
			Field:   "latitude",
			Message: "latitude обязателен.",
		})
	}
	if raw.Longitude == nil {
		issues = append(issues, adminCafeImportIssue{
			Field:   "longitude",
			Message: "longitude обязателен.",
		})
	}

	lat := 0.0
	lng := 0.0
	if raw.Latitude != nil {
		lat = *raw.Latitude
		if !isFinite(lat) || lat < -90 || lat > 90 {
			issues = append(issues, adminCafeImportIssue{
				Field:   "latitude",
				Message: "latitude должен быть в диапазоне от -90 до 90.",
			})
		}
	}
	if raw.Longitude != nil {
		lng = *raw.Longitude
		if !isFinite(lng) || lng < -180 || lng > 180 {
			issues = append(issues, adminCafeImportIssue{
				Field:   "longitude",
				Message: "longitude должен быть в диапазоне от -180 до 180.",
			})
		}
	}

	description := ""
	hasDescription := false
	if raw.Description != nil {
		hasDescription = true
		description = strings.TrimSpace(*raw.Description)
		if len([]rune(description)) > MaxDescriptionChars {
			issues = append(issues, adminCafeImportIssue{
				Field:   "description",
				Message: fmt.Sprintf("Описание слишком длинное, максимум %d символов.", MaxDescriptionChars),
			})
		}
	}

	amenities := normalizeAmenityList(raw.Amenities)
	if len(amenities) > 0 {
		filtered := make([]string, 0, len(amenities))
		for _, amenity := range amenities {
			if len([]rune(amenity)) > 50 {
				issues = append(issues, adminCafeImportIssue{
					Field:   "amenities",
					Message: "Каждая amenity должна быть не длиннее 50 символов.",
				})
				continue
			}
			filtered = append(filtered, amenity)
		}
		amenities = filtered
	}

	if len(issues) > 0 {
		return normalizedCafeImportItem{}, issues
	}

	return normalizedCafeImportItem{
		Name:            name,
		Address:         address,
		Latitude:        lat,
		Longitude:       lng,
		Description:     description,
		HasDescription:  hasDescription,
		Amenities:       amenities,
		HasAmenitiesRaw: raw.Amenities != nil,
	}, nil
}

func isFinite(value float64) bool {
	return !math.IsInf(value, 0) && !math.IsNaN(value)
}

func normalizeAmenityList(raw []string) []string {
	if len(raw) == 0 {
		return nil
	}
	out := make([]string, 0, len(raw))
	seen := make(map[string]struct{}, len(raw))
	for _, item := range raw {
		value := strings.ToLower(strings.TrimSpace(item))
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}
