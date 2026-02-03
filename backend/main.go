package main

import (
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/config"
	"backend/internal/data"
	"backend/internal/model"
)

func getCafes(cfg config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		latStr := strings.TrimSpace(c.Query("lat"))
		lngStr := strings.TrimSpace(c.Query("lng"))
		radiusStr := strings.TrimSpace(c.Query("radius_m"))

		if latStr == "" || lngStr == "" || radiusStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "lat, lng, and radius_m are required"})
			return
		}

		lat, err := parseFloat(latStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lat"})
			return
		}

		lng, err := parseFloat(lngStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lng"})
			return
		}

		radiusM, err := parseFloat(radiusStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid radius_m"})
			return
		}

		if radiusM < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "radius_m must be >= 0"})
			return
		}

		sortBy := strings.TrimSpace(c.DefaultQuery("sort", config.DefaultSort))
		if sortBy != config.SortByDistance && sortBy != config.SortByWork {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sort must be 'work' or 'distance'"})
			return
		}

		limit, err := parseLimit(c.Query("limit"), cfg.Limits)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		requiredAmenities := parseAmenities(c.Query("amenities"))

		results := make([]model.CafeResponse, 0, len(data.Cafes))
		for _, cafe := range data.Cafes {
			if len(requiredAmenities) > 0 && !hasAllAmenities(cafe.Amenities, requiredAmenities) {
				continue
			}

			distanceM := haversineMeters(lat, lng, cafe.Latitude, cafe.Longitude)
			if radiusM > 0 && distanceM > radiusM {
				continue
			}

			results = append(results, model.CafeResponse{
				ID:        cafe.ID,
				Name:      cafe.Name,
				Address:   cafe.Address,
				Latitude:  cafe.Latitude,
				Longitude: cafe.Longitude,
				Amenities: cafe.Amenities,
				DistanceM: distanceM,
				WorkScore: computeWorkScore(cafe.Amenities),
			})
		}

		sortCafes(results, sortBy)

		if limit > 0 && len(results) > limit {
			results = results[:limit]
		}

		c.JSON(http.StatusOK, results)
	}
}

func parseFloat(value string) (float64, error) {
	return strconv.ParseFloat(value, 64)
}

func parseAmenities(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	amenities := make([]string, 0, len(parts))
	for _, part := range parts {
		amenity := strings.ToLower(strings.TrimSpace(part))
		if amenity == "" {
			continue
		}
		amenities = append(amenities, amenity)
	}

	return amenities
}

func parseLimit(raw string, limits config.LimitsConfig) (int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return limits.DefaultResults, nil
	}

	limit, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("limit must be an integer")
	}
	if limit <= 0 {
		return 0, fmt.Errorf("limit must be > 0")
	}
	if limits.MaxResults > 0 && limit > limits.MaxResults {
		return 0, fmt.Errorf("limit must be <= %d", limits.MaxResults)
	}
	return limit, nil
}

func hasAllAmenities(cafeAmenities, required []string) bool {
	if len(required) == 0 {
		return true
	}

	cafeSet := make(map[string]struct{}, len(cafeAmenities))
	for _, amenity := range cafeAmenities {
		cafeSet[strings.ToLower(strings.TrimSpace(amenity))] = struct{}{}
	}

	for _, amenity := range required {
		if _, ok := cafeSet[amenity]; !ok {
			return false
		}
	}

	return true
}

func computeWorkScore(amenities []string) float64 {
	score := config.WorkScoreBase

	for _, amenity := range amenities {
		amenity = strings.ToLower(strings.TrimSpace(amenity))
		if weight, ok := config.WorkScoreWeights[amenity]; ok {
			score += weight
		}
	}

	if score > config.WorkScoreMax {
		return config.WorkScoreMax
	}
	return score
}

func sortCafes(cafes []model.CafeResponse, sortBy string) {
	switch sortBy {
	case "work":
		sort.Slice(cafes, func(i, j int) bool {
			if cafes[i].WorkScore == cafes[j].WorkScore {
				return cafes[i].DistanceM < cafes[j].DistanceM
			}
			return cafes[i].WorkScore > cafes[j].WorkScore
		})
	default:
		sort.Slice(cafes, func(i, j int) bool {
			return cafes[i].DistanceM < cafes[j].DistanceM
		})
	}
}

func haversineMeters(lat1, lng1, lat2, lng2 float64) float64 {
	lat1Rad := lat1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return config.EarthRadiusM * c
}

func serveStaticOrIndex(c *gin.Context, publicDir string) {
	requestPath := c.Request.URL.Path
	if strings.HasPrefix(requestPath, "/api/") || requestPath == "/api" {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	cleanPath := path.Clean("/" + requestPath)
	relPath := strings.TrimPrefix(cleanPath, "/")
	if relPath != "" {
		fullPath := filepath.Join(publicDir, filepath.FromSlash(relPath))
		if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
			c.File(fullPath)
			return
		}
	}

	indexPath := filepath.Join(publicDir, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "index.html not found"})
		return
	}
	c.File(indexPath)
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	gin.SetMode(gin.ReleaseMode)

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	// Health endpoints
	r.GET("/_health", func(c *gin.Context) { c.String(http.StatusOK, "ok") })
	r.HEAD("/_health", func(c *gin.Context) { c.Status(http.StatusOK) })

	r.GET("/", func(c *gin.Context) { c.String(http.StatusOK, "ok") })
	r.HEAD("/", func(c *gin.Context) { c.Status(http.StatusOK) })

	// API
	api := r.Group("/api")
	api.GET("/cafes", getCafes(cfg))
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// SPA
	r.NoRoute(func(c *gin.Context) {
		serveStaticOrIndex(c, cfg.PublicDir)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("listening on 0.0.0.0:%s", port)
	log.Fatal(r.Run("0.0.0.0:" + port))
}
