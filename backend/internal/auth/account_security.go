package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type SecurityConfig struct {
	BaseURL          string
	VerifyTTL        time.Duration
	EmailChangeTTL   time.Duration
	PasswordResetTTL time.Duration
}

type Mailer interface {
	SendEmail(ctx context.Context, to string, subject string, textBody string, htmlBody string) error
}

type verifyRequestResponse struct {
	Status string `json:"status"`
}

type emailChangeRequest struct {
	NewEmail        string `json:"new_email"`
	CurrentPassword string `json:"current_password"`
}

type passwordResetRequest struct {
	Email string `json:"email"`
}

type passwordResetConfirm struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

func (h Handler) EmailVerifyRequest(c *gin.Context) {
	if h.Mailer == nil {
		respondError(c, http.StatusInternalServerError, "internal", "mailer not configured", nil)
		return
	}

	userID, ok := UserIDFromContext(c)
	if !ok || userID == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), queryTimeout)
	defer cancel()

	var email string
	err := h.Pool.QueryRow(ctx, `select email_normalized from users where id = $1`, userID).Scan(&email)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db query failed", nil)
		return
	}

	rawToken, err := GenerateToken(32)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "token generate failed", nil)
		return
	}

	expiresAt := time.Now().Add(h.Security.VerifyTTL)
	hash := HashToken(rawToken)

	_, err = h.Pool.Exec(
		ctx,
		`insert into email_verifications (user_id, token_hash, email_normalized, expires_at)
		 values ($1, $2, $3, $4)`,
		userID,
		hash,
		email,
		expiresAt,
	)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db insert failed", nil)
		return
	}

	verifyURL := strings.TrimRight(h.Security.BaseURL, "/") + "/verify-email?token=" + rawToken
	textBody := "Verify your email: " + verifyURL
	htmlBody := "<p>Verify your email: <a href=\"" + verifyURL + "\">" + verifyURL + "</a></p>"
	if err := h.Mailer.SendEmail(ctx, email, "Verify your email", textBody, htmlBody); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "email send failed", nil)
		return
	}

	c.JSON(http.StatusOK, verifyRequestResponse{Status: "ok"})
}

func (h Handler) EmailVerifyConfirm(c *gin.Context) {
	raw := strings.TrimSpace(c.Query("token"))
	if raw == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "token is required", nil)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), queryTimeout)
	defer cancel()

	hash := HashToken(raw)

	tx, err := h.Pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db begin failed", nil)
		return
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	var userID string
	err = tx.QueryRow(ctx, `
		select user_id::text
		from email_verifications
		where token_hash = $1 and consumed_at is null and expires_at > now()
		for update
	`, hash).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(c, http.StatusBadRequest, "invalid_token", "token is invalid or expired", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "db query failed", nil)
		return
	}

	_, err = tx.Exec(ctx, `
		update users set email_verified_at = now(), updated_at = now() where id = $1
	`, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "user update failed", nil)
		return
	}

	_, err = tx.Exec(ctx, `update email_verifications set consumed_at = now() where token_hash = $1`, hash)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "token update failed", nil)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db commit failed", nil)
		return
	}

	redirect := strings.TrimRight(h.Security.BaseURL, "/") + "/settings?verified=1"
	c.Redirect(http.StatusFound, redirect)
}

func (h Handler) EmailChangeRequest(c *gin.Context) {
	if h.Mailer == nil {
		respondError(c, http.StatusInternalServerError, "internal", "mailer not configured", nil)
		return
	}

	userID, ok := UserIDFromContext(c)
	if !ok || userID == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
		return
	}

	var req emailChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "invalid json body", nil)
		return
	}

	newEmail := NormalizeEmail(req.NewEmail)
	if newEmail == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "new_email is required", nil)
		return
	}
	if strings.TrimSpace(req.CurrentPassword) == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "current_password is required", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), queryTimeout)
	defer cancel()

	var passwordHash string
	err := h.Pool.QueryRow(ctx, `select password_hash from local_credentials where user_id = $1`, userID).Scan(&passwordHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(c, http.StatusBadRequest, "no_local_password", "local password not set", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "db query failed", nil)
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.CurrentPassword)); err != nil {
		respondError(c, http.StatusUnauthorized, "unauthorized", "invalid credentials", nil)
		return
	}

	var exists string
	err = h.Pool.QueryRow(ctx, `select id::text from users where email_normalized = $1`, newEmail).Scan(&exists)
	if err == nil && exists != "" {
		respondError(c, http.StatusConflict, "already_exists", "email already in use", nil)
		return
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		respondError(c, http.StatusInternalServerError, "internal", "db query failed", nil)
		return
	}

	rawToken, err := GenerateToken(32)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "token generate failed", nil)
		return
	}

	expiresAt := time.Now().Add(h.Security.EmailChangeTTL)
	hash := HashToken(rawToken)

	_, err = h.Pool.Exec(
		ctx,
		`insert into email_change_requests (user_id, token_hash, new_email_normalized, expires_at)
		 values ($1, $2, $3, $4)`,
		userID,
		hash,
		newEmail,
		expiresAt,
	)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db insert failed", nil)
		return
	}

	confirmURL := strings.TrimRight(h.Security.BaseURL, "/") + "/confirm-email-change?token=" + rawToken
	textBody := "Confirm your email change: " + confirmURL
	htmlBody := "<p>Confirm your email change: <a href=\"" + confirmURL + "\">" + confirmURL + "</a></p>"
	if err := h.Mailer.SendEmail(ctx, newEmail, "Confirm email change", textBody, htmlBody); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "email send failed", nil)
		return
	}

	c.Status(http.StatusOK)
}

func (h Handler) EmailChangeConfirm(c *gin.Context) {
	raw := strings.TrimSpace(c.Query("token"))
	if raw == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "token is required", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), queryTimeout)
	defer cancel()

	hash := HashToken(raw)

	tx, err := h.Pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db begin failed", nil)
		return
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	var userID string
	var newEmail string
	err = tx.QueryRow(ctx, `
		select user_id::text, new_email_normalized
		from email_change_requests
		where token_hash = $1 and consumed_at is null and expires_at > now()
		for update
	`, hash).Scan(&userID, &newEmail)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(c, http.StatusBadRequest, "invalid_token", "token is invalid or expired", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "db query failed", nil)
		return
	}

	_, err = tx.Exec(ctx, `
		update users set email_normalized = $2, email_verified_at = now(), updated_at = now() where id = $1
	`, userID, newEmail)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(c, http.StatusConflict, "already_exists", "email already in use", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "user update failed", nil)
		return
	}

	_, _ = tx.Exec(ctx, `
		update identities set email = $2, email_normalized = $2
		where user_id = $1 and provider = 'local'
	`, userID, newEmail)

	_, err = tx.Exec(ctx, `update email_change_requests set consumed_at = now() where token_hash = $1`, hash)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "token update failed", nil)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db commit failed", nil)
		return
	}

	_ = RevokeUserSessions(ctx, h.Pool, userID, nil)

	redirect := strings.TrimRight(h.Security.BaseURL, "/") + "/settings?email_changed=1"
	c.Redirect(http.StatusFound, redirect)
}

func (h Handler) PasswordResetRequest(c *gin.Context) {
	if h.Mailer == nil {
		respondError(c, http.StatusInternalServerError, "internal", "mailer not configured", nil)
		return
	}

	var req passwordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "invalid json body", nil)
		return
	}

	email := NormalizeEmail(req.Email)
	if email == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "email is required", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), queryTimeout)
	defer cancel()

	var userID string
	err := h.Pool.QueryRow(ctx, `select id::text from users where email_normalized = $1`, email).Scan(&userID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		respondError(c, http.StatusInternalServerError, "internal", "db query failed", nil)
		return
	}

	if userID == "" {
		c.Status(http.StatusOK)
		return
	}

	var hasLocal string
	err = h.Pool.QueryRow(ctx, `select user_id::text from local_credentials where user_id = $1`, userID).Scan(&hasLocal)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.Status(http.StatusOK)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "db query failed", nil)
		return
	}

	rawToken, err := GenerateToken(32)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "token generate failed", nil)
		return
	}

	expiresAt := time.Now().Add(h.Security.PasswordResetTTL)
	hash := HashToken(rawToken)

	_, err = h.Pool.Exec(
		ctx,
		`insert into password_reset_tokens (user_id, token_hash, expires_at, requested_ip, requested_ua)
		 values ($1, $2, $3, $4, $5)`,
		userID,
		hash,
		expiresAt,
		c.ClientIP(),
		c.GetHeader("User-Agent"),
	)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db insert failed", nil)
		return
	}

	resetURL := strings.TrimRight(h.Security.BaseURL, "/") + "/reset-password?token=" + rawToken
	textBody := "Password reset link: " + resetURL
	htmlBody := "<p>Password reset link: <a href=\"" + resetURL + "\">" + resetURL + "</a></p>"
	if err := h.Mailer.SendEmail(ctx, email, "Password reset", textBody, htmlBody); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "email send failed", nil)
		return
	}

	c.Status(http.StatusOK)
}

func (h Handler) PasswordResetConfirm(c *gin.Context) {
	var req passwordResetConfirm
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "invalid json body", nil)
		return
	}

	raw := strings.TrimSpace(req.Token)
	if raw == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "token is required", nil)
		return
	}
	if len(strings.TrimSpace(req.NewPassword)) < 8 {
		respondError(c, http.StatusBadRequest, "invalid_argument", "new_password must be at least 8 chars", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), queryTimeout)
	defer cancel()

	hash := HashToken(raw)

	tx, err := h.Pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db begin failed", nil)
		return
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	var userID string
	err = tx.QueryRow(ctx, `
		select user_id::text
		from password_reset_tokens
		where token_hash = $1 and consumed_at is null and expires_at > now()
		for update
	`, hash).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(c, http.StatusBadRequest, "invalid_token", "token is invalid or expired", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "db query failed", nil)
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "password hash failed", nil)
		return
	}

	_, err = tx.Exec(ctx, `update local_credentials set password_hash = $2 where user_id = $1`, userID, string(passwordHash))
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "credential update failed", nil)
		return
	}

	_, err = tx.Exec(ctx, `update password_reset_tokens set consumed_at = now() where token_hash = $1`, hash)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "token update failed", nil)
		return
	}

	_, _ = tx.Exec(ctx, `update users set updated_at = now() where id = $1`, userID)

	if err := tx.Commit(ctx); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db commit failed", nil)
		return
	}

	_ = RevokeUserSessions(ctx, h.Pool, userID, nil)

	c.Status(http.StatusOK)
}

func RevokeUserSessions(ctx context.Context, pool *pgxpool.Pool, userID string, exceptSID *string) error {
	if exceptSID != nil && *exceptSID != "" {
		_, err := pool.Exec(ctx, `
			update sessions set revoked_at = now()
			where user_id = $1 and revoked_at is null and expires_at > now() and id <> $2
		`, userID, *exceptSID)
		return err
	}

	_, err := pool.Exec(ctx, `
		update sessions set revoked_at = now()
		where user_id = $1 and revoked_at is null and expires_at > now()
	`, userID)
	return err
}
