package auth

import "github.com/gin-gonic/gin"

func (h Handler) VKStart(c *gin.Context) {
	h.oauthStart(c, ProviderVK, oauthFlowLogin, nil, "/api/auth/vk/callback")
}

func (h Handler) VKCallback(c *gin.Context) {
	h.oauthCallback(c, ProviderVK, oauthFlowLogin)
}
