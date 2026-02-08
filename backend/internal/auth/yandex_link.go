package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h Handler) YandexLinkStart(c *gin.Context) {
	userID, ok := UserIDFromContext(c)
	if !ok || userID == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
		return
	}
	h.oauthStart(c, ProviderYandex, oauthFlowLink, &userID, "/api/auth/yandex/link/callback")
}

func (h Handler) YandexLinkCallback(c *gin.Context) {
	h.oauthCallback(c, ProviderYandex, oauthFlowLink)
}
