package auth

import "github.com/gin-gonic/gin"

func (h Handler) YandexStart(c *gin.Context) {
	h.oauthStart(c, ProviderYandex, oauthFlowLogin, nil, "/api/auth/yandex/callback")
}

func (h Handler) YandexCallback(c *gin.Context) {
	h.oauthCallback(c, ProviderYandex, oauthFlowLogin)
}
