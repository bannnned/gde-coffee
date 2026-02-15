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
	ID            string              `json:"id"`
	Name          string              `json:"name"`
	Address       string              `json:"address"`
	Description   *string             `json:"description,omitempty"`
	Latitude      float64             `json:"latitude"`
	Longitude     float64             `json:"longitude"`
	Amenities     []string            `json:"amenities"`
	DistanceM     float64             `json:"distance_m"`
	CoverPhotoURL *string             `json:"cover_photo_url,omitempty"`
	Photos        []CafePhotoResponse `json:"photos,omitempty"`
}

type CafePhotoResponse struct {
	ID       string `json:"id"`
	URL      string `json:"url"`
	Kind     string `json:"kind"`
	IsCover  bool   `json:"is_cover"`
	Position int    `json:"position"`
}
