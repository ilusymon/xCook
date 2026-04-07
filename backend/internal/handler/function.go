package handler

import (
	"errors"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"xcook/backend/internal/middleware"
	"xcook/backend/internal/service"
)

type FunctionHandler struct {
	functionService *service.FunctionService
}

func NewFunctionHandler(functionService *service.FunctionService) *FunctionHandler {
	return &FunctionHandler{functionService: functionService}
}

func (h *FunctionHandler) Handle(c *gin.Context) {
	var payload map[string]any
	if err := c.ShouldBindJSON(&payload); err != nil && !errors.Is(err, io.EOF) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求体格式错误"})
		return
	}

	result, err := h.functionService.Dispatch(
		c.Request.Context(),
		middleware.OpenIDFromContext(c),
		c.Param("name"),
		payload,
	)
	if err != nil {
		var serviceErr *service.ServiceError
		if errors.As(err, &serviceErr) {
			c.JSON(serviceErr.Status, gin.H{"message": serviceErr.Message})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}
