package auth

import "github.com/gin-gonic/gin"

func (h Handler) GitHubStart(c *gin.Context) {
	h.oauthStart(c, ProviderGitHub, oauthFlowLogin, nil, "/api/auth/github/callback")
}

func (h Handler) GitHubCallback(c *gin.Context) {
	h.oauthCallback(c, ProviderGitHub, oauthFlowLogin)
}
