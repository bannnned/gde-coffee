package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port      string
	PublicDir string
	CORS      CORSConfig
	Limits    LimitsConfig
	Auth      AuthConfig
	Mailer    MailerConfig
}

type CORSConfig struct {
	AllowOrigins     []string
	AllowMethods     []string
	AllowHeaders     []string
	AllowCredentials bool
	AllowAllOrigins  bool
	MaxAge           time.Duration
}

type LimitsConfig struct {
	DefaultResults int
	MaxResults     int
}

type AuthConfig struct {
	CookieSecure        bool
	SlidingRefreshHours int
	LoginRateLimit      int
	LoginRateWindow     time.Duration
	PublicBaseURL       string
	VerifyTokenTTL      time.Duration
	EmailChangeTTL      time.Duration
	PasswordResetTTL    time.Duration
	GitHubClientID      string
	GitHubClientSecret  string
	GitHubScope         string
	YandexClientID      string
	YandexClientSecret  string
	YandexScope         string
	TelegramBotToken    string
	TelegramBotUsername string
}

type MailerConfig struct {
	Host    string
	Port    int
	User    string
	Pass    string
	From    string
	ReplyTo string
	Timeout time.Duration
}

func Load() (Config, error) {
	var cfg Config

	cfg.Port = getEnvTrim("PORT", "8080")
	cfg.PublicDir = getEnvTrim("PUBLIC_DIR", "/app/public")

	allowCredentials, err := getEnvBool("CORS_ALLOW_CREDENTIALS", true)
	if err != nil {
		return cfg, err
	}

	maxAge, err := getEnvDuration("CORS_MAX_AGE", 12*time.Hour)
	if err != nil {
		return cfg, err
	}

	defaultResults, err := getEnvInt("LIMIT_DEFAULT", 50)
	if err != nil {
		return cfg, err
	}

	maxResults, err := getEnvInt("LIMIT_MAX", 200)
	if err != nil {
		return cfg, err
	}

	cookieSecure, err := getCookieSecure()
	if err != nil {
		return cfg, err
	}

	slidingHours, err := getEnvInt("SESSION_SLIDING_HOURS", 12)
	if err != nil {
		return cfg, err
	}

	loginRateLimit, err := getEnvInt("LOGIN_RATE_LIMIT", 10)
	if err != nil {
		return cfg, err
	}

	loginRateWindow, err := getEnvDuration("LOGIN_RATE_WINDOW", 5*time.Minute)
	if err != nil {
		return cfg, err
	}

	publicBaseURL := getEnvTrim("PUBLIC_BASE_URL", "https://gde-kofe.ru")

	verifyTTL, err := getEnvDuration("TOKEN_TTL_MINUTES_VERIFY", 60*time.Minute)
	if err != nil {
		return cfg, err
	}
	emailChangeTTL, err := getEnvDuration("TOKEN_TTL_MINUTES_EMAIL_CHANGE", 60*time.Minute)
	if err != nil {
		return cfg, err
	}
	passwordResetTTL, err := getEnvDuration("TOKEN_TTL_MINUTES_PASSWORD_RESET", 30*time.Minute)
	if err != nil {
		return cfg, err
	}
	githubScope := getEnvTrim("GITHUB_OAUTH_SCOPE", "read:user user:email")
	yandexScope := getEnvTrim("YANDEX_OAUTH_SCOPE", "login:email login:info")

	smtpPort, err := getEnvInt("SMTP_PORT", 465)
	if err != nil {
		return cfg, err
	}

	mailerTimeout, err := getEnvDuration("SMTP_TIMEOUT", 10*time.Second)
	if err != nil {
		return cfg, err
	}

	cfg.CORS = CORSConfig{
		AllowOrigins:     splitEnvList("CORS_ALLOW_ORIGINS", []string{"http://localhost:3001", "http://localhost:5173"}),
		AllowMethods:     splitEnvList("CORS_ALLOW_METHODS", []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}),
		AllowHeaders:     splitEnvList("CORS_ALLOW_HEADERS", []string{"Origin", "Content-Type", "Accept", "Authorization"}),
		AllowCredentials: allowCredentials,
		MaxAge:           maxAge,
	}

	for _, origin := range cfg.CORS.AllowOrigins {
		if origin == "*" {
			cfg.CORS.AllowAllOrigins = true
			cfg.CORS.AllowOrigins = nil
			break
		}
	}

	cfg.Limits = LimitsConfig{
		DefaultResults: defaultResults,
		MaxResults:     maxResults,
	}

	cfg.Auth = AuthConfig{
		CookieSecure:        cookieSecure,
		SlidingRefreshHours: slidingHours,
		LoginRateLimit:      loginRateLimit,
		LoginRateWindow:     loginRateWindow,
		PublicBaseURL:       publicBaseURL,
		VerifyTokenTTL:      verifyTTL,
		EmailChangeTTL:      emailChangeTTL,
		PasswordResetTTL:    passwordResetTTL,
		GitHubClientID:      getEnvTrim("GITHUB_CLIENT_ID", ""),
		GitHubClientSecret:  getEnvTrim("GITHUB_CLIENT_SECRET", ""),
		GitHubScope:         githubScope,
		YandexClientID:      getEnvTrim("YANDEX_CLIENT_ID", ""),
		YandexClientSecret:  getEnvTrim("YANDEX_CLIENT_SECRET", ""),
		YandexScope:         yandexScope,
		TelegramBotToken:    getEnvTrim("TELEGRAM_BOT_TOKEN", ""),
		TelegramBotUsername: getEnvTrim("TELEGRAM_BOT_USERNAME", ""),
	}

	cfg.Mailer = MailerConfig{
		Host:    getEnvTrim("SMTP_HOST", "smtp.timeweb.ru"),
		Port:    smtpPort,
		User:    getEnvTrim("SMTP_USER", ""),
		Pass:    getEnvTrim("SMTP_PASS", ""),
		From:    getEnvTrim("MAIL_FROM", ""),
		ReplyTo: getEnvTrim("MAIL_REPLY_TO", ""),
		Timeout: mailerTimeout,
	}

	log.Printf("config: port=%q public_dir=%q cors_origins=%v cookie_secure=%v sliding_hours=%d login_rate_limit=%d login_rate_window=%s",
		cfg.Port,
		cfg.PublicDir,
		cfg.CORS.AllowOrigins,
		cfg.Auth.CookieSecure,
		cfg.Auth.SlidingRefreshHours,
		cfg.Auth.LoginRateLimit,
		cfg.Auth.LoginRateWindow,
	)

	if cfg.Port == "" {
		return cfg, fmt.Errorf("PORT must not be empty")
	}
	if cfg.Limits.DefaultResults < 0 {
		return cfg, fmt.Errorf("LIMIT_DEFAULT must be >= 0")
	}
	if cfg.Limits.MaxResults < 0 {
		return cfg, fmt.Errorf("LIMIT_MAX must be >= 0")
	}
	if cfg.Limits.MaxResults > 0 && cfg.Limits.DefaultResults > cfg.Limits.MaxResults {
		return cfg, fmt.Errorf("LIMIT_DEFAULT must be <= LIMIT_MAX")
	}
	if cfg.Auth.SlidingRefreshHours < 0 {
		return cfg, fmt.Errorf("SESSION_SLIDING_HOURS must be >= 0")
	}
	if cfg.Auth.LoginRateLimit < 0 {
		return cfg, fmt.Errorf("LOGIN_RATE_LIMIT must be >= 0")
	}
	if cfg.Auth.LoginRateWindow < 0 {
		return cfg, fmt.Errorf("LOGIN_RATE_WINDOW must be >= 0")
	}
	if cfg.Auth.VerifyTokenTTL <= 0 {
		return cfg, fmt.Errorf("TOKEN_TTL_MINUTES_VERIFY must be > 0")
	}
	if cfg.Auth.EmailChangeTTL <= 0 {
		return cfg, fmt.Errorf("TOKEN_TTL_MINUTES_EMAIL_CHANGE must be > 0")
	}
	if cfg.Auth.PasswordResetTTL <= 0 {
		return cfg, fmt.Errorf("TOKEN_TTL_MINUTES_PASSWORD_RESET must be > 0")
	}
	if cfg.Mailer.Port <= 0 {
		return cfg, fmt.Errorf("SMTP_PORT must be > 0")
	}

	return cfg, nil
}

func getCookieSecure() (bool, error) {
	raw := strings.TrimSpace(os.Getenv("COOKIE_SECURE"))
	if raw == "" {
		return isProdEnv(), nil
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return false, fmt.Errorf("COOKIE_SECURE must be a boolean")
	}
	return value, nil
}

func isProdEnv() bool {
	env := strings.ToLower(strings.TrimSpace(os.Getenv("ENV")))
	if env == "production" {
		return true
	}
	appEnv := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if appEnv == "production" {
		return true
	}
	ginMode := strings.ToLower(strings.TrimSpace(os.Getenv("GIN_MODE")))
	return ginMode == "release"
}

func getEnvTrim(key, def string) string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	return raw
}

func splitEnvList(key string, def []string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		out := make([]string, len(def))
		copy(out, def)
		return out
	}

	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item == "" {
			continue
		}
		out = append(out, item)
	}
	return out
}

func getEnvInt(key string, def int) (int, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer", key)
	}
	return value, nil
}

func getEnvBool(key string, def bool) (bool, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def, nil
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return false, fmt.Errorf("%s must be a boolean", key)
	}
	return value, nil
}

func getEnvDuration(key string, def time.Duration) (time.Duration, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def, nil
	}
	if _, err := strconv.Atoi(raw); err == nil && !strings.ContainsAny(raw, "nsuµmh") {
		mins, _ := strconv.Atoi(raw)
		return time.Duration(mins) * time.Minute, nil
	}
	value, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("%s must be a duration", key)
	}
	return value, nil
}
