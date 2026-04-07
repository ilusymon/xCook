package storage

import (
	"context"
	"fmt"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"xcook/backend/internal/config"
)

type MinioService struct {
	client        *minio.Client
	bucket        string
	publicBaseURL string
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

func (s *MinioService) UploadImage(ctx context.Context, file multipart.File, header *multipart.FileHeader) (string, error) {
	defer file.Close()

	objectName := s.generateObjectName(header.Filename)
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	if _, err := s.client.PutObject(ctx, s.bucket, objectName, file, header.Size, minio.PutObjectOptions{
		ContentType: contentType,
	}); err != nil {
		return "", err
	}

	return fmt.Sprintf("%s/%s/%s", s.publicBaseURL, s.bucket, objectName), nil
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

func (s *MinioService) generateObjectName(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" {
		ext = ".jpg"
	}
	now := time.Now()
	return fmt.Sprintf(
		"images/%04d%02d%02d/%s%s",
		now.Year(),
		now.Month(),
		now.Day(),
		strings.ReplaceAll(uuid.NewString(), "-", ""),
		ext,
	)
}
