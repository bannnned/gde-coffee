package cafes

import "backend/internal/model"

const MaxDescriptionChars = 2000

const (
	AdminCafeImportModeSkipExisting = "skip_existing"
	AdminCafeImportModeUpsert       = "upsert"
	AdminCafeImportMaxItems         = 1000
	AdminCafeImportMaxIssues        = 300
)

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

type adminCafeImportItem struct {
	Name        string   `json:"name"`
	Address     string   `json:"address"`
	Description *string  `json:"description"`
	Latitude    *float64 `json:"latitude"`
	Longitude   *float64 `json:"longitude"`
	Amenities   []string `json:"amenities"`
}

type adminCafeImportRequest struct {
	Mode   string                `json:"mode"`
	DryRun bool                  `json:"dry_run"`
	Cafes  []adminCafeImportItem `json:"cafes"`
}

type adminCafeImportIssue struct {
	Index   int    `json:"index"`
	Field   string `json:"field,omitempty"`
	Message string `json:"message"`
}

type adminCafeImportResultItem struct {
	Index   int     `json:"index"`
	Status  string  `json:"status"`
	Name    string  `json:"name"`
	Address string  `json:"address"`
	CafeID  *string `json:"cafe_id,omitempty"`
	Message string  `json:"message,omitempty"`
}

type adminCafeImportSummary struct {
	Total   int `json:"total"`
	Created int `json:"created"`
	Updated int `json:"updated"`
	Skipped int `json:"skipped"`
	Invalid int `json:"invalid"`
	Failed  int `json:"failed"`
}

type adminCafeImportResponse struct {
	Mode    string                      `json:"mode"`
	DryRun  bool                        `json:"dry_run"`
	Summary adminCafeImportSummary      `json:"summary"`
	Results []adminCafeImportResultItem `json:"results"`
	Issues  []adminCafeImportIssue      `json:"issues,omitempty"`
}
