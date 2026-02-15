package main

import (
	"context"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"backend/internal/auth"
	"backend/internal/config"
	"backend/internal/mailer"
	"backend/internal/media"
	"backend/internal/model"
	dbmigrations "backend/migrations"
)

func connectDB(dbURL string) (*pgxpool.Pool, error) {
	cfgPool, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, err
	}

	cfgPool.MinConns = 2
	cfgPool.MaxConns = 10
	cfgPool.ConnConfig.ConnectTimeout = 15 * time.Second

	ctxNew, cancelNew := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancelNew()

	pool, err := pgxpool.NewWithConfig(ctxNew, cfgPool)
	if err != nil {
		return nil, err
	}

	return pool, nil
}

func queryCafes(
	ctx context.Context,
	pool *pgxpool.Pool,
	lat, lng, radiusM float64,
	requiredAmenities []string,
	limit int,
	cfg config.Config,
) ([]model.CafeResponse, error) {

	dbLimit := limit
	if dbLimit <= 0 {
		dbLimit = cfg.Limits.DefaultResults
	}

	var amenitiesParam []string
	if len(requiredAmenities) > 0 {
		amenitiesParam = requiredAmenities
	} else {
		amenitiesParam = nil // РІР°Р¶РЅРѕ: Р±СѓРґРµС‚ NULL
	}

	// haversine РІ SQL (Р±РµР· PostGIS)
	const sqlDistance = `WITH params AS (
  SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS p
)
SELECT
  id::text AS id,
  name,
  address,
  COALESCE(description, '') AS description,
  lat,
  lng,
  COALESCE(amenities, '{}'::text[]) AS amenities,
  ST_Distance(geog, params.p) AS distance_m
FROM public.cafes, params
WHERE
  geog IS NOT NULL
  AND ($3 = 0 OR ST_DWithin(geog, params.p, $3))
  AND (
    $4::text[] IS NULL
    OR cardinality($4::text[]) = 0
    OR COALESCE(amenities, '{}'::text[]) @> $4::text[]
  )
ORDER BY distance_m ASC
LIMIT $5;`

	rows, err := pool.Query(ctx, sqlDistance, lat, lng, radiusM, amenitiesParam, dbLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.CafeResponse, 0, 32)
	for rows.Next() {
		var (
			id      string
			name    string
			address string
			desc    string
			latDB   float64
			lngDB   float64
			ams     []string
			dist    float64
		)

		if err := rows.Scan(&id, &name, &address, &desc, &latDB, &lngDB, &ams, &dist); err != nil {
			return nil, err
		}

		var description *string
		desc = strings.TrimSpace(desc)
		if desc != "" {
			description = &desc
		}

		out = append(out, model.CafeResponse{
			ID:          id,
			Name:        name,
			Address:     address,
			Description: description,
			Latitude:    latDB,
			Longitude:   lngDB,
			Amenities:   ams,
			DistanceM:   dist,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}

	if err := attachCafeCoverPhotos(ctx, pool, out, cfg.Media); err != nil {
		return nil, err
	}

	return out, nil
}

func getCafes(cfg config.Config, pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		const maxRadiusM = 50000.0

		latStr := strings.TrimSpace(c.Query("lat"))
		lngStr := strings.TrimSpace(c.Query("lng"))
		radiusStr := strings.TrimSpace(c.Query("radius_m"))

		if latStr == "" || lngStr == "" || radiusStr == "" {
			respondError(c, http.StatusBadRequest, "invalid_argument", "Параметры lat, lng и radius_m обязательны.", nil)
			return
		}

		lat, err := parseFloat(latStr)
		if err != nil {
			respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректное значение lat.", nil)
			return
		}
		if !isFinite(lat) {
			respondError(c, http.StatusBadRequest, "invalid_argument", "lat должен быть конечным числом.", nil)
			return
		}
		if lat < -90 || lat > 90 {
			respondError(c, http.StatusBadRequest, "invalid_argument", "lat должен быть в диапазоне от -90 до 90.", nil)
			return
		}

		lng, err := parseFloat(lngStr)
		if err != nil {
			respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректное значение lng.", nil)
			return
		}
		if !isFinite(lng) {
			respondError(c, http.StatusBadRequest, "invalid_argument", "lng должен быть конечным числом.", nil)
			return
		}
		if lng < -180 || lng > 180 {
			respondError(c, http.StatusBadRequest, "invalid_argument", "lng должен быть в диапазоне от -180 до 180.", nil)
			return
		}

		radiusM, err := parseFloat(radiusStr)
		if err != nil {
			respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректное значение radius_m.", nil)
			return
		}
		if !isFinite(radiusM) {
			respondError(c, http.StatusBadRequest, "invalid_argument", "radius_m должен быть конечным числом.", nil)
			return
		}

		if radiusM < 0 {
			respondError(c, http.StatusBadRequest, "invalid_argument", "radius_m должен быть >= 0.", nil)
			return
		}

		if radiusM > maxRadiusM {
			respondError(
				c,
				http.StatusBadRequest,
				"invalid_argument",
				"radius_m должен быть <= 50000.",
				gin.H{"max_radius_m": maxRadiusM},
			)
			return
		}

		sortBy := strings.TrimSpace(c.Query("sort"))
		if sortBy != "" && sortBy != config.SortByDistance {
			respondError(c, http.StatusBadRequest, "invalid_argument", "sort поддерживает только значение 'distance'.", nil)
			return
		}

		limit, err := parseLimit(c.Query("limit"), cfg.Limits)
		if err != nil {
			respondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
			return
		}

		requiredAmenities := parseAmenities(c.Query("amenities"))

		// С‚Р°Р№РјР°СѓС‚ РЅР° Р·Р°РїСЂРѕСЃ
		ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
		defer cancel()

		cafes, err := queryCafes(ctx, pool, lat, lng, radiusM, requiredAmenities, limit, cfg)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, cafes)
	}
}

func parseFloat(value string) (float64, error) {
	return strconv.ParseFloat(value, 64)
}

func isFinite(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
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

type apiError struct {
	Message string      `json:"message"`
	Code    string      `json:"code"`
	Details interface{} `json:"details,omitempty"`
}

func respondError(c *gin.Context, status int, code, message string, details interface{}) {
	c.JSON(status, apiError{
		Message: message,
		Code:    code,
		Details: details,
	})
}

func applyStaticCacheHeaders(c *gin.Context, relPath string, isSPAFallback bool) {
	normalized := strings.TrimPrefix(strings.ToLower(relPath), "/")

	if isSPAFallback || normalized == "" || normalized == "index.html" || normalized == "sw.js" || normalized == "manifest.webmanifest" {
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		return
	}

	if strings.HasPrefix(normalized, "assets/") {
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
		return
	}

	c.Header("Cache-Control", "public, max-age=3600")
}

func serveStaticOrIndex(c *gin.Context, publicDir string) {
	requestPath := c.Request.URL.Path
	if strings.HasPrefix(requestPath, "/api/") || requestPath == "/api" {
		respondError(c, http.StatusNotFound, "not_found", "Маршрут не найден.", nil)
		return
	}

	cleanPath := path.Clean("/" + requestPath)
	relPath := strings.TrimPrefix(cleanPath, "/")
	if relPath != "" {
		fullPath := filepath.Join(publicDir, filepath.FromSlash(relPath))
		if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
			applyStaticCacheHeaders(c, relPath, false)
			c.File(fullPath)
			return
		}
	}

	indexPath := filepath.Join(publicDir, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		respondError(c, http.StatusNotFound, "not_found", "Файл index.html не найден.", nil)
		return
	}
	applyStaticCacheHeaders(c, "index.html", true)
	c.File(indexPath)
}

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	log.Printf(
		"telegram env: bot_username=%q token_set=%t",
		strings.TrimSpace(cfg.Auth.TelegramBotUsername),
		strings.TrimSpace(cfg.Auth.TelegramBotToken) != "",
	)

	dbURL1 := os.Getenv("DATABASE_URL")
	dbURL2 := os.Getenv("DATABASE_URL_2")
	dbURL3 := os.Getenv("DATABASE_URL_3")

	if dbURL1 == "" && dbURL2 == "" && dbURL3 == "" {
		log.Fatal("DATABASE_URL or DATABASE_URL_2 or DATABASE_URL_3 is required")
	}

	var pool *pgxpool.Pool
	selectedDBURL := ""
	if dbURL1 != "" {
		pool, err = connectDB(dbURL1)
		if err != nil {
			log.Printf("primary db connect failed: %v", err)
		} else {
			selectedDBURL = dbURL1
		}
	}

	if pool == nil && dbURL2 != "" {
		pool, err = connectDB(dbURL2)
		if err != nil {
			log.Printf("secondary db connect failed: %v", err)
		} else {
			selectedDBURL = dbURL2
		}
	}

	if pool == nil && dbURL3 != "" {
		pool, err = connectDB(dbURL3)
		if err != nil {
			log.Printf("tertiary db connect failed: %v", err)
		} else {
			selectedDBURL = dbURL3
		}
	}

	if pool == nil {
		log.Fatal("db connect failed for DATABASE_URL, DATABASE_URL_2, and DATABASE_URL_3")
	}
	defer pool.Close()

	if err := dbmigrations.Run(selectedDBURL); err != nil {
		log.Fatalf("db migrations failed: %v", err)
	}
	log.Println("db migrations applied")

	r := gin.Default()

	// healthcheck
	r.GET("/_health", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	r.HEAD("/_health", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	r.GET("/_health/deep", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		if err := pool.Ping(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "db_down", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			log.Printf("db ping failed on startup: %v", err)
		} else {
			log.Println("db ping ok")
		}
	}()

	auth.StartSessionCleanup(pool, 6*time.Hour)
	auth.StartTokenCleanup(pool, 24*time.Hour)

	api := r.Group("/api")
	api.GET("/cafes", getCafes(cfg, pool))
	cafeDescriptionAPI := newCafeDescriptionAPI(pool)
	api.PATCH(
		"/cafes/:id/description",
		auth.RequireRole(pool, "admin", "moderator"),
		cafeDescriptionAPI.Update,
	)
	mediaService, err := media.NewS3Service(context.Background(), media.Config{
		Enabled:         cfg.Media.S3Enabled,
		Endpoint:        cfg.Media.S3Endpoint,
		Region:          cfg.Media.S3Region,
		Bucket:          cfg.Media.S3Bucket,
		AccessKeyID:     cfg.Media.S3AccessKeyID,
		SecretAccessKey: cfg.Media.S3SecretAccessKey,
		PublicBaseURL:   cfg.Media.S3PublicBaseURL,
		UsePathStyle:    cfg.Media.S3UsePathStyle,
		PresignTTL:      cfg.Media.S3PresignTTL,
	})
	if err != nil {
		log.Fatalf("s3 init failed: %v", err)
	}
	moderationAPI := newModerationAPI(pool, mediaService, cfg.Media)
	cafePhotoAPI := newCafePhotoAPI(pool, mediaService, cfg.Media)
	api.GET("/cafes/:id/photos", cafePhotoAPI.List)
	api.POST(
		"/cafes/:id/photos/presign",
		auth.RequireRole(pool, "admin", "moderator"),
		cafePhotoAPI.Presign,
	)
	api.POST(
		"/cafes/:id/photos/confirm",
		auth.RequireRole(pool, "admin", "moderator"),
		cafePhotoAPI.Confirm,
	)
	api.PATCH(
		"/cafes/:id/photos/order",
		auth.RequireRole(pool, "admin", "moderator"),
		cafePhotoAPI.Reorder,
	)
	api.PATCH(
		"/cafes/:id/photos/:photoID/cover",
		auth.RequireRole(pool, "admin", "moderator"),
		cafePhotoAPI.SetCover,
	)
	api.DELETE(
		"/cafes/:id/photos/:photoID",
		auth.RequireRole(pool, "admin", "moderator"),
		cafePhotoAPI.Delete,
	)

	submissionsGroup := api.Group("/submissions")
	submissionsGroup.Use(auth.RequireAuth(pool))
	submissionsGroup.POST("/photos/presign", moderationAPI.PresignPhoto)
	submissionsGroup.POST("/cafes", moderationAPI.SubmitCafeCreate)
	submissionsGroup.POST("/cafes/:id/description", moderationAPI.SubmitCafeDescription)
	submissionsGroup.POST("/cafes/:id/photos", moderationAPI.SubmitCafePhotos)
	submissionsGroup.POST("/cafes/:id/menu-photos", moderationAPI.SubmitMenuPhotos)
	submissionsGroup.GET("/mine", moderationAPI.ListMine)

	moderationGroup := api.Group("/moderation")
	moderationGroup.Use(auth.RequireRole(pool, "admin", "moderator"))
	moderationGroup.GET("/submissions", moderationAPI.ListModeration)
	moderationGroup.GET("/submissions/:id", moderationAPI.GetModerationItem)
	moderationGroup.POST("/submissions/:id/approve", moderationAPI.Approve)
	moderationGroup.POST("/submissions/:id/reject", moderationAPI.Reject)
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	mailerClient := mailer.New(mailer.Config{
		Host:    cfg.Mailer.Host,
		Port:    cfg.Mailer.Port,
		User:    cfg.Mailer.User,
		Pass:    cfg.Mailer.Pass,
		From:    cfg.Mailer.From,
		ReplyTo: cfg.Mailer.ReplyTo,
		Timeout: cfg.Mailer.Timeout,
	})

	oauthProviders := map[auth.Provider]auth.OAuthProvider{}
	if cfg.Auth.GitHubClientID != "" && cfg.Auth.GitHubClientSecret != "" {
		oauthProviders[auth.ProviderGitHub] = auth.NewGitHubProvider(cfg.Auth.GitHubClientID, cfg.Auth.GitHubClientSecret, cfg.Auth.GitHubScope)
	}
	if cfg.Auth.YandexClientID != "" && cfg.Auth.YandexClientSecret != "" {
		oauthProviders[auth.ProviderYandex] = auth.NewYandexProvider(cfg.Auth.YandexClientID, cfg.Auth.YandexClientSecret, cfg.Auth.YandexScope)
	}

	authHandler := auth.Handler{
		Pool:                 pool,
		CookieSecure:         cfg.Auth.CookieSecure,
		SlidingRefreshHours:  cfg.Auth.SlidingRefreshHours,
		LoginLimiter:         auth.NewRateLimiter(cfg.Auth.LoginRateLimit, cfg.Auth.LoginRateWindow),
		EmailVerifyLimiter:   auth.NewRateLimiter(cfg.Auth.LoginRateLimit, cfg.Auth.LoginRateWindow),
		PasswordResetLimiter: auth.NewRateLimiter(cfg.Auth.LoginRateLimit, cfg.Auth.LoginRateWindow),
		EmailChangeLimiter:   auth.NewRateLimiter(cfg.Auth.LoginRateLimit, cfg.Auth.LoginRateWindow),
		Mailer:               mailerClient,
		Security: auth.SecurityConfig{
			BaseURL:          cfg.Auth.PublicBaseURL,
			VerifyTTL:        cfg.Auth.VerifyTokenTTL,
			EmailChangeTTL:   cfg.Auth.EmailChangeTTL,
			PasswordResetTTL: cfg.Auth.PasswordResetTTL,
		},
		OAuthProviders:       oauthProviders,
		TelegramBotToken:     cfg.Auth.TelegramBotToken,
		TelegramBotUsername:  cfg.Auth.TelegramBotUsername,
		AvatarMediaService:   mediaService,
		AvatarMaxUploadBytes: cfg.Media.S3MaxUploadBytes,
	}

	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			sent, failed := mailerClient.Stats()
			log.Printf("mailer stats: sent=%d failed=%d", sent, failed)
		}
	}()
	authGroup := api.Group("/auth")
	authGroup.POST("/register", authHandler.Register)
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/logout", authHandler.Logout)
	authGroup.GET("/me", authHandler.Me)
	authGroup.GET("/identities", auth.RequireAuth(pool), authHandler.Identities)
	authGroup.POST("/email/verify/request", auth.RequireAuth(pool), authHandler.EmailVerifyRequest)
	authGroup.GET("/email/verify/confirm", authHandler.EmailVerifyConfirm)
	authGroup.POST("/password/reset/request", authHandler.PasswordResetRequest)
	authGroup.POST("/password/reset/confirm", authHandler.PasswordResetConfirm)
	authGroup.GET("/github/start", authHandler.GitHubStart)
	authGroup.GET("/github/callback", authHandler.GitHubCallback)
	authGroup.GET("/github/link/start", auth.RequireAuth(pool), authHandler.GitHubLinkStart)
	authGroup.GET("/github/link/callback", authHandler.GitHubLinkCallback)
	authGroup.GET("/yandex/start", authHandler.YandexStart)
	authGroup.GET("/yandex/callback", authHandler.YandexCallback)
	authGroup.GET("/yandex/link/start", auth.RequireAuth(pool), authHandler.YandexLinkStart)
	authGroup.GET("/yandex/link/callback", authHandler.YandexLinkCallback)
	authGroup.GET("/telegram/config", authHandler.TelegramConfig)
	authGroup.POST("/telegram/start", authHandler.TelegramStart)
	authGroup.POST("/telegram/callback", authHandler.TelegramCallback)
	authGroup.POST("/sessions/revoke_all", auth.RequireAuth(pool), authHandler.RevokeAllSessions)

	accountGroup := api.Group("/account")
	accountGroup.POST("/email/change/request", auth.RequireAuth(pool), authHandler.EmailChangeRequest)
	accountGroup.PATCH("/profile/name", auth.RequireAuth(pool), authHandler.ProfileNameUpdate)
	accountGroup.POST("/profile/avatar/presign", auth.RequireAuth(pool), authHandler.ProfileAvatarPresign)
	accountGroup.POST("/profile/avatar/confirm", auth.RequireAuth(pool), authHandler.ProfileAvatarConfirm)
	accountGroup.GET("/email/change/confirm", authHandler.EmailChangeConfirm)

	r.NoRoute(func(c *gin.Context) {
		serveStaticOrIndex(c, cfg.PublicDir)
	})

	log.Printf("listening on 0.0.0.0:%s", cfg.Port)
	r.Run("0.0.0.0:" + cfg.Port)
}
