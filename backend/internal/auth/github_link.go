package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h Handler) GitHubLinkStart(c *gin.Context) {
	userID, ok := UserIDFromContext(c)
	if !ok || userID == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
		return
	}
	h.oauthStart(c, ProviderGitHub, oauthFlowLink, &userID, "/api/auth/github/link/callback")
}

func (h Handler) GitHubLinkCallback(c *gin.Context) {
	h.oauthCallback(c, ProviderGitHub, oauthFlowLink)
}
