package reviews

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/shared/httpx"
	"backend/internal/shared/validation"

	"github.com/gin-gonic/gin"
)

const (
	maxTasteTags          = 10
	maxReviewPhotos       = 8
	defaultReviewPageSize = 20
	maxReviewPageSize     = 50
	maxReviewCursorOffset = 200000
)

func (h *Handler) Publish(c *gin.Context) {
	h.Create(c)
}

func (h *Handler) Create(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Заголовок Idempotency-Key обязателен.", nil)
		return
	}

	var req PublishReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	normalizedReq, validationErr := normalizeAndValidateCreateRequest(req)
	if validationErr != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", validationErr.Error(), nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	result, err := h.service.CreateReview(ctx, userID, idempotencyKey, normalizedReq)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}
	c.Header("X-Idempotent-Replay", boolToString(result.Replay))
	c.JSON(result.StatusCode, result.Body)
}

func (h *Handler) Update(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.RespondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	reviewID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(reviewID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id отзыва.", nil)
		return
	}

	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Заголовок Idempotency-Key обязателен.", nil)
		return
	}

	var req UpdateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	normalizedReq, validationErr := normalizeAndValidateUpdateRequest(req)
	if validationErr != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", validationErr.Error(), nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	result, err := h.service.UpdateReview(ctx, userID, reviewID, idempotencyKey, normalizedReq)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}
	c.Header("X-Idempotent-Replay", boolToString(result.Replay))
	c.JSON(result.StatusCode, result.Body)
}

func (h *Handler) ListCafeReviews(c *gin.Context) {
	cafeID := strings.TrimSpace(c.Param("id"))
	if !validation.IsValidUUID(cafeID) {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	sortBy := strings.ToLower(strings.TrimSpace(c.Query("sort")))
	if sortBy == "" {
		sortBy = "new"
	}
	if sortBy != "new" && sortBy != "helpful" && sortBy != "verified" {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", "sort должен быть new, helpful или verified.", nil)
		return
	}
	limit, err := parseReviewPageSize(c.Query("limit"))
	if err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
		return
	}
	offset, err := parseReviewCursorOffset(c.Query("cursor"), sortBy)
	if err != nil {
		httpx.RespondError(c, http.StatusBadRequest, "invalid_argument", err.Error(), nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	reviewsList, hasMore, nextOffset, err := h.service.ListCafeReviews(ctx, cafeID, sortBy, offset, limit)
	if err != nil {
		h.respondDomainError(c, err)
		return
	}
	nextCursor := ""
	if hasMore {
		nextCursor = encodeReviewCursor(nextOffset, sortBy)
	}

	c.JSON(http.StatusOK, gin.H{
		"cafe_id":     cafeID,
		"sort":        sortBy,
		"limit":       limit,
		"cursor":      strings.TrimSpace(c.Query("cursor")),
		"has_more":    hasMore,
		"next_cursor": nextCursor,
		"reviews":     reviewsList,
	})
}

func parseReviewPageSize(raw string) (int, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return defaultReviewPageSize, nil
	}
	size, err := strconv.Atoi(value)
	if err != nil {
		return 0, errInvalid("limit должен быть целым числом.")
	}
	if size <= 0 {
		return 0, errInvalid("limit должен быть больше 0.")
	}
	if size > maxReviewPageSize {
		return 0, errInvalid("limit не может быть больше 50.")
	}
	return size, nil
}

func parseReviewCursorOffset(raw string, sortBy string) (int, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, nil
	}

	payload, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return 0, errInvalid("cursor имеет некорректный формат.")
	}

	var cursor struct {
		Offset int    `json:"offset"`
		Sort   string `json:"sort"`
	}
	if err := json.Unmarshal(payload, &cursor); err != nil {
		return 0, errInvalid("cursor имеет некорректный формат.")
	}

	// Cursor pins sort to keep pagination stable across user interactions.
	if strings.TrimSpace(cursor.Sort) != "" && strings.TrimSpace(cursor.Sort) != sortBy {
		return 0, errInvalid("cursor не соответствует выбранной сортировке.")
	}
	if cursor.Offset < 0 || cursor.Offset > maxReviewCursorOffset {
		return 0, errInvalid("cursor содержит некорректное смещение.")
	}
	return cursor.Offset, nil
}

func encodeReviewCursor(offset int, sortBy string) string {
	if offset < 0 {
		offset = 0
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"offset": offset,
		"sort":   sortBy,
	})
	return base64.RawURLEncoding.EncodeToString(payload)
}

func normalizeAndValidateCreateRequest(req PublishReviewRequest) (PublishReviewRequest, error) {
	normalized := sanitizePublishReviewRequest(req)
	if !validation.IsValidUUID(normalized.CafeID) {
		return normalized, errInvalid("Некорректный id кофейни.")
	}
	if normalized.Rating < 1 || normalized.Rating > 5 {
		return normalized, errInvalid("rating должен быть в диапазоне от 1 до 5.")
	}
	if strings.TrimSpace(normalized.DrinkID) == "" {
		return normalized, errInvalid("drink_id обязателен.")
	}
	if utfRuneLen(normalized.Summary) < minReviewSummaryLength {
		return normalized, errInvalid("summary должен быть не короче 60 символов.")
	}
	if len(normalized.TasteTags) > maxTasteTags {
		return normalized, errInvalid("taste_tags не может быть больше 10.")
	}
	if len(normalized.Photos) > maxReviewPhotos {
		return normalized, errInvalid("photos не может быть больше 8.")
	}
	for _, photoURL := range normalized.Photos {
		if !validPhotoURL(photoURL) {
			return normalized, errInvalid("Каждое значение в photos должно быть корректным URL.")
		}
	}
	return normalized, nil
}

func normalizeAndValidateUpdateRequest(req UpdateReviewRequest) (UpdateReviewRequest, error) {
	hasAnyField := false
	if req.Rating != nil {
		hasAnyField = true
		if *req.Rating < 1 || *req.Rating > 5 {
			return req, errInvalid("rating должен быть в диапазоне от 1 до 5.")
		}
	}
	if req.DrinkID != nil {
		hasAnyField = true
		value := strings.TrimSpace(*req.DrinkID)
		req.DrinkID = &value
		if value == "" {
			return req, errInvalid("drink_id не может быть пустым.")
		}
	}
	if req.Summary != nil {
		hasAnyField = true
		value := strings.TrimSpace(*req.Summary)
		req.Summary = &value
		if utfRuneLen(value) < minReviewSummaryLength {
			return req, errInvalid("summary должен быть не короче 60 символов.")
		}
	}
	if req.TasteTags != nil {
		hasAnyField = true
		normalized := normalizeTags(*req.TasteTags)
		req.TasteTags = &normalized
		if len(normalized) > maxTasteTags {
			return req, errInvalid("taste_tags не может быть больше 10.")
		}
	}
	if req.Photos != nil {
		hasAnyField = true
		normalized := normalizePhotos(*req.Photos)
		if len(normalized) > maxReviewPhotos {
			return req, errInvalid("photos не может быть больше 8.")
		}
		for _, photoURL := range normalized {
			if !validPhotoURL(photoURL) {
				return req, errInvalid("Каждое значение в photos должно быть корректным URL.")
			}
		}
		req.Photos = &normalized
	}
	if !hasAnyField {
		return req, errInvalid("Нужно передать хотя бы одно поле для обновления.")
	}
	return req, nil
}

func errInvalid(message string) error {
	return &invalidArgumentError{message: message}
}

type invalidArgumentError struct {
	message string
}

func (e *invalidArgumentError) Error() string {
	return e.message
}
