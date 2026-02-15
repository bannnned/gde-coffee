package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
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

var uuidPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

const (
	cafePhotoKindCafe = "cafe"
	cafePhotoKindMenu = "menu"
)

type cafePhotoAPI struct {
	pool *pgxpool.Pool
	s3   *media.Service
	cfg  config.MediaConfig
}

type cafePhotoPresignRequest struct {
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	Kind        string `json:"kind,omitempty"`
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
	Kind      string `json:"kind,omitempty"`
}

type cafePhotoConfirmResponse struct {
	Photo model.CafePhotoResponse `json:"photo"`
}

type cafePhotoListResponse struct {
	Photos []model.CafePhotoResponse `json:"photos"`
}

type cafePhotoReorderRequest struct {
	PhotoIDs []string `json:"photo_ids"`
}

func newCafePhotoAPI(pool *pgxpool.Pool, s3 *media.Service, cfg config.MediaConfig) *cafePhotoAPI {
	return &cafePhotoAPI{
		pool: pool,
		s3:   s3,
		cfg:  cfg,
	}
}

func normalizePhotoKind(raw string) (string, error) {
	kind := strings.ToLower(strings.TrimSpace(raw))
	if kind == "" {
		return cafePhotoKindCafe, nil
	}
	switch kind {
	case cafePhotoKindCafe, cafePhotoKindMenu:
		return kind, nil
	default:
		return "", errors.New("Некорректный kind. Поддерживаются только cafe и menu.")
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
	if !isValidUUID(cafeID) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	var req cafePhotoPresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}
	photoKind, err := normalizePhotoKind(req.Kind)
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
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

	objectKey := fmt.Sprintf("cafes/%s/%s/%d_%s%s", cafeID, photoKind, time.Now().Unix(), token, ext)
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
	if !isValidUUID(cafeID) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	var req cafePhotoConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}
	photoKind, err := normalizePhotoKind(req.Kind)
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
		return
	}

	objectKey := strings.TrimSpace(strings.TrimPrefix(req.ObjectKey, "/"))
	if objectKey == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "object_key обязателен.", nil)
		return
	}
	keyPrefix := fmt.Sprintf("cafes/%s/%s/", cafeID, photoKind)
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
	if err := tx.QueryRow(
		ctx,
		`select count(*) from cafe_photos where cafe_id = $1::uuid and kind = $2`,
		cafeID,
		photoKind,
	).Scan(&photosCount); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	position := photosCount + 1
	if req.Position != nil {
		position = *req.Position
	}
	isCover := photoKind == cafePhotoKindCafe && (req.IsCover || photosCount == 0)

	if isCover {
		if _, err := tx.Exec(
			ctx,
			`update cafe_photos set is_cover = false where cafe_id = $1::uuid and kind = $2 and is_cover = true`,
			cafeID,
			photoKind,
		); err != nil {
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
		`insert into cafe_photos (cafe_id, object_key, mime_type, size_bytes, kind, position, is_cover, uploaded_by)
		 values ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid)
		 returning id::text, position, is_cover`,
		cafeID,
		objectKey,
		normalizeContentType(mimeType),
		sizeBytes,
		photoKind,
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
			Kind:     photoKind,
			IsCover:  savedIsCover,
			Position: savedPosition,
		},
	})
}

func (h *cafePhotoAPI) List(c *gin.Context) {
	cafeID := strings.TrimSpace(c.Param("id"))
	if cafeID == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}
	if !isValidUUID(cafeID) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}
	photoKind, err := normalizePhotoKind(c.DefaultQuery("kind", cafePhotoKindCafe))
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
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

	photos, err := listCafePhotos(ctx, h.pool, cafeID, photoKind, h.cfg)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	c.JSON(http.StatusOK, cafePhotoListResponse{Photos: photos})
}

func (h *cafePhotoAPI) SetCover(c *gin.Context) {
	cafeID := strings.TrimSpace(c.Param("id"))
	photoID := strings.TrimSpace(c.Param("photoID"))
	if cafeID == "" || photoID == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректные параметры id/photoID.", nil)
		return
	}
	if !isValidUUID(cafeID) || !isValidUUID(photoID) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректные параметры id/photoID.", nil)
		return
	}
	photoKind, err := normalizePhotoKind(c.DefaultQuery("kind", cafePhotoKindCafe))
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
		return
	}
	if photoKind != cafePhotoKindCafe {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Обложку можно назначать только для фото заведения.", nil)
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

	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	if _, err := tx.Exec(
		ctx,
		`update cafe_photos set is_cover = false where cafe_id = $1::uuid and kind = $2 and is_cover = true`,
		cafeID,
		photoKind,
	); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	result, err := tx.Exec(
		ctx,
		`update cafe_photos set is_cover = true where cafe_id = $1::uuid and kind = $2 and id = $3::uuid`,
		cafeID,
		photoKind,
		photoID,
	)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}
	if result.RowsAffected() == 0 {
		respondError(c, http.StatusNotFound, "not_found", "Фото не найдено.", nil)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	photos, err := listCafePhotos(ctx, h.pool, cafeID, photoKind, h.cfg)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	c.JSON(http.StatusOK, cafePhotoListResponse{Photos: photos})
}

func (h *cafePhotoAPI) Reorder(c *gin.Context) {
	cafeID := strings.TrimSpace(c.Param("id"))
	if cafeID == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}
	if !isValidUUID(cafeID) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}
	photoKind, err := normalizePhotoKind(c.DefaultQuery("kind", cafePhotoKindCafe))
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
		return
	}

	var req cafePhotoReorderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}
	if len(req.PhotoIDs) == 0 {
		respondError(c, http.StatusBadRequest, "invalid_argument", "photo_ids не должен быть пустым.", nil)
		return
	}

	seen := make(map[string]struct{}, len(req.PhotoIDs))
	for i := range req.PhotoIDs {
		photoID := strings.TrimSpace(req.PhotoIDs[i])
		if photoID == "" {
			respondError(c, http.StatusBadRequest, "invalid_argument", "photo_ids содержит пустой id.", nil)
			return
		}
		if !isValidUUID(photoID) {
			respondError(c, http.StatusBadRequest, "invalid_argument", "photo_ids содержит некорректный id.", nil)
			return
		}
		if _, ok := seen[photoID]; ok {
			respondError(c, http.StatusBadRequest, "invalid_argument", "photo_ids содержит дубли.", nil)
			return
		}
		seen[photoID] = struct{}{}
		req.PhotoIDs[i] = photoID
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

	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	rows, err := tx.Query(
		ctx,
		`select id::text
		 from cafe_photos
		 where cafe_id = $1::uuid and kind = $2
		 order by position asc, created_at asc`,
		cafeID,
		photoKind,
	)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}
	existingIDs := make([]string, 0, len(req.PhotoIDs))
	for rows.Next() {
		var photoID string
		if err := rows.Scan(&photoID); err != nil {
			rows.Close()
			respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
			return
		}
		existingIDs = append(existingIDs, photoID)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}
	rows.Close()

	if len(existingIDs) != len(req.PhotoIDs) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "photo_ids должен содержать все фото кофейни.", nil)
		return
	}
	existingSet := make(map[string]struct{}, len(existingIDs))
	for _, photoID := range existingIDs {
		existingSet[photoID] = struct{}{}
	}
	for _, photoID := range req.PhotoIDs {
		if _, ok := existingSet[photoID]; !ok {
			respondError(c, http.StatusBadRequest, "invalid_argument", "photo_ids содержит чужой или несуществующий id.", nil)
			return
		}
	}

	if _, err := tx.Exec(
		ctx,
		`with ordered as (
			select id, ord::int as position
			from unnest($1::uuid[]) with ordinality as t(id, ord)
		)
		update cafe_photos cp
		set position = ordered.position
		from ordered
		where cp.cafe_id = $2::uuid
		  and cp.kind = $3
		  and cp.id = ordered.id`,
		req.PhotoIDs,
		cafeID,
		photoKind,
	); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	if photoKind == cafePhotoKindCafe {
		var hasCover bool
		if err := tx.QueryRow(
			ctx,
			`select exists(
			    select 1
			    from cafe_photos
			    where cafe_id = $1::uuid and kind = $2 and is_cover = true
			)`,
			cafeID,
			photoKind,
		).Scan(&hasCover); err != nil {
			respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
			return
		}
		if !hasCover && len(req.PhotoIDs) > 0 {
			if _, err := tx.Exec(
				ctx,
				`update cafe_photos
				 set is_cover = true
				 where cafe_id = $1::uuid and kind = $2 and id = $3::uuid`,
				cafeID,
				photoKind,
				req.PhotoIDs[0],
			); err != nil {
				respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
				return
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	photos, err := listCafePhotos(ctx, h.pool, cafeID, photoKind, h.cfg)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	c.JSON(http.StatusOK, cafePhotoListResponse{Photos: photos})
}

func (h *cafePhotoAPI) Delete(c *gin.Context) {
	cafeID := strings.TrimSpace(c.Param("id"))
	photoID := strings.TrimSpace(c.Param("photoID"))
	if cafeID == "" || photoID == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректные параметры id/photoID.", nil)
		return
	}
	if !isValidUUID(cafeID) || !isValidUUID(photoID) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректные параметры id/photoID.", nil)
		return
	}
	photoKind, err := normalizePhotoKind(c.DefaultQuery("kind", cafePhotoKindCafe))
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
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

	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	var objectKey string
	var wasCover bool
	err = tx.QueryRow(
		ctx,
		`select object_key, is_cover
		 from cafe_photos
		 where cafe_id = $1::uuid and kind = $2 and id = $3::uuid
		 for update`,
		cafeID,
		photoKind,
		photoID,
	).Scan(&objectKey, &wasCover)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(c, http.StatusNotFound, "not_found", "Фото не найдено.", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	if _, err := tx.Exec(
		ctx,
		`delete from cafe_photos where cafe_id = $1::uuid and kind = $2 and id = $3::uuid`,
		cafeID,
		photoKind,
		photoID,
	); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	if wasCover {
		var replacementID string
		err := tx.QueryRow(
			ctx,
			`select id::text
			 from cafe_photos
			 where cafe_id = $1::uuid and kind = $2
			 order by position asc, created_at asc
			 limit 1`,
			cafeID,
			photoKind,
		).Scan(&replacementID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
			return
		}
		if err == nil {
			if _, err := tx.Exec(
				ctx,
				`update cafe_photos set is_cover = true where cafe_id = $1::uuid and kind = $2 and id = $3::uuid`,
				cafeID,
				photoKind,
				replacementID,
			); err != nil {
				respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
				return
			}
		}
	}

	rows, err := tx.Query(
		ctx,
		`select id::text
		 from cafe_photos
		 where cafe_id = $1::uuid and kind = $2
		 order by is_cover desc, position asc, created_at asc`,
		cafeID,
		photoKind,
	)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}
	remainingIDs := make([]string, 0, 12)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
			return
		}
		remainingIDs = append(remainingIDs, id)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}
	rows.Close()

	if len(remainingIDs) > 0 {
		if _, err := tx.Exec(
			ctx,
			`with ordered as (
				select id, ord::int as position
				from unnest($1::uuid[]) with ordinality as t(id, ord)
			)
			update cafe_photos cp
			set position = ordered.position
			from ordered
			where cp.cafe_id = $2::uuid
			  and cp.kind = $3
			  and cp.id = ordered.id`,
			remainingIDs,
			cafeID,
			photoKind,
		); err != nil {
			respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	if h.s3 != nil && h.s3.Enabled() {
		deleteCtx, deleteCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer deleteCancel()
		if err := h.s3.DeleteObject(deleteCtx, objectKey); err != nil {
			log.Printf("photo delete warning: failed to delete object %q from S3: %v", objectKey, err)
		}
	}

	photos, err := listCafePhotos(ctx, h.pool, cafeID, photoKind, h.cfg)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	c.JSON(http.StatusOK, cafePhotoListResponse{Photos: photos})
}

func ensureCafeExists(ctx context.Context, pool *pgxpool.Pool, cafeID string) error {
	var exists bool
	if err := pool.QueryRow(
		ctx,
		`select exists(select 1 from cafes where id = $1::uuid)`,
		cafeID,
	).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return pgx.ErrNoRows
	}
	return nil
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

func isValidUUID(value string) bool {
	return uuidPattern.MatchString(strings.TrimSpace(value))
}

func attachCafeCoverPhotos(
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
		`select distinct on (cafe_id)
		    cafe_id::text,
		    object_key
		 from cafe_photos
		 where cafe_id = any($1::uuid[])
		   and kind = $2
		 order by cafe_id asc, is_cover desc, position asc, created_at asc`,
		cafeIDs,
		cafePhotoKindCafe,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	coverByCafeID := make(map[string]string, len(cafes))
	for rows.Next() {
		var (
			cafeID    string
			objectKey string
		)
		if err := rows.Scan(&cafeID, &objectKey); err != nil {
			return err
		}
		coverByCafeID[cafeID] = buildCafePhotoURL(mediaCfg, objectKey)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for i := range cafes {
		cover, ok := coverByCafeID[cafes[i].ID]
		if !ok || strings.TrimSpace(cover) == "" {
			continue
		}
		cafes[i].CoverPhotoURL = &cover
	}
	return nil
}

type cafePhotoRowsQuerier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func listCafePhotos(
	ctx context.Context,
	q cafePhotoRowsQuerier,
	cafeID string,
	photoKind string,
	mediaCfg config.MediaConfig,
) ([]model.CafePhotoResponse, error) {
	rows, err := q.Query(
		ctx,
		`select id::text, object_key, kind, position, is_cover
		 from cafe_photos
		 where cafe_id = $1::uuid and kind = $2
		 order by is_cover desc, position asc, created_at asc`,
		cafeID,
		photoKind,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	photos := make([]model.CafePhotoResponse, 0, 8)
	for rows.Next() {
		var (
			photoID   string
			objectKey string
			kind      string
			position  int
			isCover   bool
		)
		if err := rows.Scan(&photoID, &objectKey, &kind, &position, &isCover); err != nil {
			return nil, err
		}
		photos = append(photos, model.CafePhotoResponse{
			ID:       photoID,
			URL:      buildCafePhotoURL(mediaCfg, objectKey),
			Kind:     kind,
			IsCover:  isCover,
			Position: position,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return photos, nil
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
