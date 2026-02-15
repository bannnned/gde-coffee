package main

import (
	"context"
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
	"backend/internal/domains/cafes"
	"backend/internal/domains/favorites"
	"backend/internal/domains/moderation"
	"backend/internal/domains/photos"
	"backend/internal/domains/reviews"
	"backend/internal/mailer"
	"backend/internal/media"
	"backend/internal/shared/httpx"
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
	reviewsHandler := reviews.NewDefaultHandler(pool)

	go reviewsHandler.Service().StartEventWorker(context.Background(), 2*time.Second)

	api := r.Group("/api")
	api.GET("/geocode", cafesHandler.GeocodeLookup)
	api.GET("/cafes", auth.OptionalAuth(pool), cafesHandler.List)
	api.POST("/cafes/:id/favorite", auth.RequireAuth(pool), favoritesHandler.Add)
	api.DELETE("/cafes/:id/favorite", auth.RequireAuth(pool), favoritesHandler.Remove)
	api.PATCH("/cafes/:id/description", auth.RequireRole(pool, "admin", "moderator"), cafesHandler.UpdateDescription)
	api.POST("/reviews", auth.RequireAuth(pool), reviewsHandler.Publish)
	api.POST("/reviews/:id/helpful", auth.RequireAuth(pool), reviewsHandler.AddHelpful)
	api.POST("/reviews/:id/visit/verify", auth.RequireAuth(pool), reviewsHandler.VerifyVisit)
	api.POST("/reviews/:id/abuse", auth.RequireAuth(pool), reviewsHandler.ReportAbuse)
	api.POST("/abuse-reports/:id/confirm", auth.RequireRole(pool, "admin", "moderator"), reviewsHandler.ConfirmAbuse)
	api.GET("/cafes/:id/rating", reviewsHandler.GetCafeRating)

	api.GET("/cafes/:id/photos", photosHandler.List)
	api.POST("/cafes/:id/photos/presign", auth.RequireRole(pool, "admin", "moderator"), photosHandler.Presign)
	api.POST("/cafes/:id/photos/confirm", auth.RequireRole(pool, "admin", "moderator"), photosHandler.Confirm)
	api.PATCH("/cafes/:id/photos/order", auth.RequireRole(pool, "admin", "moderator"), photosHandler.Reorder)
	api.PATCH("/cafes/:id/photos/:photoID/cover", auth.RequireRole(pool, "admin", "moderator"), photosHandler.SetCover)
	api.DELETE("/cafes/:id/photos/:photoID", auth.RequireRole(pool, "admin", "moderator"), photosHandler.Delete)

	submissionsGroup := api.Group("/submissions")
	submissionsGroup.Use(auth.RequireAuth(pool))
	submissionsGroup.POST("/photos/presign", moderationHandler.PresignPhoto)
	submissionsGroup.POST("/cafes", moderationHandler.SubmitCafeCreate)
	submissionsGroup.POST("/cafes/:id/description", moderationHandler.SubmitCafeDescription)
	submissionsGroup.POST("/cafes/:id/photos", moderationHandler.SubmitCafePhotos)
	submissionsGroup.POST("/cafes/:id/menu-photos", moderationHandler.SubmitMenuPhotos)
	submissionsGroup.GET("/mine", moderationHandler.ListMine)

	moderationGroup := api.Group("/moderation")
	moderationGroup.Use(auth.RequireRole(pool, "admin", "moderator"))
	moderationGroup.GET("/submissions", moderationHandler.ListModeration)
	moderationGroup.GET("/submissions/:id", moderationHandler.GetModerationItem)
	moderationGroup.POST("/submissions/:id/approve", moderationHandler.Approve)
	moderationGroup.POST("/submissions/:id/reject", moderationHandler.Reject)

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
