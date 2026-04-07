package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"xcook/backend/internal/auth"
)

const openIDContextKey = "openid"

func AuthRequired(tokenManager *auth.TokenManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "未登录"})
			return
		}

		token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		claims, err := tokenManager.Parse(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "登录已过期"})
			return
		}

		c.Set(openIDContextKey, claims.OpenID)
		c.Next()
	}
}

func OpenIDFromContext(c *gin.Context) string {
	value, _ := c.Get(openIDContextKey)
	openID, _ := value.(string)
	return openID
}
