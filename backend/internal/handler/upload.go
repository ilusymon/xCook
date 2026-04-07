package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"xcook/backend/internal/storage"
)

type UploadHandler struct {
	minioService *storage.MinioService
}

func NewUploadHandler(minioService *storage.MinioService) *UploadHandler {
	return &UploadHandler{minioService: minioService}
}

func (h *UploadHandler) UploadImage(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "缺少图片文件"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "读取上传文件失败"})
		return
	}

	url, err := h.minioService.UploadImage(c.Request.Context(), file, fileHeader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"url":     url,
	})
}
