package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/config"
	"backend/internal/media"
	"backend/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var allowedPhotoContentTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/avif": ".avif",
}

type cafePhotoAPI struct {
	pool *pgxpool.Pool
	s3   *media.Service
	cfg  config.MediaConfig
}

type cafePhotoPresignRequest struct {
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
}

type cafePhotoPresignResponse struct {
	UploadURL string            `json:"upload_url"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers"`
	ObjectKey string            `json:"object_key"`
	FileURL   string            `json:"file_url"`
	ExpiresAt time.Time         `json:"expires_at"`
}

type cafePhotoConfirmRequest struct {
	ObjectKey string `json:"object_key"`
	IsCover   bool   `json:"is_cover"`
	Position  *int   `json:"position,omitempty"`
}

type cafePhotoConfirmResponse struct {
	Photo model.CafePhotoResponse `json:"photo"`
}

func newCafePhotoAPI(pool *pgxpool.Pool, s3 *media.Service, cfg config.MediaConfig) *cafePhotoAPI {
	return &cafePhotoAPI{
		pool: pool,
		s3:   s3,
		cfg:  cfg,
	}
}

func (h *cafePhotoAPI) Presign(c *gin.Context) {
	if h.s3 == nil || !h.s3.Enabled() {
		respondError(c, http.StatusServiceUnavailable, "service_unavailable", "Загрузка фото сейчас недоступна.", nil)
		return
	}

	cafeID := strings.TrimSpace(c.Param("id"))
	if cafeID == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	var req cafePhotoPresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	contentType := normalizeContentType(req.ContentType)
	ext, ok := allowedPhotoContentTypes[contentType]
	if !ok {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Неподдерживаемый формат изображения.", nil)
		return
	}

	if req.SizeBytes <= 0 {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Размер файла должен быть больше 0.", nil)
		return
	}
	if req.SizeBytes > h.cfg.S3MaxUploadBytes {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Размер файла превышает допустимый лимит.", gin.H{
			"max_upload_bytes": h.cfg.S3MaxUploadBytes,
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if err := ensureCafeExists(ctx, h.pool, cafeID); err != nil {
		if err == pgx.ErrNoRows {
			respondError(c, http.StatusNotFound, "not_found", "Кофейня не найдена.", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	token, err := auth.GenerateToken(9)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	objectKey := fmt.Sprintf("cafes/%s/%d_%s%s", cafeID, time.Now().Unix(), token, ext)
	presigned, err := h.s3.PresignPutObject(ctx, objectKey, contentType)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось подготовить загрузку файла.", nil)
		return
	}

	c.JSON(http.StatusOK, cafePhotoPresignResponse{
		UploadURL: presigned.UploadURL,
		Method:    http.MethodPut,
		Headers:   presigned.Headers,
		ObjectKey: objectKey,
		FileURL:   h.s3.PublicURL(objectKey),
		ExpiresAt: presigned.ExpiresAt,
	})
}

func (h *cafePhotoAPI) Confirm(c *gin.Context) {
	if h.s3 == nil || !h.s3.Enabled() {
		respondError(c, http.StatusServiceUnavailable, "service_unavailable", "Загрузка фото сейчас недоступна.", nil)
		return
	}

	cafeID := strings.TrimSpace(c.Param("id"))
	if cafeID == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	var req cafePhotoConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	objectKey := strings.TrimSpace(strings.TrimPrefix(req.ObjectKey, "/"))
	if objectKey == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "object_key обязателен.", nil)
		return
	}
	keyPrefix := fmt.Sprintf("cafes/%s/", cafeID)
	if !strings.HasPrefix(objectKey, keyPrefix) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "object_key не соответствует выбранной кофейне.", nil)
		return
	}
	if req.Position != nil && *req.Position < 0 {
		respondError(c, http.StatusBadRequest, "invalid_argument", "position должен быть >= 0.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	if err := ensureCafeExists(ctx, h.pool, cafeID); err != nil {
		if err == pgx.ErrNoRows {
			respondError(c, http.StatusNotFound, "not_found", "Кофейня не найдена.", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	sizeBytes, mimeType, err := h.s3.HeadObject(ctx, objectKey)
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Файл не найден в хранилище или ссылка устарела.", nil)
		return
	}
	if sizeBytes > h.cfg.S3MaxUploadBytes {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Размер файла превышает допустимый лимит.", gin.H{
			"max_upload_bytes": h.cfg.S3MaxUploadBytes,
			"size_bytes":       sizeBytes,
		})
		return
	}
	if _, ok := allowedPhotoContentTypes[normalizeContentType(mimeType)]; !ok {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Неподдерживаемый формат изображения.", nil)
		return
	}

	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	var photosCount int
	if err := tx.QueryRow(ctx, `select count(*) from cafe_photos where cafe_id = $1::uuid`, cafeID).Scan(&photosCount); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	position := photosCount + 1
	if req.Position != nil {
		position = *req.Position
	}
	isCover := req.IsCover || photosCount == 0

	if isCover {
		if _, err := tx.Exec(ctx, `update cafe_photos set is_cover = false where cafe_id = $1::uuid and is_cover = true`, cafeID); err != nil {
			respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
			return
		}
	}

	var uploadedBy *string
	if userID, ok := auth.UserIDFromContext(c); ok && strings.TrimSpace(userID) != "" {
		trimmed := strings.TrimSpace(userID)
		uploadedBy = &trimmed
	}

	var photoID string
	var savedPosition int
	var savedIsCover bool
	err = tx.QueryRow(
		ctx,
		`insert into cafe_photos (cafe_id, object_key, mime_type, size_bytes, position, is_cover, uploaded_by)
		 values ($1::uuid, $2, $3, $4, $5, $6, $7::uuid)
		 returning id::text, position, is_cover`,
		cafeID,
		objectKey,
		normalizeContentType(mimeType),
		sizeBytes,
		position,
		isCover,
		uploadedBy,
	).Scan(&photoID, &savedPosition, &savedIsCover)
	if err != nil {
		if isUniqueViolationPg(err) {
			respondError(c, http.StatusConflict, "already_exists", "Это фото уже привязано к кофейне.", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	c.JSON(http.StatusOK, cafePhotoConfirmResponse{
		Photo: model.CafePhotoResponse{
			ID:       photoID,
			URL:      h.s3.PublicURL(objectKey),
			IsCover:  savedIsCover,
			Position: savedPosition,
		},
	})
}

func ensureCafeExists(ctx context.Context, pool *pgxpool.Pool, cafeID string) error {
	var id string
	return pool.QueryRow(ctx, `select id::text from cafes where id::text = $1`, cafeID).Scan(&id)
}

func normalizeContentType(contentType string) string {
	value := strings.ToLower(strings.TrimSpace(contentType))
	if idx := strings.Index(value, ";"); idx > 0 {
		return strings.TrimSpace(value[:idx])
	}
	return value
}

func isUniqueViolationPg(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && strings.TrimSpace(pgErr.Code) == "23505"
}

func attachCafePhotos(
	ctx context.Context,
	pool *pgxpool.Pool,
	cafes []model.CafeResponse,
	mediaCfg config.MediaConfig,
) error {
	if len(cafes) == 0 {
		return nil
	}

	cafeIDs := make([]string, 0, len(cafes))
	for _, cafe := range cafes {
		cafeIDs = append(cafeIDs, cafe.ID)
	}

	rows, err := pool.Query(
		ctx,
		`select id::text, cafe_id::text, object_key, position, is_cover
		 from cafe_photos
		 where cafe_id::text = any($1::text[])
		 order by cafe_id::text asc, is_cover desc, position asc, created_at asc`,
		cafeIDs,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	photosByCafeID := make(map[string][]model.CafePhotoResponse, len(cafes))
	for rows.Next() {
		var (
			photoID   string
			cafeID    string
			objectKey string
			position  int
			isCover   bool
		)
		if err := rows.Scan(&photoID, &cafeID, &objectKey, &position, &isCover); err != nil {
			return err
		}
		photosByCafeID[cafeID] = append(photosByCafeID[cafeID], model.CafePhotoResponse{
			ID:       photoID,
			URL:      buildCafePhotoURL(mediaCfg, objectKey),
			IsCover:  isCover,
			Position: position,
		})
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for i := range cafes {
		photos := photosByCafeID[cafes[i].ID]
		if len(photos) == 0 {
			continue
		}
		cafes[i].Photos = photos
		cover := photos[0].URL
		cafes[i].CoverPhotoURL = &cover
	}
	return nil
}

func buildCafePhotoURL(mediaCfg config.MediaConfig, objectKey string) string {
	key := strings.TrimSpace(strings.TrimPrefix(objectKey, "/"))
	if key == "" {
		return ""
	}
	if strings.HasPrefix(key, "http://") || strings.HasPrefix(key, "https://") {
		return key
	}
	if strings.TrimSpace(mediaCfg.S3PublicBaseURL) != "" {
		return strings.TrimRight(mediaCfg.S3PublicBaseURL, "/") + "/" + key
	}

	endpoint := strings.TrimSpace(mediaCfg.S3Endpoint)
	if endpoint == "" || strings.TrimSpace(mediaCfg.S3Bucket) == "" {
		return key
	}
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		endpoint = "https://" + endpoint
	}
	endpoint = strings.TrimRight(endpoint, "/")

	if mediaCfg.S3UsePathStyle {
		return endpoint + "/" + mediaCfg.S3Bucket + "/" + key
	}
	schemeHost := strings.TrimPrefix(strings.TrimPrefix(endpoint, "https://"), "http://")
	if strings.HasPrefix(endpoint, "https://") {
		return "https://" + mediaCfg.S3Bucket + "." + schemeHost + "/" + key
	}
	return "http://" + mediaCfg.S3Bucket + "." + schemeHost + "/" + key
}
