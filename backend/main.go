package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"backend/internal/auth"
	"backend/internal/config"
	"backend/internal/domains/cafes"
	"backend/internal/domains/favorites"
	"backend/internal/domains/feedback"
	"backend/internal/domains/metrics"
	"backend/internal/domains/moderation"
	"backend/internal/domains/photos"
	"backend/internal/domains/reviews"
	"backend/internal/domains/tags"
	"backend/internal/logging"
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

	if isSPAFallback || normalized == "" || normalized == "index.html" || normalized == "sw.js" {
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		return
	}

	if normalized == "manifest.webmanifest" {
		c.Header("Cache-Control", "public, max-age=86400")
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
	logging.Setup()

	// Read port early so the health server can start immediately.
	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}

	// ---- Start HTTP server IMMEDIATELY with a health-only handler ----
	// Timeweb starts its healthcheck right after the container is up.
	// We must have /_health answering 200 before any heavy init (DB, migrations, S3).
	var handler atomic.Value
	handler.Store(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/_health" || r.URL.Path == "/" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ok"))
			return
		}
		http.Error(w, "initializing", http.StatusServiceUnavailable)
	}))

	srv := &http.Server{
		Addr: "0.0.0.0:" + port,
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handler.Load().(http.Handler).ServeHTTP(w, r)
		}),
	}
	go func() {
		slog.Info("http server starting (health-only)", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server listen failed", "error", err)
			os.Exit(1)
		}
	}()

	// ---- Full initialization ----
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "error", err)
		os.Exit(1)
	}
	slog.Info("telegram env",
		"bot_username", strings.TrimSpace(cfg.Auth.TelegramBotUsername),
		"token_set", strings.TrimSpace(cfg.Auth.TelegramBotToken) != "",
	)

	dbURL1 := os.Getenv("DATABASE_URL")
	dbURL2 := os.Getenv("DATABASE_URL_2")
	dbURL3 := os.Getenv("DATABASE_URL_3")

	if dbURL1 == "" && dbURL2 == "" && dbURL3 == "" {
		slog.Error("DATABASE_URL or DATABASE_URL_2 or DATABASE_URL_3 is required")
		os.Exit(1)
	}

	var pool *pgxpool.Pool
	selectedDBURL := ""
	if dbURL1 != "" {
		pool, err = connectDB(dbURL1)
		if err != nil {
			slog.Warn("db connect failed", "source", "primary", "error", err)
		} else {
			selectedDBURL = dbURL1
		}
	}

	if pool == nil && dbURL2 != "" {
		pool, err = connectDB(dbURL2)
		if err != nil {
			slog.Warn("db connect failed", "source", "secondary", "error", err)
		} else {
			selectedDBURL = dbURL2
		}
	}

	if pool == nil && dbURL3 != "" {
		pool, err = connectDB(dbURL3)
		if err != nil {
			slog.Warn("db connect failed", "source", "tertiary", "error", err)
		} else {
			selectedDBURL = dbURL3
		}
	}

	if pool == nil {
		slog.Error("db connect failed for DATABASE_URL, DATABASE_URL_2, and DATABASE_URL_3")
		os.Exit(1)
	}

	if err := dbmigrations.Run(selectedDBURL); err != nil {
		slog.Error("db migrations failed", "error", err)
		os.Exit(1)
	}
	slog.Info("db migrations applied")

	// ---- Build the full Gin engine ----
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(logging.RequestID())
	r.Use(logging.RequestLogger())

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
			slog.Warn("db ping failed on startup", "error", err)
		} else {
			slog.Info("db ping ok")
		}
	}()

	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		auth.StartSessionCleanup(workerCtx, pool, 6*time.Hour)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		auth.StartTokenCleanup(workerCtx, pool, 24*time.Hour)
	}()

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
		slog.Error("s3 init failed", "error", err)
		os.Exit(1)
	}

	cafesHandler := cafes.NewDefaultHandler(pool, cfg)
	favoritesHandler := favorites.NewDefaultHandler(pool, cfg.Media)
	photosHandler := photos.NewHandler(pool, mediaService, cfg.Media)
	moderationHandler := moderation.NewHandler(pool, mediaService, cfg.Media)
	reviewsHandler := reviews.NewDefaultHandler(pool, mediaService, cfg.Media)
	tagsHandler := tags.NewDefaultHandler(pool)
	metricsHandler := metrics.NewDefaultHandler(pool)

	wg.Add(4)
	go func() { defer wg.Done(); reviewsHandler.Service().StartEventWorker(workerCtx, 2*time.Second) }()
	go func() { defer wg.Done(); reviewsHandler.Service().StartInboxWorker(workerCtx, 2*time.Second) }()
	go func() { defer wg.Done(); reviewsHandler.Service().StartPhotoCleanupWorker(workerCtx, 15*time.Minute) }()
	go func() { defer wg.Done(); reviewsHandler.Service().StartRatingRebuildWorker(workerCtx, 15*time.Minute) }()

	api := r.Group("/api")
	api.GET("/geocode", cafesHandler.GeocodeLookup)
	api.GET("/drinks", reviewsHandler.ListDrinks)
	api.GET("/cafes", auth.OptionalAuth(pool), cafesHandler.List)
	api.POST("/cafes/:id/favorite", auth.RequireAuth(pool), favoritesHandler.Add)
	api.DELETE("/cafes/:id/favorite", auth.RequireAuth(pool), favoritesHandler.Remove)
	api.PATCH("/cafes/:id/description", auth.RequireRole(pool, "admin", "moderator"), cafesHandler.UpdateDescription)
	api.POST("/reviews", auth.RequireAuth(pool), reviewsHandler.Create)
	api.PATCH("/reviews/:id", auth.RequireAuth(pool), reviewsHandler.Update)
	api.DELETE("/reviews/:id", auth.RequireRole(pool, "admin", "moderator"), reviewsHandler.DeleteReview)
	api.POST("/reviews/photos/presign", auth.RequireAuth(pool), reviewsHandler.PresignPhoto)
	api.POST("/reviews/photos/confirm", auth.RequireAuth(pool), reviewsHandler.ConfirmPhoto)
	api.GET("/reviews/photos/:id/status", auth.RequireAuth(pool), reviewsHandler.GetPhotoStatus)
	api.POST("/reviews/:id/helpful", auth.RequireAuth(pool), reviewsHandler.AddHelpful)
	api.POST("/cafes/:id/check-in/start", auth.RequireAuth(pool), reviewsHandler.StartCheckIn)
	api.POST("/reviews/:id/visit/verify", auth.RequireAuth(pool), reviewsHandler.VerifyVisit)
	api.POST("/reviews/:id/abuse", auth.RequireAuth(pool), reviewsHandler.ReportAbuse)
	api.POST("/abuse-reports/:id/confirm", auth.RequireRole(pool, "admin", "moderator"), reviewsHandler.ConfirmAbuse)
	api.POST("/metrics/events", auth.OptionalAuth(pool), metricsHandler.IngestEvents)
	api.GET("/cafes/:id/rating", reviewsHandler.GetCafeRating)
	api.GET("/cafes/:id/reviews", reviewsHandler.ListCafeReviews)
	api.GET("/tags/descriptive/discovery", auth.OptionalAuth(pool), tagsHandler.GetDiscoveryDescriptive)
	api.GET("/tags/descriptive/options", tagsHandler.GetDescriptiveOptions)
	api.GET("/tags/descriptive/preferences", auth.RequireAuth(pool), tagsHandler.GetMyDescriptivePreferences)
	api.PUT("/tags/descriptive/preferences", auth.RequireAuth(pool), tagsHandler.PutMyDescriptivePreferences)
	api.GET("/reputation/me", auth.RequireAuth(pool), reviewsHandler.GetMyReputation)
	api.GET("/reputation/me/events", auth.RequireAuth(pool), reviewsHandler.GetMyReputationEvents)
	api.GET("/reputation/users/:id/events", auth.RequireRole(pool, "admin", "moderator"), reviewsHandler.GetUserReputationEvents)

	adminDrinksGroup := api.Group("/admin/drinks")
	adminDrinksGroup.Use(auth.RequireRole(pool, "admin", "moderator"))
	adminDrinksGroup.GET("", reviewsHandler.ListAdminDrinks)
	adminDrinksGroup.POST("", reviewsHandler.CreateDrink)
	adminDrinksGroup.PATCH("/:id", reviewsHandler.UpdateDrink)
	adminDrinksGroup.GET("/unknown", reviewsHandler.ListUnknownDrinks)
	adminDrinksGroup.POST("/unknown/:id/map", reviewsHandler.MapUnknownDrink)
	adminDrinksGroup.POST("/unknown/:id/ignore", reviewsHandler.IgnoreUnknownDrink)

	adminCafesGroup := api.Group("/admin/cafes")
	adminCafesGroup.Use(auth.RequireRole(pool, "admin", "moderator"))
	adminCafesGroup.GET("/search", cafesHandler.AdminSearch)
	adminCafesGroup.GET("/:id", cafesHandler.AdminGetByID)
	adminCafesGroup.PATCH("/:id", auth.RequireRole(pool, "admin"), cafesHandler.AdminUpdateByID)
	adminCafesGroup.DELETE("/:id", auth.RequireRole(pool, "admin"), cafesHandler.AdminDeleteByID)
	adminCafesGroup.GET("/:id/rating-diagnostics", reviewsHandler.GetCafeRatingDiagnostics)
	adminCafesGroup.POST("/:id/rating-ai-summarize", reviewsHandler.TriggerCafeAISummary)
	api.POST("/admin/cafes/import-json", auth.RequireRole(pool, "admin"), cafesHandler.ImportJSON)

	adminReviewsGroup := api.Group("/admin/reviews")
	adminReviewsGroup.Use(auth.RequireRole(pool, "admin", "moderator"))
	adminReviewsGroup.GET("/versioning", reviewsHandler.GetVersioningStatus)
	adminReviewsGroup.GET("/health", reviewsHandler.GetReviewsAIHealth)
	adminReviewsGroup.GET("/dlq", reviewsHandler.ListDLQ)
	adminReviewsGroup.POST("/dlq/replay-open", reviewsHandler.ReplayAllOpenDLQ)
	adminReviewsGroup.POST("/dlq/resolve-open", reviewsHandler.ResolveOpenDLQWithoutReplay)
	adminReviewsGroup.POST("/dlq/:id/replay", reviewsHandler.ReplayDLQEvent)

	adminMetricsGroup := api.Group("/admin/metrics")
	adminMetricsGroup.Use(auth.RequireRole(pool, "admin", "moderator"))
	adminMetricsGroup.GET("/north-star", metricsHandler.GetNorthStar)
	adminMetricsGroup.GET("/funnel", metricsHandler.GetFunnel)

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
	feedbackRecipient := strings.TrimSpace(cfg.Feedback.RecipientEmail)
	if feedbackRecipient == "" {
		feedbackRecipient = strings.TrimSpace(cfg.Mailer.ReplyTo)
	}
	if feedbackRecipient == "" {
		feedbackRecipient = strings.TrimSpace(cfg.Mailer.From)
	}
	feedbackHandler := feedback.NewDefaultHandler(pool, mailerClient, feedbackRecipient)
	if feedbackRecipient == "" {
		slog.Warn("feedback recipient not configured")
	}

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

	wg.Add(1)
	go func() {
		defer wg.Done()
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-workerCtx.Done():
				slog.Info("mailer stats worker stopped")
				return
			case <-ticker.C:
				sent, failed := mailerClient.Stats()
				slog.Info("mailer stats", "sent", sent, "failed", failed)
			}
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
	accountGroup.POST("/feedback", auth.RequireAuth(pool), feedbackHandler.Create)
	api.GET("/admin/feedback", auth.RequireRole(pool, "admin"), feedbackHandler.ListAdmin)
	accountGroup.GET("/email/change/confirm", authHandler.EmailChangeConfirm)

	r.NoRoute(func(c *gin.Context) {
		serveStaticOrIndex(c, cfg.PublicDir)
	})

	// ---- Swap handler: from health-only to full Gin engine ----
	handler.Store(r)
	slog.Info("app fully initialized, serving all routes")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	slog.Info("shutdown signal received", "signal", sig)

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("http server shutdown error", "error", err)
	}
	slog.Info("http server stopped")

	workerCancel()
	wg.Wait()
	slog.Info("all workers stopped")

	pool.Close()
	slog.Info("db pool closed, shutdown complete")
}
