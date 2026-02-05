package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const (
	cookieName   = "sid"
	sessionTTL   = 30 * 24 * time.Hour
	queryTimeout = 5 * time.Second
)

type Handler struct {
	Pool         *pgxpool.Pool
	CookieSecure bool
}

type User struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	DisplayName *string `json:"display_name,omitempty"`
}

type registerRequest struct {
	Email       string  `json:"email"`
	Password    string  `json:"password"`
	DisplayName *string `json:"display_name"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type apiError struct {
	Message string      `json:"message"`
	Code    string      `json:"code"`
	Details interface{} `json:"details,omitempty"`
}

func respondError(c *gin.Context, status int, code, message string, details interface{}) {
	c.JSON(status, apiError{Message: message, Code: code, Details: details})
}

func normalizeEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func (h Handler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "invalid json body", nil)
		return
	}

	email := normalizeEmail(req.Email)
	if email == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "email is required", nil)
		return
	}
	if strings.TrimSpace(req.Password) == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "password is required", nil)
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "password hash failed", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), queryTimeout)
	defer cancel()

	tx, err := h.Pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db begin failed", nil)
		return
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	var user User
	err = tx.QueryRow(
		ctx,
		`insert into users (email_normalized, display_name)
		 values ($1, $2)
		 returning id::text, email_normalized, display_name`,
		email,
		req.DisplayName,
	).Scan(&user.ID, &user.Email, &user.DisplayName)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(c, http.StatusConflict, "already_exists", "email already registered", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "user create failed", nil)
		return
	}

	_, err = tx.Exec(ctx, `insert into local_credentials (user_id, password_hash) values ($1, $2)`, user.ID, string(passwordHash))
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "credential create failed", nil)
		return
	}

	sessionID, expiresAt, err := createSession(ctx, tx, user.ID, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "session create failed", nil)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db commit failed", nil)
		return
	}

	setSessionCookie(c, sessionID, h.CookieSecure)
	c.JSON(http.StatusOK, gin.H{
		"user":               user,
		"session_expires_at": expiresAt,
	})
}

func (h Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "invalid json body", nil)
		return
	}

	email := normalizeEmail(req.Email)
	if email == "" || strings.TrimSpace(req.Password) == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "email and password are required", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), queryTimeout)
	defer cancel()

	var user User
	var passwordHash string
	err := h.Pool.QueryRow(
		ctx,
		`select u.id::text, u.email_normalized, u.display_name, lc.password_hash
		 from users u
		 join local_credentials lc on lc.user_id = u.id
		 where u.email_normalized = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.DisplayName, &passwordHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(c, http.StatusUnauthorized, "unauthorized", "invalid credentials", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "db query failed", nil)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		respondError(c, http.StatusUnauthorized, "unauthorized", "invalid credentials", nil)
		return
	}

	sessionID, expiresAt, err := createSession(ctx, h.Pool, user.ID, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "session create failed", nil)
		return
	}

	setSessionCookie(c, sessionID, h.CookieSecure)
	c.JSON(http.StatusOK, gin.H{
		"user":               user,
		"session_expires_at": expiresAt,
	})
}

func (h Handler) Logout(c *gin.Context) {
	sid, err := c.Cookie(cookieName)
	if err == nil && sid != "" {
		ctx, cancel := context.WithTimeout(c.Request.Context(), queryTimeout)
		defer cancel()
		_, _ = h.Pool.Exec(ctx, `update sessions set revoked_at = now() where id = $1 and revoked_at is null`, sid)
	}

	clearSessionCookie(c, h.CookieSecure)
	c.Status(http.StatusOK)
}

func (h Handler) Me(c *gin.Context) {
	sid, err := c.Cookie(cookieName)
	if err != nil || sid == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), queryTimeout)
	defer cancel()

	user, err := getUserBySession(ctx, h.Pool, sid)
	if err != nil {
		if errors.Is(err, errUnauthorized) {
			respondError(c, http.StatusUnauthorized, "unauthorized", "invalid session", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "db query failed", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

var errUnauthorized = errors.New("unauthorized")

func getUserBySession(ctx context.Context, pool queryer, sid string) (User, error) {
	var user User
	row := pool.QueryRow(ctx, `
		select u.id::text, u.email_normalized, u.display_name
		from sessions s
		join users u on u.id = s.user_id
		where s.id = $1 and s.revoked_at is null and s.expires_at > now()
	`, sid)
	if err := row.Scan(&user.ID, &user.Email, &user.DisplayName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, errUnauthorized
		}
		return User{}, err
	}
	return user, nil
}

type queryer interface {
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
}

func createSession(ctx context.Context, execer execer, userID, ip, userAgent string) (string, time.Time, error) {
	sessionID, err := generateSessionID()
	if err != nil {
		return "", time.Time{}, err
	}
	expiresAt := time.Now().Add(sessionTTL)

	_, err = execer.Exec(
		ctx,
		`insert into sessions (id, user_id, expires_at, ip, user_agent)
		 values ($1, $2, $3, $4, $5)`,
		sessionID,
		userID,
		expiresAt,
		ip,
		userAgent,
	)
	if err != nil {
		return "", time.Time{}, err
	}

	return sessionID, expiresAt, nil
}

type execer interface {
	Exec(ctx context.Context, sql string, arguments ...interface{}) (pgconn.CommandTag, error)
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

func setSessionCookie(c *gin.Context, value string, secure bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, value, int(sessionTTL.Seconds()), "/", "", secure, true)
}

func clearSessionCookie(c *gin.Context, secure bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, "", -1, "/", "", secure, true)
}
