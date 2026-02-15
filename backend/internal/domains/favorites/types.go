package favorites

import "backend/internal/model"

type StatusResponse struct {
	CafeID     string `json:"cafe_id"`
	IsFavorite bool   `json:"is_favorite"`
}

type ListResult []model.CafeResponse
