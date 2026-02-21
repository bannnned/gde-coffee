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
	Feedback  FeedbackConfig
	Media     MediaConfig
	Geocoding GeocodingConfig
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

type FeedbackConfig struct {
	RecipientEmail string
}

type MediaConfig struct {
	S3Enabled         bool
	S3Endpoint        string
	S3Region          string
	S3Bucket          string
	S3AccessKeyID     string
	S3SecretAccessKey string
	S3PublicBaseURL   string
	S3UsePathStyle    bool
	S3PresignTTL      time.Duration
	S3MaxUploadBytes  int64

	PhotoFormatEncoderEnabled  bool
	PhotoFormatEncoderProvider string
	PhotoFormatEncoderBaseURL  string
	PhotoFormatEncoderTimeout  time.Duration
	PhotoFormatEncoderQuality  int
	PhotoFormatEncoderFormats  []string
}

type GeocodingConfig struct {
	YandexAPIKey     string
	NominatimBaseURL string
	UserAgent        string
	Timeout          time.Duration
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
	s3EnabledDefault := strings.TrimSpace(os.Getenv("S3_BUCKET")) != ""
	s3Enabled, err := getEnvBool("S3_ENABLED", s3EnabledDefault)
	if err != nil {
		return cfg, err
	}
	s3UsePathStyle, err := getEnvBool("S3_USE_PATH_STYLE", true)
	if err != nil {
		return cfg, err
	}
	s3PresignTTL, err := getEnvDuration("S3_PRESIGN_TTL", 15*time.Minute)
	if err != nil {
		return cfg, err
	}
	s3MaxUploadBytes, err := getEnvInt("S3_MAX_UPLOAD_BYTES", 16*1024*1024)
	if err != nil {
		return cfg, err
	}
	photoFormatEncoderEnabledDefault := strings.TrimSpace(os.Getenv("PHOTO_FORMAT_ENCODER_BASE_URL")) != ""
	photoFormatEncoderEnabled, err := getEnvBool("PHOTO_FORMAT_ENCODER_ENABLED", photoFormatEncoderEnabledDefault)
	if err != nil {
		return cfg, err
	}
	photoFormatEncoderTimeout, err := getEnvDuration("PHOTO_FORMAT_ENCODER_TIMEOUT", 8*time.Second)
	if err != nil {
		return cfg, err
	}
	photoFormatEncoderQuality, err := getEnvInt("PHOTO_FORMAT_ENCODER_QUALITY", 78)
	if err != nil {
		return cfg, err
	}
	geocodingTimeout, err := getEnvDuration("GEOCODING_TIMEOUT", 5*time.Second)
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
	cfg.Feedback = FeedbackConfig{
		RecipientEmail: getEnvTrim("FEEDBACK_TO_EMAIL", ""),
	}
	cfg.Media = MediaConfig{
		S3Enabled:         s3Enabled,
		S3Endpoint:        getEnvTrim("S3_ENDPOINT", ""),
		S3Region:          getEnvTrim("S3_REGION", "ru-1"),
		S3Bucket:          getEnvTrim("S3_BUCKET", ""),
		S3AccessKeyID:     getEnvTrim("S3_ACCESS_KEY_ID", ""),
		S3SecretAccessKey: getEnvTrim("S3_SECRET_ACCESS_KEY", ""),
		S3PublicBaseURL:   getEnvTrim("S3_PUBLIC_BASE_URL", ""),
		S3UsePathStyle:    s3UsePathStyle,
		S3PresignTTL:      s3PresignTTL,
		S3MaxUploadBytes:  int64(s3MaxUploadBytes),

		PhotoFormatEncoderEnabled:  photoFormatEncoderEnabled,
		PhotoFormatEncoderProvider: strings.ToLower(getEnvTrim("PHOTO_FORMAT_ENCODER_PROVIDER", "imgproxy")),
		PhotoFormatEncoderBaseURL:  getEnvTrim("PHOTO_FORMAT_ENCODER_BASE_URL", ""),
		PhotoFormatEncoderTimeout:  photoFormatEncoderTimeout,
		PhotoFormatEncoderQuality:  photoFormatEncoderQuality,
		PhotoFormatEncoderFormats:  normalizePhotoFormatList(splitEnvList("PHOTO_FORMAT_ENCODER_FORMATS", []string{"webp", "avif"})),
	}
	cfg.Geocoding = GeocodingConfig{
		YandexAPIKey:     getEnvTrim("YANDEX_GEOCODER_API_KEY", ""),
		NominatimBaseURL: getEnvTrim("NOMINATIM_BASE_URL", "https://nominatim.openstreetmap.org"),
		UserAgent:        getEnvTrim("GEOCODER_USER_AGENT", "gde-kofe geocoder/1.0"),
		Timeout:          geocodingTimeout,
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
	if cfg.Media.S3Enabled {
		if cfg.Media.S3Bucket == "" {
			return cfg, fmt.Errorf("S3_BUCKET must not be empty when S3 is enabled")
		}
		if cfg.Media.S3Endpoint == "" {
			return cfg, fmt.Errorf("S3_ENDPOINT must not be empty when S3 is enabled")
		}
		if cfg.Media.S3Region == "" {
			return cfg, fmt.Errorf("S3_REGION must not be empty when S3 is enabled")
		}
		if cfg.Media.S3AccessKeyID == "" || cfg.Media.S3SecretAccessKey == "" {
			return cfg, fmt.Errorf("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required when S3 is enabled")
		}
		if cfg.Media.S3PresignTTL <= 0 {
			return cfg, fmt.Errorf("S3_PRESIGN_TTL must be > 0")
		}
		if cfg.Media.S3MaxUploadBytes <= 0 {
			return cfg, fmt.Errorf("S3_MAX_UPLOAD_BYTES must be > 0")
		}
	}
	if cfg.Media.PhotoFormatEncoderEnabled {
		if strings.TrimSpace(cfg.Media.PhotoFormatEncoderBaseURL) == "" {
			return cfg, fmt.Errorf("PHOTO_FORMAT_ENCODER_BASE_URL must not be empty when PHOTO_FORMAT_ENCODER_ENABLED=true")
		}
		switch cfg.Media.PhotoFormatEncoderProvider {
		case "imgproxy", "libvips":
		default:
			return cfg, fmt.Errorf("PHOTO_FORMAT_ENCODER_PROVIDER must be one of: imgproxy, libvips")
		}
		if cfg.Media.PhotoFormatEncoderTimeout <= 0 {
			return cfg, fmt.Errorf("PHOTO_FORMAT_ENCODER_TIMEOUT must be > 0")
		}
		if cfg.Media.PhotoFormatEncoderQuality < 1 || cfg.Media.PhotoFormatEncoderQuality > 100 {
			return cfg, fmt.Errorf("PHOTO_FORMAT_ENCODER_QUALITY must be in range 1..100")
		}
		if len(cfg.Media.PhotoFormatEncoderFormats) == 0 {
			return cfg, fmt.Errorf("PHOTO_FORMAT_ENCODER_FORMATS must contain at least one format")
		}
	}
	if cfg.Geocoding.Timeout <= 0 {
		return cfg, fmt.Errorf("GEOCODING_TIMEOUT must be > 0")
	}
	if strings.TrimSpace(cfg.Geocoding.NominatimBaseURL) == "" {
		return cfg, fmt.Errorf("NOMINATIM_BASE_URL must not be empty")
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

func normalizePhotoFormatList(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	out := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, raw := range values {
		v := strings.ToLower(strings.TrimSpace(raw))
		if v == "" {
			continue
		}
		switch v {
		case "webp", "avif":
			if _, ok := seen[v]; ok {
				continue
			}
			seen[v] = struct{}{}
			out = append(out, v)
		}
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
