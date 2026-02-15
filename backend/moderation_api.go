package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/config"
	"backend/internal/media"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	entityTypeCafe            = "cafe"
	entityTypeCafeDescription = "cafe_description"
	entityTypeCafePhoto       = "cafe_photo"
	entityTypeMenuPhoto       = "menu_photo"
	entityTypeReview          = "review"

	actionTypeCreate = "create"
	actionTypeUpdate = "update"
	actionTypeDelete = "delete"

	statusPending = "pending"
	statusApprove = "approved"
	statusReject  = "rejected"
)

type moderationAPI struct {
	pool *pgxpool.Pool
	s3   *media.Service
	cfg  config.MediaConfig
}

type moderationSubmissionResponse struct {
	ID               string         `json:"id"`
	AuthorUserID     string         `json:"author_user_id"`
	AuthorLabel      string         `json:"author_label,omitempty"`
	EntityType       string         `json:"entity_type"`
	ActionType       string         `json:"action_type"`
	TargetID         *string        `json:"target_id,omitempty"`
	Payload          map[string]any `json:"payload"`
	Status           string         `json:"status"`
	ModeratorID      *string        `json:"moderator_id,omitempty"`
	ModeratorComment *string        `json:"moderator_comment,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DecidedAt        *time.Time     `json:"decided_at,omitempty"`
}

type submissionListResponse struct {
	Items []moderationSubmissionResponse `json:"items"`
}

type submissionPhotoPresignRequest struct {
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
}

type submissionPhotoPresignResponse struct {
	UploadURL string            `json:"upload_url"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers"`
	ObjectKey string            `json:"object_key"`
	FileURL   string            `json:"file_url"`
	ExpiresAt time.Time         `json:"expires_at"`
}

type submitCafeCreateRequest struct {
	Name               string   `json:"name"`
	Address            string   `json:"address"`
	Description        string   `json:"description"`
	Latitude           float64  `json:"latitude"`
	Longitude          float64  `json:"longitude"`
	Amenities          []string `json:"amenities"`
	PhotoObjectKeys    []string `json:"photo_object_keys"`
	MenuPhotoObjectKey []string `json:"menu_photo_object_keys"`
}

type submitDescriptionRequest struct {
	Description string `json:"description"`
}

type submitPhotosRequest struct {
	ObjectKeys []string `json:"object_keys"`
}

type moderationDecisionRequest struct {
	Comment string `json:"comment"`
}

type cafeCreatePayload struct {
	Name                string   `json:"name"`
	Address             string   `json:"address"`
	Description         string   `json:"description,omitempty"`
	Latitude            float64  `json:"latitude"`
	Longitude           float64  `json:"longitude"`
	Amenities           []string `json:"amenities,omitempty"`
	PhotoObjectKeys     []string `json:"photo_object_keys,omitempty"`
	MenuPhotoObjectKeys []string `json:"menu_photo_object_keys,omitempty"`
}

type descriptionPayload struct {
	Description string `json:"description"`
}

type photosPayload struct {
	ObjectKeys []string `json:"object_keys"`
}

func newModerationAPI(pool *pgxpool.Pool, s3 *media.Service, cfg config.MediaConfig) *moderationAPI {
	return &moderationAPI{
		pool: pool,
		s3:   s3,
		cfg:  cfg,
	}
}

func (h *moderationAPI) PresignPhoto(c *gin.Context) {
	if h.s3 == nil || !h.s3.Enabled() {
		respondError(c, http.StatusServiceUnavailable, "service_unavailable", "Загрузка фото сейчас недоступна.", nil)
		return
	}

	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	var req submissionPhotoPresignRequest
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

	token, err := auth.GenerateToken(9)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	objectKey := fmt.Sprintf(
		"pending/submissions/%s/%d_%s%s",
		userID,
		time.Now().Unix(),
		token,
		ext,
	)
	presigned, err := h.s3.PresignPutObject(ctx, objectKey, contentType)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось подготовить загрузку файла.", nil)
		return
	}

	c.JSON(http.StatusOK, submissionPhotoPresignResponse{
		UploadURL: presigned.UploadURL,
		Method:    http.MethodPut,
		Headers:   presigned.Headers,
		ObjectKey: objectKey,
		FileURL:   h.s3.PublicURL(objectKey),
		ExpiresAt: presigned.ExpiresAt,
	})
}

func (h *moderationAPI) SubmitCafeCreate(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	var req submitCafeCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	name := strings.TrimSpace(req.Name)
	address := strings.TrimSpace(req.Address)
	if name == "" || address == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Название и адрес обязательны.", nil)
		return
	}
	if !isFinite(req.Latitude) || req.Latitude < -90 || req.Latitude > 90 {
		respondError(c, http.StatusBadRequest, "invalid_argument", "latitude должен быть в диапазоне от -90 до 90.", nil)
		return
	}
	if !isFinite(req.Longitude) || req.Longitude < -180 || req.Longitude > 180 {
		respondError(c, http.StatusBadRequest, "invalid_argument", "longitude должен быть в диапазоне от -180 до 180.", nil)
		return
	}

	photoKeys, err := h.validatePendingObjectKeys(userID, req.PhotoObjectKeys)
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
		return
	}
	menuPhotoKeys, err := h.validatePendingObjectKeys(userID, req.MenuPhotoObjectKey)
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
		return
	}

	payload := cafeCreatePayload{
		Name:                name,
		Address:             address,
		Description:         strings.TrimSpace(req.Description),
		Latitude:            req.Latitude,
		Longitude:           req.Longitude,
		Amenities:           normalizeAmenities(req.Amenities),
		PhotoObjectKeys:     photoKeys,
		MenuPhotoObjectKeys: menuPhotoKeys,
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()
	item, err := h.createSubmission(ctx, userID, entityTypeCafe, actionTypeCreate, nil, payload)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось создать заявку.", nil)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *moderationAPI) SubmitCafeDescription(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	cafeID := strings.TrimSpace(c.Param("id"))
	if !isValidUUID(cafeID) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	var req submitDescriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}
	description := strings.TrimSpace(req.Description)
	if description == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Описание не должно быть пустым.", nil)
		return
	}
	if len([]rune(description)) > 2000 {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Описание слишком длинное.", gin.H{"max_chars": 2000})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()
	if err := ensureCafeExists(ctx, h.pool, cafeID); err != nil {
		if err == pgx.ErrNoRows {
			respondError(c, http.StatusNotFound, "not_found", "Кофейня не найдена.", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	item, err := h.createSubmission(
		ctx,
		userID,
		entityTypeCafeDescription,
		actionTypeUpdate,
		&cafeID,
		descriptionPayload{Description: description},
	)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось создать заявку.", nil)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *moderationAPI) SubmitCafePhotos(c *gin.Context) {
	h.submitPhotos(c, entityTypeCafePhoto)
}

func (h *moderationAPI) SubmitMenuPhotos(c *gin.Context) {
	h.submitPhotos(c, entityTypeMenuPhoto)
}

func (h *moderationAPI) submitPhotos(c *gin.Context, entityType string) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	cafeID := strings.TrimSpace(c.Param("id"))
	if !isValidUUID(cafeID) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	var req submitPhotosRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	keys, err := h.validatePendingObjectKeys(userID, req.ObjectKeys)
	if err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
		return
	}
	if len(keys) == 0 {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Нужно выбрать хотя бы одно фото.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()
	if err := ensureCafeExists(ctx, h.pool, cafeID); err != nil {
		if err == pgx.ErrNoRows {
			respondError(c, http.StatusNotFound, "not_found", "Кофейня не найдена.", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	item, err := h.createSubmission(
		ctx,
		userID,
		entityType,
		actionTypeCreate,
		&cafeID,
		photosPayload{ObjectKeys: keys},
	)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось создать заявку.", nil)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *moderationAPI) ListMine(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	rows, err := h.pool.Query(
		ctx,
		`select id::text, author_user_id::text, entity_type, action_type, target_id::text, payload, status,
		        moderator_id::text, moderator_comment, created_at, updated_at, decided_at
		   from moderation_submissions
		  where author_user_id = $1::uuid
		  order by created_at desc
		  limit 200`,
		userID,
	)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить заявки.", nil)
		return
	}
	defer rows.Close()

	out := make([]moderationSubmissionResponse, 0, 32)
	for rows.Next() {
		item, scanErr := scanSubmissionRow(rows, "")
		if scanErr != nil {
			respondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить заявки.", nil)
			return
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить заявки.", nil)
		return
	}
	c.JSON(http.StatusOK, submissionListResponse{Items: out})
}

func (h *moderationAPI) ListModeration(c *gin.Context) {
	status := strings.TrimSpace(strings.ToLower(c.DefaultQuery("status", statusPending)))
	if status != "" && status != statusPending && status != statusApprove && status != statusReject && status != "needs_changes" && status != "cancelled" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный status.", nil)
		return
	}
	entityType := strings.TrimSpace(strings.ToLower(c.Query("entity_type")))

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	rows, err := h.pool.Query(
		ctx,
		`select ms.id::text, ms.author_user_id::text, ms.entity_type, ms.action_type, ms.target_id::text, ms.payload, ms.status,
		        ms.moderator_id::text, ms.moderator_comment, ms.created_at, ms.updated_at, ms.decided_at,
		        coalesce(u.display_name, u.email_normalized, u.id::text) as author_label
		   from moderation_submissions ms
		   join users u on u.id = ms.author_user_id
		  where ($1 = '' or ms.status = $1)
		    and ($2 = '' or ms.entity_type = $2)
		  order by ms.created_at asc
		  limit 300`,
		status,
		entityType,
	)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить модерацию.", nil)
		return
	}
	defer rows.Close()

	out := make([]moderationSubmissionResponse, 0, 64)
	for rows.Next() {
		item, scanErr := scanSubmissionRow(rows, "author")
		if scanErr != nil {
			respondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить модерацию.", nil)
			return
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить модерацию.", nil)
		return
	}
	c.JSON(http.StatusOK, submissionListResponse{Items: out})
}

func (h *moderationAPI) GetModerationItem(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if !isValidUUID(id) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id заявки.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	row := h.pool.QueryRow(
		ctx,
		`select ms.id::text, ms.author_user_id::text, ms.entity_type, ms.action_type, ms.target_id::text, ms.payload, ms.status,
		        ms.moderator_id::text, ms.moderator_comment, ms.created_at, ms.updated_at, ms.decided_at,
		        coalesce(u.display_name, u.email_normalized, u.id::text) as author_label
		   from moderation_submissions ms
		   join users u on u.id = ms.author_user_id
		  where ms.id = $1::uuid`,
		id,
	)

	item, err := scanSubmissionRow(row, "author")
	if err != nil {
		if err == pgx.ErrNoRows {
			respondError(c, http.StatusNotFound, "not_found", "Заявка не найдена.", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить заявку.", nil)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *moderationAPI) Approve(c *gin.Context) {
	h.decide(c, statusApprove)
}

func (h *moderationAPI) Reject(c *gin.Context) {
	h.decide(c, statusReject)
}

func (h *moderationAPI) decide(c *gin.Context, decision string) {
	submissionID := strings.TrimSpace(c.Param("id"))
	if !isValidUUID(submissionID) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id заявки.", nil)
		return
	}
	moderatorID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(moderatorID) == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	var req moderationDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil && !strings.Contains(err.Error(), "EOF") {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}
	comment := strings.TrimSpace(req.Comment)
	if decision == statusReject && comment == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Укажите причину отклонения.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	row := tx.QueryRow(
		ctx,
		`select id::text, author_user_id::text, entity_type, action_type, target_id::text, payload, status,
		        moderator_id::text, moderator_comment, created_at, updated_at, decided_at
		   from moderation_submissions
		  where id = $1::uuid
		  for update`,
		submissionID,
	)
	submission, err := scanSubmissionRow(row, "")
	if err != nil {
		if err == pgx.ErrNoRows {
			respondError(c, http.StatusNotFound, "not_found", "Заявка не найдена.", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}
	if submission.Status != statusPending {
		respondError(c, http.StatusConflict, "conflict", "Заявка уже обработана.", nil)
		return
	}

	if decision == statusApprove {
		if err := h.applySubmission(ctx, tx, submission, moderatorID); err != nil {
			respondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
			return
		}
	}

	var commentArg any
	if comment != "" {
		commentArg = comment
	}
	if _, err := tx.Exec(
		ctx,
		`update moderation_submissions
		    set status = $2, moderator_id = $3::uuid, moderator_comment = $4, decided_at = now(), updated_at = now()
		  where id = $1::uuid`,
		submissionID,
		decision,
		moderatorID,
		commentArg,
	); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}
	if _, err := tx.Exec(
		ctx,
		`insert into moderation_events (submission_id, actor_user_id, event_type, comment)
		 values ($1::uuid, $2::uuid, $3, $4)`,
		submissionID,
		moderatorID,
		decision,
		commentArg,
	); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *moderationAPI) applySubmission(
	ctx context.Context,
	tx pgx.Tx,
	submission moderationSubmissionResponse,
	moderatorID string,
) error {
	switch submission.EntityType {
	case entityTypeCafe:
		if submission.ActionType != actionTypeCreate {
			return fmt.Errorf("Неподдерживаемое действие для cafe")
		}
		return h.applyCafeCreate(ctx, tx, submission, moderatorID)
	case entityTypeCafeDescription:
		if submission.ActionType != actionTypeUpdate {
			return fmt.Errorf("Неподдерживаемое действие для cafe_description")
		}
		return h.applyCafeDescription(ctx, tx, submission)
	case entityTypeCafePhoto:
		if submission.ActionType != actionTypeCreate {
			return fmt.Errorf("Неподдерживаемое действие для cafe_photo")
		}
		return h.applyCafePhotos(ctx, tx, submission, true)
	case entityTypeMenuPhoto:
		if submission.ActionType != actionTypeCreate {
			return fmt.Errorf("Неподдерживаемое действие для menu_photo")
		}
		return h.applyCafePhotos(ctx, tx, submission, false)
	default:
		return fmt.Errorf("Этот тип заявки пока не поддерживается")
	}
}

func (h *moderationAPI) applyCafeCreate(
	ctx context.Context,
	tx pgx.Tx,
	submission moderationSubmissionResponse,
	moderatorID string,
) error {
	var payload cafeCreatePayload
	if err := decodeSubmissionPayload(submission.Payload, &payload); err != nil {
		return fmt.Errorf("Некорректный payload заявки")
	}
	name := strings.TrimSpace(payload.Name)
	address := strings.TrimSpace(payload.Address)
	if name == "" || address == "" {
		return fmt.Errorf("Название и адрес обязательны")
	}

	var descriptionArg any
	description := strings.TrimSpace(payload.Description)
	if description != "" {
		descriptionArg = description
	}
	var cafeID string
	if err := tx.QueryRow(
		ctx,
		`insert into cafes (name, address, description, lat, lng, amenities, geog)
		 values ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography)
		 returning id::text`,
		name,
		address,
		descriptionArg,
		payload.Latitude,
		payload.Longitude,
		normalizeAmenities(payload.Amenities),
	).Scan(&cafeID); err != nil {
		return fmt.Errorf("Не удалось создать кофейню")
	}

	combinedKeys := append([]string{}, payload.PhotoObjectKeys...)
	combinedMenu := append([]string{}, payload.MenuPhotoObjectKeys...)

	if len(combinedKeys) > 0 {
		if err := h.insertCafePhotos(ctx, tx, cafeID, moderatorID, combinedKeys, true); err != nil {
			return err
		}
	}
	if len(combinedMenu) > 0 {
		if err := h.insertCafePhotos(ctx, tx, cafeID, moderatorID, combinedMenu, false); err != nil {
			return err
		}
	}
	return nil
}

func (h *moderationAPI) applyCafeDescription(
	ctx context.Context,
	tx pgx.Tx,
	submission moderationSubmissionResponse,
) error {
	if submission.TargetID == nil || strings.TrimSpace(*submission.TargetID) == "" {
		return fmt.Errorf("Не указан target_id")
	}
	var payload descriptionPayload
	if err := decodeSubmissionPayload(submission.Payload, &payload); err != nil {
		return fmt.Errorf("Некорректный payload заявки")
	}
	description := strings.TrimSpace(payload.Description)
	if description == "" {
		return fmt.Errorf("Описание не должно быть пустым")
	}

	result, err := tx.Exec(
		ctx,
		`update cafes set description = $2 where id = $1::uuid`,
		*submission.TargetID,
		description,
	)
	if err != nil {
		return fmt.Errorf("Не удалось обновить описание")
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("Кофейня не найдена")
	}
	return nil
}

func (h *moderationAPI) applyCafePhotos(
	ctx context.Context,
	tx pgx.Tx,
	submission moderationSubmissionResponse,
	allowCover bool,
) error {
	if submission.TargetID == nil || strings.TrimSpace(*submission.TargetID) == "" {
		return fmt.Errorf("Не указан target_id")
	}
	var payload photosPayload
	if err := decodeSubmissionPayload(submission.Payload, &payload); err != nil {
		return fmt.Errorf("Некорректный payload заявки")
	}
	if len(payload.ObjectKeys) == 0 {
		return fmt.Errorf("Список фото пуст")
	}
	return h.insertCafePhotos(ctx, tx, *submission.TargetID, submission.AuthorUserID, payload.ObjectKeys, allowCover)
}

func (h *moderationAPI) insertCafePhotos(
	ctx context.Context,
	tx pgx.Tx,
	cafeID string,
	uploaderID string,
	objectKeys []string,
	allowCover bool,
) error {
	if err := ensureCafeExists(ctx, h.pool, cafeID); err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("Кофейня не найдена")
		}
		return fmt.Errorf("Внутренняя ошибка проверки кофейни")
	}

	var count int
	if err := tx.QueryRow(
		ctx,
		`select count(*) from cafe_photos where cafe_id = $1::uuid`,
		cafeID,
	).Scan(&count); err != nil {
		return fmt.Errorf("Внутренняя ошибка сохранения фото")
	}

	position := count
	for index, rawKey := range objectKeys {
		key := strings.TrimSpace(strings.TrimPrefix(rawKey, "/"))
		if key == "" {
			continue
		}
		var (
			sizeBytes int64 = 0
			mimeType  string
		)
		if h.s3 != nil && h.s3.Enabled() {
			var headErr error
			sizeBytes, mimeType, headErr = h.s3.HeadObject(ctx, key)
			if headErr != nil {
				return fmt.Errorf("Файл %s не найден в хранилище", key)
			}
			if _, ok := allowedPhotoContentTypes[normalizeContentType(mimeType)]; !ok {
				return fmt.Errorf("Файл %s имеет неподдерживаемый формат", key)
			}
		} else {
			mimeType = "image/jpeg"
		}

		position++
		isCover := false
		if allowCover && count == 0 && index == 0 {
			isCover = true
		}

		var uploadedBy any
		if strings.TrimSpace(uploaderID) != "" && isValidUUID(uploaderID) {
			uploadedBy = uploaderID
		}

		if _, err := tx.Exec(
			ctx,
			`insert into cafe_photos (cafe_id, object_key, mime_type, size_bytes, position, is_cover, uploaded_by)
			 values ($1::uuid, $2, $3, $4, $5, $6, $7::uuid)`,
			cafeID,
			key,
			normalizeContentType(mimeType),
			sizeBytes,
			position,
			isCover,
			uploadedBy,
		); err != nil {
			if isUniqueViolationPg(err) {
				continue
			}
			return fmt.Errorf("Не удалось сохранить фото")
		}
	}
	return nil
}

func (h *moderationAPI) createSubmission(
	ctx context.Context,
	authorUserID string,
	entityType string,
	actionType string,
	targetID *string,
	payload any,
) (moderationSubmissionResponse, error) {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return moderationSubmissionResponse{}, err
	}

	var targetArg any
	if targetID != nil && strings.TrimSpace(*targetID) != "" {
		targetArg = strings.TrimSpace(*targetID)
	}

	row := h.pool.QueryRow(
		ctx,
		`insert into moderation_submissions (author_user_id, entity_type, action_type, target_id, payload)
		 values ($1::uuid, $2, $3, $4::uuid, $5::jsonb)
		 returning id::text, author_user_id::text, entity_type, action_type, target_id::text, payload, status,
		           moderator_id::text, moderator_comment, created_at, updated_at, decided_at`,
		authorUserID,
		entityType,
		actionType,
		targetArg,
		payloadJSON,
	)
	return scanSubmissionRow(row, "")
}

func (h *moderationAPI) validatePendingObjectKeys(userID string, keys []string) ([]string, error) {
	if len(keys) == 0 {
		return nil, nil
	}
	if h.s3 == nil || !h.s3.Enabled() {
		return nil, fmt.Errorf("Загрузка фото сейчас недоступна")
	}

	normalized := make([]string, 0, len(keys))
	prefix := fmt.Sprintf("pending/submissions/%s/", strings.TrimSpace(userID))
	seen := make(map[string]struct{}, len(keys))
	for _, keyRaw := range keys {
		key := strings.TrimSpace(strings.TrimPrefix(keyRaw, "/"))
		if key == "" {
			continue
		}
		if !strings.HasPrefix(key, prefix) {
			return nil, fmt.Errorf("Некорректный object_key")
		}
		if _, ok := seen[key]; ok {
			continue
		}
		sizeBytes, mimeType, err := h.s3.HeadObject(context.Background(), key)
		if err != nil {
			return nil, fmt.Errorf("Файл %s не найден в хранилище", key)
		}
		if sizeBytes <= 0 || sizeBytes > h.cfg.S3MaxUploadBytes {
			return nil, fmt.Errorf("Файл %s имеет недопустимый размер", key)
		}
		if _, ok := allowedPhotoContentTypes[normalizeContentType(mimeType)]; !ok {
			return nil, fmt.Errorf("Файл %s имеет неподдерживаемый формат", key)
		}
		seen[key] = struct{}{}
		normalized = append(normalized, key)
	}
	return normalized, nil
}

func normalizeAmenities(raw []string) []string {
	if len(raw) == 0 {
		return nil
	}
	out := make([]string, 0, len(raw))
	seen := make(map[string]struct{}, len(raw))
	for _, item := range raw {
		val := strings.ToLower(strings.TrimSpace(item))
		if val == "" {
			continue
		}
		if _, ok := seen[val]; ok {
			continue
		}
		seen[val] = struct{}{}
		out = append(out, val)
	}
	return out
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanSubmissionRow(row rowScanner, authorLabelMode string) (moderationSubmissionResponse, error) {
	var (
		item            moderationSubmissionResponse
		targetID        *string
		payloadRaw      []byte
		moderatorID     *string
		moderatorRemark *string
		decidedAt       *time.Time
		authorLabel     *string
	)

	dest := []any{
		&item.ID,
		&item.AuthorUserID,
		&item.EntityType,
		&item.ActionType,
		&targetID,
		&payloadRaw,
		&item.Status,
		&moderatorID,
		&moderatorRemark,
		&item.CreatedAt,
		&item.UpdatedAt,
		&decidedAt,
	}
	if authorLabelMode == "author" {
		dest = append(dest, &authorLabel)
	}
	if err := row.Scan(dest...); err != nil {
		return moderationSubmissionResponse{}, err
	}

	item.TargetID = targetID
	item.ModeratorID = moderatorID
	item.ModeratorComment = moderatorRemark
	item.DecidedAt = decidedAt
	if authorLabel != nil {
		item.AuthorLabel = strings.TrimSpace(*authorLabel)
	}

	payloadMap := map[string]any{}
	if len(payloadRaw) > 0 {
		if err := json.Unmarshal(payloadRaw, &payloadMap); err != nil {
			payloadMap = map[string]any{}
		}
	}
	item.Payload = payloadMap

	return item, nil
}

func decodeSubmissionPayload(payload map[string]any, target any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, target)
}

