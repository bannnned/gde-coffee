package main

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/config"
	"backend/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type favoritesAPI struct {
	pool *pgxpool.Pool
	cfg  config.MediaConfig
}

type favoriteStatusResponse struct {
	CafeID     string `json:"cafe_id"`
	IsFavorite bool   `json:"is_favorite"`
}

func newFavoritesAPI(pool *pgxpool.Pool, cfg config.MediaConfig) *favoritesAPI {
	return &favoritesAPI{
		pool: pool,
		cfg:  cfg,
	}
}

func (h *favoritesAPI) Add(c *gin.Context) {
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

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if err := ensureCafeExists(ctx, h.pool, cafeID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(c, http.StatusNotFound, "not_found", "Кофейня не найдена.", nil)
			return
		}
		respondError(c, http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера.", nil)
		return
	}

	if _, err := h.pool.Exec(
		ctx,
		`insert into user_favorite_cafes (user_id, cafe_id)
		 values ($1::uuid, $2::uuid)
		 on conflict (user_id, cafe_id) do nothing`,
		userID,
		cafeID,
	); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось добавить в избранное.", nil)
		return
	}

	c.JSON(http.StatusOK, favoriteStatusResponse{
		CafeID:     cafeID,
		IsFavorite: true,
	})
}

func (h *favoritesAPI) Remove(c *gin.Context) {
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

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if _, err := h.pool.Exec(
		ctx,
		`delete from user_favorite_cafes where user_id = $1::uuid and cafe_id = $2::uuid`,
		userID,
		cafeID,
	); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось удалить из избранного.", nil)
		return
	}

	c.JSON(http.StatusOK, favoriteStatusResponse{
		CafeID:     cafeID,
		IsFavorite: false,
	})
}

func (h *favoritesAPI) List(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "Необходимо войти в аккаунт.", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	rows, err := h.pool.Query(
		ctx,
		`select c.id::text,
		        c.name,
		        c.address,
		        coalesce(c.description, '') as description,
		        c.lat,
		        c.lng,
		        coalesce(c.amenities, '{}'::text[]) as amenities
		   from user_favorite_cafes uf
		   join cafes c on c.id = uf.cafe_id
		  where uf.user_id = $1::uuid
		  order by uf.created_at desc`,
		userID,
	)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить избранное.", nil)
		return
	}
	defer rows.Close()

	out := make([]model.CafeResponse, 0, 32)
	for rows.Next() {
		var (
			item        model.CafeResponse
			description string
		)
		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Address,
			&description,
			&item.Latitude,
			&item.Longitude,
			&item.Amenities,
		); err != nil {
			respondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить избранное.", nil)
			return
		}
		description = strings.TrimSpace(description)
		if description != "" {
			item.Description = &description
		}
		item.DistanceM = 0
		item.IsFavorite = true
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить избранное.", nil)
		return
	}

	if err := attachCafeCoverPhotos(ctx, h.pool, out, h.cfg); err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "Не удалось загрузить избранное.", nil)
		return
	}

	c.JSON(http.StatusOK, out)
}
