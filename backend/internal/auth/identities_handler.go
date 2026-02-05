package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type IdentityResponse struct {
	Provider    Provider `json:"provider"`
	Email       *string  `json:"email,omitempty"`
	DisplayName *string  `json:"display_name,omitempty"`
	AvatarURL   *string  `json:"avatar_url,omitempty"`
}

func (h Handler) Identities(c *gin.Context) {
	userID, ok := UserIDFromContext(c)
	if !ok || userID == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
		return
	}

	ctx := c.Request.Context()
	list, err := ListUserIdentities(ctx, h.Pool, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal", "db query failed", nil)
		return
	}

	out := make([]IdentityResponse, 0, len(list))
	for _, item := range list {
		out = append(out, IdentityResponse{
			Provider:    item.Provider,
			Email:       item.Email,
			DisplayName: item.DisplayName,
			AvatarURL:   item.AvatarURL,
		})
	}

	c.JSON(http.StatusOK, out)
}
