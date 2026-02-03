package config

const (
	EarthRadiusM   = 6371000.0
	DefaultSort    = "distance"
	SortByDistance = "distance"
	SortByWork     = "work"
	WorkScoreBase  = 40.0
	WorkScoreMax   = 100.0
)

var (
	WorkScoreWeights = map[string]float64{
		"wifi":  25,
		"power": 25,
		"quiet": 10,
	}
)
