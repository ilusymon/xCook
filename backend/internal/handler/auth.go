package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"xcook/backend/internal/auth"
	"xcook/backend/internal/service"
	"xcook/backend/internal/wechat"
)

type AuthHandler struct {
	tokenManager    *auth.TokenManager
	wechatClient    *wechat.Client
	functionService *service.FunctionService
	allowDebugAuth  bool
}

type loginRequest struct {
	Code        string `json:"code"`
	DebugOpenID string `json:"debugOpenId"`
}

func NewAuthHandler(
	tokenManager *auth.TokenManager,
	wechatClient *wechat.Client,
	functionService *service.FunctionService,
	allowDebugAuth bool,
) *AuthHandler {
	return &AuthHandler{
		tokenManager:    tokenManager,
		wechatClient:    wechatClient,
		functionService: functionService,
		allowDebugAuth:  allowDebugAuth,
	}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var request loginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "登录参数错误"})
		return
	}

	var openID string
	if request.Code != "" {
		var err error
		openID, err = h.wechatClient.Code2Session(c.Request.Context(), request.Code)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
			return
		}
	} else if h.allowDebugAuth && strings.TrimSpace(request.DebugOpenID) != "" {
		openID = strings.TrimSpace(request.DebugOpenID)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"message": "缺少微信登录 code"})
		return
	}

	token, err := h.tokenManager.Generate(openID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "生成登录态失败"})
		return
	}

	user, err := h.functionService.GetUserInfo(c.Request.Context(), openID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  user,
	})
}
