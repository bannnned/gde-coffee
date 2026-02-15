package httpx

import "github.com/gin-gonic/gin"

type APIError struct {
	Message string      `json:"message"`
	Code    string      `json:"code"`
	Details interface{} `json:"details,omitempty"`
}

func RespondError(c *gin.Context, status int, code, message string, details interface{}) {
	c.JSON(status, APIError{
		Message: message,
		Code:    code,
		Details: details,
	})
}
