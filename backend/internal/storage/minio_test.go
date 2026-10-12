package storage

import (
	"bytes"
	"context"
	"image"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/minio/minio-go/v7"
)

func TestUploadImagePreservesOriginalAndReturnsCompressedPath(t *testing.T) {
	var original bytes.Buffer
	if err := png.Encode(&original, image.NewRGBA(image.Rect(0, 0, 2560, 1280))); err != nil {
		t.Fatal(err)
	}
	objects := map[string][]byte{}
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			t.Errorf("unexpected method: %s", r.Method)
		}
		content, err := io.ReadAll(r.Body)
		if err != nil {
			t.Error(err)
		}
		objects[strings.TrimPrefix(r.URL.Path, "/photos/")] = content
		w.Header().Set("ETag", `"test"`)
	}))
	defer server.Close()
	client, err := minio.New(strings.TrimPrefix(server.URL, "https://"), &minio.Options{
		Region: "us-east-1", Secure: true, Transport: server.Client().Transport,
	})
	if err != nil {
		t.Fatal(err)
	}
	service := &MinioService{client: client, bucket: "photos", publicBaseURL: server.URL}
	// Use a multipart file so the test exercises the same input as the handler.
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "photo.png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(original.Bytes()); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	form, err := multipart.NewReader(&body, writer.Boundary()).ReadForm(1 << 20)
	if err != nil {
		t.Fatal(err)
	}
	defer form.RemoveAll()
	header := form.File["file"][0]
	file, err := header.Open()
	if err != nil {
		t.Fatal(err)
	}
	result, err := service.UploadImage(context.Background(), file, header)
	if err != nil {
		t.Fatal(err)
	}
	if len(objects) != 2 || !bytes.Equal(objects[result.OriginalPath], original.Bytes()) {
		t.Fatal("original image was changed or both versions were not saved")
	}
	compressed, format, err := image.Decode(bytes.NewReader(objects[result.Path]))
	if err != nil {
		t.Fatal(err)
	}
	if format != "jpeg" || compressed.Bounds().Dx() != 1280 || compressed.Bounds().Dy() != 640 {
		t.Fatalf("unexpected compressed image: %s %v", format, compressed.Bounds())
	}
	if !strings.HasPrefix(result.Path, "images/") || result.URL != service.objectURL(result.Path) || result.OriginalURL != service.objectURL(result.OriginalPath) {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestCompressImageRejectsInvalidImage(t *testing.T) {
	if _, _, _, err := compressImage([]byte("not an image"), "photo.jpg"); err == nil {
		t.Fatal("invalid images must fail compression before saving")
	}
}
