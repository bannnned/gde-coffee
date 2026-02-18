package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"backend/internal/auth"
	"backend/internal/config"
	"backend/internal/model"
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

	ctxPing, cancelPing := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelPing()

	if err := pool.Ping(ctxPing); err != nil {
		pool.Close()
		return nil, err
	}

	ctxWarm, cancelWarm := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelWarm()

	var one int
	if err := pool.QueryRow(ctxWarm, "select 1").Scan(&one); err != nil {
		pool.Close()
		return nil, err
	}

	return pool, nil
}

func queryCafes(
	ctx context.Context,
	pool *pgxpool.Pool,
	lat, lng, radiusM float64,
	requiredAmenities []string,
	sortBy string,
	limit int,
	cfg config.Config,
) ([]model.CafeResponse, error) {

	// если сортировка work — выгодно взять побольше из БД, потом отсортировать в Go
	dbLimit := limit
	if sortBy == config.SortByWork {
		// чтобы было из чего выбирать
		if cfg.Limits.MaxResults > 0 {
			dbLimit = cfg.Limits.MaxResults
		} else if limit > 0 {
			dbLimit = limit * 5
		} else {
			dbLimit = 200
		}
	}
	if dbLimit <= 0 {
		dbLimit = cfg.Limits.DefaultResults
	}

	var amenitiesParam []string
	if len(requiredAmenities) > 0 {
		amenitiesParam = requiredAmenities
	} else {
		amenitiesParam = nil // важно: будет NULL
	}

	// haversine в SQL (без PostGIS)
	const sqlDistance = `
WITH q AS (
  SELECT
    id::text,
    name,
    address,
    lat,
    lng,
    amenities,
    (2 * 6371000 * asin(
      sqrt(
        power(sin(radians(($1 - lat) / 2)), 2) +
        cos(radians(lat)) * cos(radians($1)) *
        power(sin(radians(($2 - lng) / 2)), 2)
      )
    )) AS distance_m
  FROM public.cafes
  WHERE ($4::text[] IS NULL OR amenities @> $4::text[])
)
SELECT id, name, address, lat, lng, amenities, distance_m
FROM q
WHERE ($3 = 0 OR distance_m <= $3)
ORDER BY distance_m ASC
LIMIT $5;
`

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
			latDB   float64
			lngDB   float64
			ams     []string
			dist    float64
		)

		if err := rows.Scan(&id, &name, &address, &latDB, &lngDB, &ams, &dist); err != nil {
			return nil, err
		}

		out = append(out, model.CafeResponse{
			ID:        id,
			Name:      name,
			Address:   address,
			Latitude:  latDB,
			Longitude: lngDB,
			Amenities: ams,
			DistanceM: dist,
			WorkScore: computeWorkScore(ams), // как у тебя уже есть
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	// если просили сортировку по work — сортируем тут (distance уже посчитана)
	if sortBy == config.SortByWork {
		sort.Slice(out, func(i, j int) bool {
			if out[i].WorkScore == out[j].WorkScore {
				return out[i].DistanceM < out[j].DistanceM
			}
			return out[i].WorkScore > out[j].WorkScore
		})
		if limit > 0 && len(out) > limit {
			out = out[:limit]
		}
	} else {
		// distance сортировка уже в SQL, просто обрежем
		if limit > 0 && len(out) > limit {
			out = out[:limit]
		}
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
			respondError(c, http.StatusBadRequest, "invalid_argument", "lat, lng, and radius_m are required", nil)
			return
		}

		lat, err := parseFloat(latStr)
		if err != nil {
			respondError(c, http.StatusBadRequest, "invalid_argument", "invalid lat", nil)
			return
		}
		if lat < -90 || lat > 90 {
			respondError(c, http.StatusBadRequest, "invalid_argument", "lat must be between -90 and 90", nil)
			return
		}

		lng, err := parseFloat(lngStr)
		if err != nil {
			respondError(c, http.StatusBadRequest, "invalid_argument", "invalid lng", nil)
			return
		}
		if lng < -180 || lng > 180 {
			respondError(c, http.StatusBadRequest, "invalid_argument", "lng must be between -180 and 180", nil)
			return
		}

		radiusM, err := parseFloat(radiusStr)
		if err != nil {
			respondError(c, http.StatusBadRequest, "invalid_argument", "invalid radius_m", nil)
			return
		}

		if radiusM < 0 {
			respondError(c, http.StatusBadRequest, "invalid_argument", "radius_m must be >= 0", nil)
			return
		}

		if radiusM > maxRadiusM {
			respondError(
				c,
				http.StatusBadRequest,
				"invalid_argument",
				"radius_m must be <= 50000",
				gin.H{"max_radius_m": maxRadiusM},
			)
			return
		}

		sortBy := strings.TrimSpace(c.DefaultQuery("sort", config.DefaultSort))
		if sortBy != config.SortByDistance && sortBy != config.SortByWork {
			respondError(c, http.StatusBadRequest, "invalid_argument", "sort must be 'work' or 'distance'", nil)
			return
		}

		limit, err := parseLimit(c.Query("limit"), cfg.Limits)
		if err != nil {
			respondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
			return
		}

		requiredAmenities := parseAmenities(c.Query("amenities"))

		// таймаут на запрос
		ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
		defer cancel()

		cafes, err := queryCafes(ctx, pool, lat, lng, radiusM, requiredAmenities, sortBy, limit, cfg)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal", "db query failed", gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, cafes)
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
		httpx.RespondError(c, http.StatusNotFound, "not_found", "Маршрут не найден.", nil)
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
		httpx.RespondError(c, http.StatusNotFound, "not_found", "Файл index.html не найден.", nil)
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

	dbURL1 := os.Getenv("DATABASE_URL")
	dbURL2 := os.Getenv("DATABASE_URL_2")

	if dbURL1 == "" && dbURL2 == "" {
		log.Fatal("DATABASE_URL or DATABASE_URL_2 is required")
	}

	var pool *pgxpool.Pool
	if dbURL1 != "" {
		pool, err = connectDB(dbURL1)
		if err != nil {
			log.Printf("primary db connect failed: %v", err)
		}
	}

	if pool == nil && dbURL2 != "" {
		pool, err = connectDB(dbURL2)
		if err != nil {
			log.Printf("secondary db connect failed: %v", err)
		}
	}

	if pool == nil {
		log.Fatal("db connect failed for both DATABASE_URL and DATABASE_URL_2")
	}
	defer pool.Close()

	log.Println("db warmup OK")

	r := gin.Default()

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

	cafesHandler := cafes.NewDefaultHandler(pool, cfg)
	favoritesHandler := favorites.NewDefaultHandler(pool, cfg.Media)
	photosHandler := photos.NewHandler(pool, mediaService, cfg.Media)
	moderationHandler := moderation.NewHandler(pool, mediaService, cfg.Media)
	reviewsHandler := reviews.NewDefaultHandler(pool, mediaService, cfg.Media)

	go reviewsHandler.Service().StartEventWorker(context.Background(), 2*time.Second)
	go reviewsHandler.Service().StartInboxWorker(context.Background(), 2*time.Second)
	go reviewsHandler.Service().StartPhotoCleanupWorker(context.Background(), 15*time.Minute)
	go reviewsHandler.Service().StartRatingRebuildWorker(context.Background(), 15*time.Minute)

	api := r.Group("/api")
	api.GET("/cafes", getCafes(cfg, pool))
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
	accountGroup.GET("/favorites", auth.RequireAuth(pool), favoritesHandler.List)
	accountGroup.GET("/email/change/confirm", authHandler.EmailChangeConfirm)

	r.NoRoute(func(c *gin.Context) {
		serveStaticOrIndex(c, cfg.PublicDir)
	})

	log.Printf("listening on 0.0.0.0:%s", cfg.Port)
	r.Run("0.0.0.0:" + cfg.Port)
}
