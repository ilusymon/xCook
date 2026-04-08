package storage

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"xcook/backend/internal/config"
)

const (
	maxCompressedDimension = 1280
	compressedJPEGQuality  = 82
)

type MinioService struct {
	client        *minio.Client
	bucket        string
	publicBaseURL string
}

type UploadResult struct {
	Path         string `json:"path"`
	OriginalPath string `json:"originalPath"`
	URL          string `json:"url"`
	OriginalURL  string `json:"originalUrl"`
}

func NewMinioService(cfg config.MinIOConfig) (*MinioService, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, err
	}

	service := &MinioService{
		client:        client,
		bucket:        cfg.Bucket,
		publicBaseURL: strings.TrimRight(cfg.PublicBaseURL, "/"),
	}

	if err := service.ensureBucket(context.Background()); err != nil {
		return nil, err
	}

	return service, nil
}

func (s *MinioService) UploadImage(ctx context.Context, file multipart.File, header *multipart.FileHeader) (*UploadResult, error) {
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = detectContentType(content, header.Filename)
	}

	originalPath := s.generateObjectName("originals", header.Filename)
	if _, err := s.client.PutObject(ctx, s.bucket, originalPath, bytes.NewReader(content), int64(len(content)), minio.PutObjectOptions{
		ContentType: contentType,
	}); err != nil {
		return nil, err
	}

	compressedContent, compressedType, compressedFilename := compressImage(content, header.Filename)
	compressedPath := s.generateObjectName("images", compressedFilename)
	if _, err := s.client.PutObject(ctx, s.bucket, compressedPath, bytes.NewReader(compressedContent), int64(len(compressedContent)), minio.PutObjectOptions{
		ContentType: compressedType,
	}); err != nil {
		return nil, err
	}

	return &UploadResult{
		Path:         compressedPath,
		OriginalPath: originalPath,
		URL:          s.objectURL(compressedPath),
		OriginalURL:  s.objectURL(originalPath),
	}, nil
}

func (s *MinioService) ensureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return err
	}
	if !exists {
		if err := s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{}); err != nil {
			return err
		}
	}

	policy := fmt.Sprintf(`{
  "Version":"2012-10-17",
  "Statement":[
    {
      "Effect":"Allow",
      "Principal":{"AWS":["*"]},
      "Action":["s3:GetObject"],
      "Resource":["arn:aws:s3:::%s/*"]
    }
  ]
}`, s.bucket)

	return s.client.SetBucketPolicy(ctx, s.bucket, policy)
}

func (s *MinioService) generateObjectName(prefix, filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" {
		ext = ".jpg"
	}
	now := time.Now()
	return fmt.Sprintf(
		"%s/%04d%02d%02d/%s%s",
		strings.Trim(prefix, "/"),
		now.Year(),
		now.Month(),
		now.Day(),
		strings.ReplaceAll(uuid.NewString(), "-", ""),
		ext,
	)
}

func (s *MinioService) objectURL(path string) string {
	return fmt.Sprintf("%s/%s/%s", s.publicBaseURL, s.bucket, strings.TrimLeft(path, "/"))
}

func detectContentType(content []byte, filename string) string {
	if ext := strings.ToLower(filepath.Ext(filename)); ext != "" {
		switch ext {
		case ".jpg", ".jpeg":
			return "image/jpeg"
		case ".png":
			return "image/png"
		case ".gif":
			return "image/gif"
		case ".webp":
			return "image/webp"
		}
	}
	return httpDetectContentType(content)
}

func httpDetectContentType(content []byte) string {
	if len(content) == 0 {
		return "application/octet-stream"
	}
	return strings.SplitN(strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(http.DetectContentType(content), "\r", ""), "\n", "")), ";", 2)[0]
}

func compressImage(content []byte, filename string) ([]byte, string, string) {
	src, _, err := image.Decode(bytes.NewReader(content))
	if err != nil {
		return content, detectContentType(content, filename), filename
	}

	bounds := src.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width <= 0 || height <= 0 {
		return content, detectContentType(content, filename), filename
	}

	resized := src
	if width > maxCompressedDimension || height > maxCompressedDimension {
		resized = resizeImage(src, scaleSize(width), scaleSize(height))
	}

	buffer := bytes.NewBuffer(nil)
	if err := jpeg.Encode(buffer, resized, &jpeg.Options{Quality: compressedJPEGQuality}); err != nil {
		return content, detectContentType(content, filename), filename
	}

	base := strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename))
	if base == "" {
		base = "image"
	}
	return buffer.Bytes(), "image/jpeg", base + ".jpg"
}

func scaleSize(width int) int {
	if width <= maxCompressedDimension {
		return width
	}
	return maxCompressedDimension
}

func resizeImage(src image.Image, maxWidth, maxHeight int) image.Image {
	bounds := src.Bounds()
	srcWidth := bounds.Dx()
	srcHeight := bounds.Dy()
	if srcWidth <= 0 || srcHeight <= 0 {
		return src
	}

	scale := minFloat(float64(maxWidth)/float64(srcWidth), float64(maxHeight)/float64(srcHeight))
	if scale >= 1 {
		return src
	}

	dstWidth := maxInt(1, int(float64(srcWidth)*scale))
	dstHeight := maxInt(1, int(float64(srcHeight)*scale))
	dst := image.NewRGBA(image.Rect(0, 0, dstWidth, dstHeight))

	for y := 0; y < dstHeight; y++ {
		srcY := bounds.Min.Y + int(float64(y)*float64(srcHeight)/float64(dstHeight))
		for x := 0; x < dstWidth; x++ {
			srcX := bounds.Min.X + int(float64(x)*float64(srcWidth)/float64(dstWidth))
			dst.Set(x, y, src.At(srcX, srcY))
		}
	}

	return dst
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
