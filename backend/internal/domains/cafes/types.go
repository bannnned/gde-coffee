package cafes

import "backend/internal/model"

const MaxDescriptionChars = 2000

type ListParams struct {
	Latitude          float64
	Longitude         float64
	RadiusM           float64
	RequiredAmenities []string
	UserID            *string
	FavoritesOnly     bool
	Limit             int
}

type updateDescriptionRequest struct {
	Description string `json:"description"`
}

type GeocodeLookupResponse struct {
	Found       bool    `json:"found"`
	Latitude    float64 `json:"latitude,omitempty"`
	Longitude   float64 `json:"longitude,omitempty"`
	DisplayName string  `json:"display_name,omitempty"`
	Provider    string  `json:"provider,omitempty"`
}

type ListResult []model.CafeResponse
