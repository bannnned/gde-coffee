package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

var allowedAvatarContentTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/avif": ".avif",
}

type profileAvatarPresignRequest struct {
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
}

type profileAvatarPresignResponse struct {
	UploadURL string            `json:"upload_url"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers"`
	ObjectKey string            `json:"object_key"`
	FileURL   string            `json:"file_url"`
	ExpiresAt time.Time         `json:"expires_at"`
}

type profileAvatarConfirmRequest struct {
	ObjectKey string `json:"object_key"`
}

func (h Handler) ProfileAvatarPresign(c *gin.Context) {
	if h.AvatarMediaService == nil || !h.AvatarMediaService.Enabled() {
		respondError(c, http.StatusServiceUnavailable, "service_unavailable", "Загрузка аватара сейчас недоступна.", nil)
		return
	}

	userID, ok := UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
		return
	}

	var req profileAvatarPresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "invalid json body", nil)
		return
	}

	contentType := normalizeAvatarContentType(req.ContentType)
	ext, ok := allowedAvatarContentTypes[contentType]
	if !ok {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Неподдерживаемый формат изображения.", nil)
		return
	}
	if req.SizeBytes <= 0 {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Размер файла должен быть больше 0.", nil)
		return
	}
	maxBytes := h.AvatarMaxUploadBytes
	if maxBytes <= 0 {
		maxBytes = 8 * 1024 * 1024
	}
	if req.SizeBytes > maxBytes {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Размер файла превышает допустимый лимит.", gin.H{
			"max_upload_bytes": maxBytes,
		})
		return
	}

	token, err := GenerateToken(9)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "token generate failed", nil)
		return
	}

	objectKey := fmt.Sprintf(
		"avatars/users/%s/%d_%s%s",
		strings.TrimSpace(userID),
		time.Now().Unix(),
		token,
		ext,
	)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()
	presigned, err := h.AvatarMediaService.PresignPutObject(ctx, objectKey, contentType)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	c.JSON(http.StatusOK, profileAvatarPresignResponse{
		UploadURL: presigned.UploadURL,
		Method:    http.MethodPut,
		Headers:   presigned.Headers,
		ObjectKey: objectKey,
		FileURL:   h.AvatarMediaService.PublicURL(objectKey),
		ExpiresAt: presigned.ExpiresAt,
	})
}

func (h Handler) ProfileAvatarConfirm(c *gin.Context) {
	if h.AvatarMediaService == nil || !h.AvatarMediaService.Enabled() {
		respondError(c, http.StatusServiceUnavailable, "service_unavailable", "Загрузка аватара сейчас недоступна.", nil)
		return
	}

	userID, ok := UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
		return
	}

	var req profileAvatarConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "invalid json body", nil)
		return
	}

	objectKey := strings.TrimSpace(strings.TrimPrefix(req.ObjectKey, "/"))
	if objectKey == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "object key is required", nil)
		return
	}

	keyPrefix := fmt.Sprintf("avatars/users/%s/", strings.TrimSpace(userID))
	if !strings.HasPrefix(objectKey, keyPrefix) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный object_key.", nil)
		return
	}

	maxBytes := h.AvatarMaxUploadBytes
	if maxBytes <= 0 {
		maxBytes = 8 * 1024 * 1024
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()
	sizeBytes, mimeType, err := h.AvatarMediaService.HeadObject(ctx, objectKey)
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Файл не найден в хранилище или ссылка устарела.", nil)
		return
	}
	if sizeBytes <= 0 || sizeBytes > maxBytes {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Размер файла превышает допустимый лимит.", gin.H{
			"max_upload_bytes": maxBytes,
			"size_bytes":       sizeBytes,
		})
		return
	}
	if _, ok := allowedAvatarContentTypes[normalizeAvatarContentType(mimeType)]; !ok {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Неподдерживаемый формат изображения.", nil)
		return
	}

	avatarURL := h.AvatarMediaService.PublicURL(objectKey)

	var user User
	err = h.Pool.QueryRow(
		ctx,
		`update users
		    set avatar_url = $2
		  where id = $1
		  returning id::text, coalesce(email_normalized, ''), display_name, avatar_url, email_verified_at, role`,
		userID,
		avatarURL,
	).Scan(&user.ID, &user.Email, &user.DisplayName, &user.AvatarURL, &user.EmailVerifiedAt, &user.Role)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db update failed", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func normalizeAvatarContentType(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return ""
	}
	if idx := strings.Index(value, ";"); idx >= 0 {
		value = strings.TrimSpace(value[:idx])
	}
	return value
}
