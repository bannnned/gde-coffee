package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h Handler) VKLinkStart(c *gin.Context) {
	userID, ok := UserIDFromContext(c)
	if !ok || userID == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
		return
	}
	h.oauthStart(c, ProviderVK, oauthFlowLink, &userID, "/api/auth/vk/link/callback")
}

func (h Handler) VKLinkCallback(c *gin.Context) {
	h.oauthCallback(c, ProviderVK, oauthFlowLink)
}
