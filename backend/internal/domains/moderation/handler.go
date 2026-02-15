package moderation

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/config"
	"backend/internal/domains/photos"
	"backend/internal/media"
	"backend/internal/shared/httpx"
	"backend/internal/shared/validation"

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

type Handler struct {
	pool       *pgxpool.Pool
	s3         *media.Service
	cfg        config.MediaConfig
	repository *Repository
	service    *Service
}

type moderationSubmissionResponse struct {
	ID               string         `json:"id"`
	AuthorUserID     string         `json:"author_user_id"`
	AuthorLabel      string         `json:"author_label,omitempty"`
	EntityType       string         `json:"entity_type"`
	ActionType       string         `json:"action_type"`
	TargetID         *string        `json:"target_id,omitempty"`
	TargetCafeName   *string        `json:"target_cafe_name,omitempty"`
	TargetCafeAddr   *string        `json:"target_cafe_address,omitempty"`
	TargetCafeLat    *float64       `json:"target_cafe_latitude,omitempty"`
	TargetCafeLng    *float64       `json:"target_cafe_longitude,omitempty"`
	TargetCafeMapURL *string        `json:"target_cafe_map_url,omitempty"`
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

func NewHandler(pool *pgxpool.Pool, s3 *media.Service, cfg config.MediaConfig) *Handler {
	repository := NewRepository(pool)
	service := NewService(repository, s3, cfg)
	return &Handler{
		pool:       pool,
		s3:         s3,
		cfg:        cfg,
		repository: repository,
		service:    service,
	}
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

	var req submissionPhotoPresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	contentType := photos.NormalizeContentType(req.ContentType)
	ext, ok := photos.AllowedPhotoContentTypes[contentType]
	if !ok {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Неподдерживаемый формат изображения.", nil)
		return
	}
	if req.SizeBytes <= 0 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Размер файла должен быть больше 0.", nil)
		return
	}
	if req.SizeBytes > h.cfg.S3MaxUploadBytes {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Размер файла превышает допустимый лимит.", gin.H{
			"max_upload_bytes": h.cfg.S3MaxUploadBytes,
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	token, err := auth.GenerateToken(9)
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
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
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось подготовить загрузку файла.", nil)
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

func (h *Handler) SubmitCafeCreate(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	var req submitCafeCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	name := strings.TrimSpace(req.Name)
	address := strings.TrimSpace(req.Address)
	if name == "" || address == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Название и адрес обязательны.", nil)
		return
	}
	if !validation.IsFinite(req.Latitude) || req.Latitude < -90 || req.Latitude > 90 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "latitude должен быть в диапазоне от -90 до 90.", nil)
		return
	}
	if !validation.IsFinite(req.Longitude) || req.Longitude < -180 || req.Longitude > 180 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "longitude должен быть в диапазоне от -180 до 180.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()
	photoKeys, err := h.validatePendingObjectKeys(ctx, userID, req.PhotoObjectKeys)
	if err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
		return
	}
	menuPhotoKeys, err := h.validatePendingObjectKeys(ctx, userID, req.MenuPhotoObjectKey)
	if err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
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

	item, err := h.createSubmission(ctx, userID, entityTypeCafe, actionTypeCreate, nil, payload)
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось создать заявку.", nil)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) SubmitCafeDescription(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	cafeID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(cafeID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	var req submitDescriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}
	description := strings.TrimSpace(req.Description)
	if description == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Описание не должно быть пустым.", nil)
		return
	}
	if len([]rune(description)) > 2000 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Описание слишком длинное.", gin.H{"max_chars": 2000})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()
	if err := photos.EnsureCafeExists(ctx, h.pool, cafeID); err != nil {
		if err == pgx.ErrNoRows {
			httpx.RespondError(c, http.StatusNotFound, "not_found", "Кофейня не найдена.", nil)
			return
		}
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
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
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось создать заявку.", nil)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) SubmitCafePhotos(c *gin.Context) {
	h.submitPhotos(c, entityTypeCafePhoto)
}

func (h *Handler) SubmitMenuPhotos(c *gin.Context) {
	h.submitPhotos(c, entityTypeMenuPhoto)
}

func (h *Handler) submitPhotos(c *gin.Context, entityType string) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	cafeID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(cafeID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	var req submitPhotosRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	keys, err := h.validatePendingObjectKeys(ctx, userID, req.ObjectKeys)
	if err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
		return
	}
	if len(keys) == 0 {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Нужно выбрать хотя бы одно фото.", nil)
		return
	}

	if err := photos.EnsureCafeExists(ctx, h.pool, cafeID); err != nil {
		if err == pgx.ErrNoRows {
			httpx.RespondError(c, http.StatusNotFound, "not_found", "Кофейня не найдена.", nil)
			return
		}
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
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
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось создать заявку.", nil)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) ListMine(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	rows, err := h.pool.Query(
		ctx,
		`select ms.id::text, ms.author_user_id::text, ms.entity_type, ms.action_type, ms.target_id::text, ms.payload, ms.status,
		        ms.moderator_id::text, ms.moderator_comment, ms.created_at, ms.updated_at, ms.decided_at,
		        c.name, c.address, c.lat, c.lng
		   from moderation_submissions ms
		   left join cafes c on c.id = ms.target_id
		  where ms.author_user_id = $1::uuid
		  order by ms.created_at desc
		  limit 200`,
		userID,
	)
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить заявки.", nil)
		return
	}
	defer rows.Close()

	out := make([]moderationSubmissionResponse, 0, 32)
	for rows.Next() {
		item, scanErr := scanSubmissionRow(rows, "cafe")
		if scanErr != nil {
			httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить заявки.", nil)
			return
		}
		h.enrichSubmission(&item)
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить заявки.", nil)
		return
	}
	c.JSON(http.StatusOK, submissionListResponse{Items: out})
}

func (h *Handler) ListModeration(c *gin.Context) {
	status := strings.TrimSpace(strings.ToLower(c.DefaultQuery("status", statusPending)))
	if status != "" && status != statusPending && status != statusApprove && status != statusReject && status != "needs_changes" && status != "cancelled" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный status.", nil)
		return
	}
	entityType := strings.TrimSpace(strings.ToLower(c.Query("entity_type")))

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	rows, err := h.pool.Query(
		ctx,
		`select ms.id::text, ms.author_user_id::text, ms.entity_type, ms.action_type, ms.target_id::text, ms.payload, ms.status,
		        ms.moderator_id::text, ms.moderator_comment, ms.created_at, ms.updated_at, ms.decided_at,
		        coalesce(u.display_name, u.email_normalized, u.id::text) as author_label,
		        c.name, c.address, c.lat, c.lng
		   from moderation_submissions ms
		   join users u on u.id = ms.author_user_id
		   left join cafes c on c.id = ms.target_id
		  where ($1 = '' or ms.status = $1)
		    and ($2 = '' or ms.entity_type = $2)
		  order by ms.created_at asc
		  limit 300`,
		status,
		entityType,
	)
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить модерацию.", nil)
		return
	}
	defer rows.Close()

	out := make([]moderationSubmissionResponse, 0, 64)
	for rows.Next() {
		item, scanErr := scanSubmissionRow(rows, "author+cafe")
		if scanErr != nil {
			httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить модерацию.", nil)
			return
		}
		h.enrichSubmission(&item)
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить модерацию.", nil)
		return
	}
	c.JSON(http.StatusOK, submissionListResponse{Items: out})
}

func (h *Handler) GetModerationItem(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(id) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id заявки.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Second)
	defer cancel()

	row := h.pool.QueryRow(
		ctx,
		`select ms.id::text, ms.author_user_id::text, ms.entity_type, ms.action_type, ms.target_id::text, ms.payload, ms.status,
		        ms.moderator_id::text, ms.moderator_comment, ms.created_at, ms.updated_at, ms.decided_at,
		        coalesce(u.display_name, u.email_normalized, u.id::text) as author_label,
		        c.name, c.address, c.lat, c.lng
		   from moderation_submissions ms
		   join users u on u.id = ms.author_user_id
		   left join cafes c on c.id = ms.target_id
		  where ms.id = $1::uuid`,
		id,
	)

	item, err := scanSubmissionRow(row, "author+cafe")
	if err != nil {
		if err == pgx.ErrNoRows {
			httpx.RespondError(c, http.StatusNotFound, "not_found", "Заявка не найдена.", nil)
			return
		}
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить заявку.", nil)
		return
	}
	h.enrichSubmission(&item)
	c.JSON(http.StatusOK, item)
}

func (h *Handler) Approve(c *gin.Context) {
	h.decide(c, statusApprove)
}

func (h *Handler) Reject(c *gin.Context) {
	h.decide(c, statusReject)
}

func (h *Handler) decide(c *gin.Context, decision string) {
	submissionID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(submissionID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id заявки.", nil)
		return
	}
	moderatorID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(moderatorID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	var req moderationDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil && !strings.Contains(err.Error(), "EOF") {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}
	comment := strings.TrimSpace(req.Comment)
	if decision == statusReject && comment == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Укажите причину отклонения.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
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
			httpx.RespondError(c, http.StatusNotFound, "not_found", "Заявка не найдена.", nil)
			return
		}
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}
	if submission.Status != statusPending {
		httpx.RespondError(c, http.StatusConflict, "conflict", "Заявка уже обработана.", nil)
		return
	}

	if decision == statusApprove {
		if err := h.applySubmission(ctx, tx, submission, moderatorID); err != nil {
			httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
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
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
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
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.RespondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *Handler) applySubmission(
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
		return h.applyCafePhotos(ctx, tx, submission, photos.KindCafe, true)
	case entityTypeMenuPhoto:
		if submission.ActionType != actionTypeCreate {
			return fmt.Errorf("Неподдерживаемое действие для menu_photo")
		}
		return h.applyCafePhotos(ctx, tx, submission, photos.KindMenu, false)
	default:
		return fmt.Errorf("Этот тип заявки пока не поддерживается")
	}
}

func (h *Handler) applyCafeCreate(
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
	description := strings.TrimSpace(payload.Description)
	if !validation.IsFinite(payload.Latitude) || payload.Latitude < -90 || payload.Latitude > 90 {
		return fmt.Errorf("Некорректное значение latitude в заявке")
	}
	if !validation.IsFinite(payload.Longitude) || payload.Longitude < -180 || payload.Longitude > 180 {
		return fmt.Errorf("Некорректное значение longitude в заявке")
	}
	amenities := normalizeAmenities(payload.Amenities)
	if amenities == nil {
		amenities = []string{}
	}

	var cafeID string
	if err := tx.QueryRow(
		ctx,
		`insert into cafes (name, address, description, lat, lng, amenities, geog)
		 values ($1::text, $2::text, nullif($3::text, ''), $4::double precision, $5::double precision, $6::text[], ST_SetSRID(ST_MakePoint($5::double precision, $4::double precision), 4326)::geography)
		 returning id::text`,
		name,
		address,
		description,
		payload.Latitude,
		payload.Longitude,
		amenities,
	).Scan(&cafeID); err != nil {
		log.Printf("moderation: applyCafeCreate insert failed: %v", err)
		return fmt.Errorf("Не удалось создать кофейню")
	}

	combinedKeys := append([]string{}, payload.PhotoObjectKeys...)
	combinedMenu := append([]string{}, payload.MenuPhotoObjectKeys...)

	if len(combinedKeys) > 0 {
		if err := h.insertCafePhotos(ctx, tx, cafeID, moderatorID, combinedKeys, photos.KindCafe, true); err != nil {
			return err
		}
	}
	if len(combinedMenu) > 0 {
		if err := h.insertCafePhotos(ctx, tx, cafeID, moderatorID, combinedMenu, photos.KindMenu, false); err != nil {
			return err
		}
	}
	return nil
}

func (h *Handler) applyCafeDescription(
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

func (h *Handler) applyCafePhotos(
	ctx context.Context,
	tx pgx.Tx,
	submission moderationSubmissionResponse,
	photoKind string,
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
	return h.insertCafePhotos(
		ctx,
		tx,
		*submission.TargetID,
		submission.AuthorUserID,
		payload.ObjectKeys,
		photoKind,
		allowCover,
	)
}

func (h *Handler) insertCafePhotos(
	ctx context.Context,
	tx pgx.Tx,
	cafeID string,
	uploaderID string,
	objectKeys []string,
	photoKind string,
	allowCover bool,
) error {
	var cafeExists bool
	// Must check inside the same transaction: for approved "create cafe" submissions
	// the cafe row is not visible outside tx until commit.
	if err := tx.QueryRow(
		ctx,
		`select exists(select 1 from cafes where id = $1::uuid)`,
		cafeID,
	).Scan(&cafeExists); err != nil {
		return fmt.Errorf("Внутренняя ошибка проверки кофейни")
	}
	if !cafeExists {
		return fmt.Errorf("Кофейня не найдена")
	}

	var count int
	if err := tx.QueryRow(
		ctx,
		`select count(*) from cafe_photos where cafe_id = $1::uuid and kind = $2`,
		cafeID,
		photoKind,
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
			if _, ok := photos.AllowedPhotoContentTypes[photos.NormalizeContentType(mimeType)]; !ok {
				return fmt.Errorf("Файл %s имеет неподдерживаемый формат", key)
			}
		} else {
			mimeType = "image/jpeg"
		}

		position++
		isCover := false
		if allowCover && photoKind == photos.KindCafe && count == 0 && index == 0 {
			isCover = true
		}

		var uploadedBy any
		if strings.TrimSpace(uploaderID) != "" && validation.IsValidUUID(uploaderID) {
			uploadedBy = uploaderID
		}

		if _, err := tx.Exec(
			ctx,
			`insert into cafe_photos (cafe_id, object_key, mime_type, size_bytes, kind, position, is_cover, uploaded_by)
			 values ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid)`,
			cafeID,
			key,
			photos.NormalizeContentType(mimeType),
			sizeBytes,
			photoKind,
			position,
			isCover,
			uploadedBy,
		); err != nil {
			if photos.IsUniqueViolation(err) {
				continue
			}
			return fmt.Errorf("Не удалось сохранить фото")
		}
	}
	return nil
}

func (h *Handler) createSubmission(
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
	item, scanErr := scanSubmissionRow(row, "")
	if scanErr != nil {
		return moderationSubmissionResponse{}, scanErr
	}
	h.enrichSubmission(&item)
	return item, nil
}

func (h *Handler) validatePendingObjectKeys(ctx context.Context, userID string, keys []string) ([]string, error) {
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
		sizeBytes, mimeType, err := h.s3.HeadObject(ctx, key)
		if err != nil {
			return nil, fmt.Errorf("Файл %s не найден в хранилище", key)
		}
		if sizeBytes <= 0 || sizeBytes > h.cfg.S3MaxUploadBytes {
			return nil, fmt.Errorf("Файл %s имеет недопустимый размер", key)
		}
		if _, ok := photos.AllowedPhotoContentTypes[photos.NormalizeContentType(mimeType)]; !ok {
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
		targetCafeName  *string
		targetCafeAddr  *string
		targetCafeLat   *float64
		targetCafeLng   *float64
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
	if strings.Contains(authorLabelMode, "author") {
		dest = append(dest, &authorLabel)
	}
	if strings.Contains(authorLabelMode, "cafe") {
		dest = append(dest, &targetCafeName, &targetCafeAddr, &targetCafeLat, &targetCafeLng)
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
	item.TargetCafeName = targetCafeName
	item.TargetCafeAddr = targetCafeAddr
	item.TargetCafeLat = targetCafeLat
	item.TargetCafeLng = targetCafeLng
	if targetCafeLat != nil && targetCafeLng != nil {
		url := fmt.Sprintf(
			"https://yandex.ru/maps/?pt=%f,%f&z=16&l=map",
			*targetCafeLng,
			*targetCafeLat,
		)
		item.TargetCafeMapURL = &url
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

func (h *Handler) enrichSubmission(item *moderationSubmissionResponse) {
	if item == nil || item.Payload == nil {
		return
	}

	switch item.EntityType {
	case entityTypeCafePhoto, entityTypeMenuPhoto:
		keys := extractStringArray(item.Payload["object_keys"])
		if len(keys) == 0 {
			return
		}
		item.Payload["photo_urls"] = h.objectKeysToPublicURLs(keys)
	case entityTypeCafe:
		photoKeys := extractStringArray(item.Payload["photo_object_keys"])
		menuKeys := extractStringArray(item.Payload["menu_photo_object_keys"])
		if len(photoKeys) > 0 {
			item.Payload["photo_urls"] = h.objectKeysToPublicURLs(photoKeys)
		}
		if len(menuKeys) > 0 {
			item.Payload["menu_photo_urls"] = h.objectKeysToPublicURLs(menuKeys)
		}
	}
}

func extractStringArray(value any) []string {
	if value == nil {
		return nil
	}
	switch typed := value.(type) {
	case []string:
		out := make([]string, 0, len(typed))
		for _, raw := range typed {
			item := strings.TrimSpace(raw)
			if item == "" {
				continue
			}
			out = append(out, item)
		}
		return out
	case []any:
		out := make([]string, 0, len(typed))
		for _, raw := range typed {
			item, ok := raw.(string)
			if !ok {
				continue
			}
			item = strings.TrimSpace(item)
			if item == "" {
				continue
			}
			out = append(out, item)
		}
		return out
	default:
		return nil
	}
}

func (h *Handler) objectKeysToPublicURLs(keys []string) []string {
	if len(keys) == 0 {
		return nil
	}
	out := make([]string, 0, len(keys))
	for _, raw := range keys {
		key := strings.TrimSpace(strings.TrimPrefix(raw, "/"))
		if key == "" {
			continue
		}
		out = append(out, h.publicURLForObjectKey(key))
	}
	return out
}

func (h *Handler) publicURLForObjectKey(objectKey string) string {
	if h.s3 != nil && h.s3.Enabled() {
		return h.s3.PublicURL(objectKey)
	}
	base := strings.TrimSpace(h.cfg.S3PublicBaseURL)
	if base == "" {
		return objectKey
	}
	base = strings.TrimSuffix(base, "/")
	key := strings.TrimPrefix(objectKey, "/")
	return base + "/" + key
}

func decodeSubmissionPayload(payload map[string]any, target any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, target)
}
