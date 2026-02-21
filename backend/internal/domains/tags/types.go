package tags

const (
	CategoryDescriptive = "descriptive"

	DefaultLimit = 8
	MaxLimit     = 30

	DefaultOptionsLimit = 80
	MaxOptionsLimit     = 200

	MaxPreferenceTags = 12
)

type GeoScope struct {
	Latitude  float64
	Longitude float64
	RadiusM   float64
}

type DiscoveryTag struct {
	Label    string  `json:"label"`
	Category string  `json:"category"`
	Score    float64 `json:"score"`
}

type DiscoveryResponse struct {
	Source string         `json:"source"`
	Tags   []DiscoveryTag `json:"tags"`
}

type OptionsResponse struct {
	Tags []string `json:"tags"`
}

type PreferencesResponse struct {
	Category string   `json:"category"`
	Tags     []string `json:"tags"`
}

type upsertPreferencesRequest struct {
	Tags []string `json:"tags"`
}

type popularTagRow struct {
	Key       string
	Label     string
	Cafes     int
	AvgWeight float64
}
