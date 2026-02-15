package main

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxCafeDescriptionChars = 2000

type cafeDescriptionAPI struct {
	pool *pgxpool.Pool
}

type updateCafeDescriptionRequest struct {
	Description string `json:"description"`
}

func newCafeDescriptionAPI(pool *pgxpool.Pool) *cafeDescriptionAPI {
	return &cafeDescriptionAPI{pool: pool}
}

func (h *cafeDescriptionAPI) Update(c *gin.Context) {
	cafeID := strings.TrimSpace(c.Param("id"))
	if cafeID == "" || !isValidUUID(cafeID) {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный id кофейни.", nil)
		return
	}

	var req updateCafeDescriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Некорректный JSON в запросе.", nil)
		return
	}

	description := strings.TrimSpace(req.Description)
	if description == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Описание не должно быть пустым.", nil)
		return
	}
	if len([]rune(description)) > maxCafeDescriptionChars {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Описание слишком длинное.", gin.H{
			"max_chars": maxCafeDescriptionChars,
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var saved string
	err := h.pool.QueryRow(
		ctx,
		`update cafes
		    set description = $2
		  where id = $1::uuid
		  returning COALESCE(description, '')`,
		cafeID,
		description,
	).Scan(&saved)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondError(c, http.StatusNotFound, "not_found", "Кофейня не найдена.", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"description": strings.TrimSpace(saved),
	})
}

