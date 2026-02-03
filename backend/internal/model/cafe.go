package model

type Cafe struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Address   string   `json:"address"`
	Latitude  float64  `json:"latitude"`
	Longitude float64  `json:"longitude"`
	Amenities []string `json:"amenities"`
}

type CafeResponse struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Address   string   `json:"address"`
	Latitude  float64  `json:"latitude"`
	Longitude float64  `json:"longitude"`
	Amenities []string `json:"amenities"`
	DistanceM float64  `json:"distance_m"`
	WorkScore float64  `json:"work_score"`
}
