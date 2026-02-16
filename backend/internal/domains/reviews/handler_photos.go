package reviews

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/shared/httpx"

	"github.com/gin-gonic/gin"
)

var allowedReviewPhotoContentTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/avif": ".avif",
}

func (h *Handler) PresignPhoto(c *gin.Context) {
	if h.s3 == nil || !h.s3.Enabled() {
		httpx.RespondError(c, http.StatusServiceUnavailable, "service_unavailable", "Загрузка фото сейчас недоступна.", nil)
		return
	}

	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	var req PresignReviewPhotoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	contentType := normalizeReviewPhotoContentType(req.ContentType)
	ext, ok := allowedReviewPhotoContentTypes[contentType]
	if !ok {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Неподдерживаемый формат изображения.", nil)
		return
	}

	if req.SizeBytes <= 0 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Размер файла должен быть больше 0.", nil)
		return
	}

	maxBytes := h.cfg.S3MaxUploadBytes
	if maxBytes <= 0 {
		maxBytes = 8 * 1024 * 1024
	}
	if req.SizeBytes > maxBytes {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Размер файла превышает допустимый лимит.", gin.H{
			"max_upload_bytes": maxBytes,
		})
		return
	}

	token, err := auth.GenerateToken(9)
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	objectKey := fmt.Sprintf(
		"reviews/users/%s/%d_%s%s",
		strings.TrimSpace(userID),
		time.Now().Unix(),
		token,
		ext,
	)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	presigned, err := h.s3.PresignPutObject(ctx, objectKey, contentType)
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось подготовить загрузку файла.", nil)
		return
	}

	c.JSON(http.StatusOK, PresignReviewPhotoResponse{
		UploadURL: presigned.UploadURL,
		Method:    http.MethodPut,
		Headers:   presigned.Headers,
		ObjectKey: objectKey,
		FileURL:   h.s3.PublicURL(objectKey),
		ExpiresAt: presigned.ExpiresAt.UTC().Format(time.RFC3339),
	})
}

func (h *Handler) ConfirmPhoto(c *gin.Context) {
	if h.s3 == nil || !h.s3.Enabled() {
		httpx.RespondError(c, http.StatusServiceUnavailable, "service_unavailable", "Загрузка фото сейчас недоступна.", nil)
		return
	}

	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	var req ConfirmReviewPhotoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	objectKey := strings.TrimSpace(strings.TrimPrefix(req.ObjectKey, "/"))
	if objectKey == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "object_key обязателен.", nil)
		return
	}

	keyPrefix := fmt.Sprintf("reviews/users/%s/", strings.TrimSpace(userID))
	if !strings.HasPrefix(objectKey, keyPrefix) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "object_key не соответствует текущему пользователю.", nil)
		return
	}

	maxBytes := h.cfg.S3MaxUploadBytes
	if maxBytes <= 0 {
		maxBytes = 8 * 1024 * 1024
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	sizeBytes, mimeType, err := h.s3.HeadObject(ctx, objectKey)
	if err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Файл не найден в хранилище или ссылка устарела.", nil)
		return
	}
	if sizeBytes <= 0 || sizeBytes > maxBytes {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Размер файла превышает допустимый лимит.", gin.H{
			"max_upload_bytes": maxBytes,
			"size_bytes":       sizeBytes,
		})
		return
	}
	mimeType = normalizeReviewPhotoContentType(mimeType)
	if _, ok := allowedReviewPhotoContentTypes[mimeType]; !ok {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Неподдерживаемый формат изображения.", nil)
		return
	}

	c.JSON(http.StatusOK, ConfirmReviewPhotoResponse{
		ObjectKey: objectKey,
		FileURL:   h.s3.PublicURL(objectKey),
		MimeType:  mimeType,
		SizeBytes: sizeBytes,
	})
}

func normalizeReviewPhotoContentType(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return ""
	}
	if idx := strings.Index(value, ";"); idx >= 0 {
		value = strings.TrimSpace(value[:idx])
	}
	return value
}
