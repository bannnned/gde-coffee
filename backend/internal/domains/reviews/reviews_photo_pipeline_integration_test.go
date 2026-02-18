package reviews

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"backend/internal/config"
	"backend/internal/media"
)

type fakeS3Object struct {
	body        []byte
	contentType string
}

type fakeS3Server struct {
	t       *testing.T
	baseURL string
	bucket  string
	mu      sync.RWMutex
	objects map[string]fakeS3Object
}

func newFakeS3Server(t *testing.T, bucket string) *fakeS3Server {
	t.Helper()

	state := &fakeS3Server{
		t:       t,
		bucket:  strings.TrimSpace(bucket),
		objects: make(map[string]fakeS3Object),
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		parts := strings.SplitN(path, "/", 2)
		if len(parts) < 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
			http.NotFound(w, r)
			return
		}

		bucketName := strings.TrimSpace(parts[0])
		if bucketName != state.bucket {
			http.NotFound(w, r)
			return
		}

		key, err := url.PathUnescape(parts[1])
		if err != nil {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}
		key = strings.TrimSpace(strings.TrimPrefix(key, "/"))
		if key == "" {
			http.NotFound(w, r)
			return
		}

		switch r.Method {
		case http.MethodPut:
			payload, readErr := io.ReadAll(r.Body)
			if readErr != nil {
				http.Error(w, "read body failed", http.StatusInternalServerError)
				return
			}
			contentType := strings.TrimSpace(r.Header.Get("Content-Type"))
			if contentType == "" {
				contentType = "application/octet-stream"
			}
			state.mu.Lock()
			state.objects[key] = fakeS3Object{body: payload, contentType: contentType}
			state.mu.Unlock()
			w.WriteHeader(http.StatusOK)
		case http.MethodHead:
			state.mu.RLock()
			obj, ok := state.objects[key]
			state.mu.RUnlock()
			if !ok {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Length", strconvItoa(len(obj.body)))
			w.Header().Set("Content-Type", obj.contentType)
			w.WriteHeader(http.StatusOK)
		case http.MethodGet:
			state.mu.RLock()
			obj, ok := state.objects[key]
			state.mu.RUnlock()
			if !ok {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", obj.contentType)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(obj.body)
		case http.MethodDelete:
			state.mu.Lock()
			delete(state.objects, key)
			state.mu.Unlock()
			w.WriteHeader(http.StatusNoContent)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	ts := httptest.NewServer(handler)
	state.baseURL = ts.URL
	t.Cleanup(ts.Close)

	return state
}

func (s *fakeS3Server) hasObject(key string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, ok := s.objects[strings.TrimSpace(strings.TrimPrefix(key, "/"))]
	return ok
}

func newFakeMediaService(t *testing.T, s3 *fakeS3Server) (*media.Service, config.MediaConfig) {
	t.Helper()

	mediaCfg := config.MediaConfig{
		S3Enabled:         true,
		S3Endpoint:        s3.baseURL,
		S3Region:          "us-east-1",
		S3Bucket:          s3.bucket,
		S3AccessKeyID:     "test-key",
		S3SecretAccessKey: "test-secret",
		S3PublicBaseURL:   strings.TrimRight(s3.baseURL, "/") + "/" + s3.bucket,
		S3UsePathStyle:    true,
		S3PresignTTL:      15 * time.Minute,
		S3MaxUploadBytes:  8 * 1024 * 1024,
	}

	service, err := media.NewS3Service(context.Background(), media.Config{
		Enabled:         true,
		Endpoint:        mediaCfg.S3Endpoint,
		Region:          mediaCfg.S3Region,
		Bucket:          mediaCfg.S3Bucket,
		AccessKeyID:     mediaCfg.S3AccessKeyID,
		SecretAccessKey: mediaCfg.S3SecretAccessKey,
		PublicBaseURL:   mediaCfg.S3PublicBaseURL,
		UsePathStyle:    mediaCfg.S3UsePathStyle,
		PresignTTL:      mediaCfg.S3PresignTTL,
	})
	if err != nil {
		t.Fatalf("create fake media service: %v", err)
	}
	return service, mediaCfg
}

func createTinyJPEGBytes(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 32, 24))
	for y := 0; y < 24; y++ {
		for x := 0; x < 32; x++ {
			img.Set(x, y, color.RGBA{
				R: uint8(50 + x*3),
				G: uint8(80 + y*4),
				B: 140,
				A: 255,
			})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 92}); err != nil {
		t.Fatalf("encode tiny jpeg: %v", err)
	}
	return buf.Bytes()
}

func uploadUsingPresignedURL(t *testing.T, uploadURL string, headers map[string]string, payload []byte, contentType string) {
	t.Helper()

	req, err := http.NewRequest(http.MethodPut, uploadURL, bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("create upload request: %v", err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if strings.TrimSpace(req.Header.Get("Content-Type")) == "" {
		req.Header.Set("Content-Type", contentType)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("execute upload request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("upload failed status=%d body=%s", resp.StatusCode, string(body))
	}
}

func strconvItoa(value int) string {
	return fmt.Sprintf("%d", value)
}

func TestReviewPhotoPipelineWithFakeMediaService(t *testing.T) {
	pool := integrationTestPool(t)
	userID := mustCreateTestUser(t, pool, "user")
	t.Cleanup(func() {
		mustDeleteTestUser(t, pool, userID)
	})

	fakeS3 := newFakeS3Server(t, "it-reviews-bucket")
	mediaService, mediaCfg := newFakeMediaService(t, fakeS3)
	router := newIntegrationRouterWithMedia(pool, mediaService, mediaCfg)

	payload := createTinyJPEGBytes(t)

	presignRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews/photos/presign",
		map[string]string{
			"X-Test-User-ID": userID,
			"X-Test-Role":    "user",
		},
		map[string]interface{}{
			"content_type": "image/jpeg",
			"size_bytes":   len(payload),
		},
	)
	if presignRec.Code != http.StatusOK {
		t.Fatalf("presign expected 200, got %d, body=%s", presignRec.Code, presignRec.Body.String())
	}

	var presignBody struct {
		UploadURL string            `json:"upload_url"`
		Headers   map[string]string `json:"headers"`
		ObjectKey string            `json:"object_key"`
	}
	if err := json.Unmarshal(presignRec.Body.Bytes(), &presignBody); err != nil {
		t.Fatalf("decode presign response: %v", err)
	}
	if strings.TrimSpace(presignBody.UploadURL) == "" || strings.TrimSpace(presignBody.ObjectKey) == "" {
		t.Fatalf("presign response is missing upload_url/object_key: %s", presignRec.Body.String())
	}

	uploadUsingPresignedURL(
		t,
		presignBody.UploadURL,
		presignBody.Headers,
		payload,
		"image/jpeg",
	)

	confirmRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews/photos/confirm",
		map[string]string{
			"X-Test-User-ID": userID,
			"X-Test-Role":    "user",
		},
		map[string]interface{}{
			"object_key": presignBody.ObjectKey,
		},
	)
	if confirmRec.Code != http.StatusAccepted {
		t.Fatalf("confirm expected 202 (pending), got %d, body=%s", confirmRec.Code, confirmRec.Body.String())
	}

	var confirmBody struct {
		PhotoID string `json:"photo_id"`
		Status  string `json:"status"`
	}
	if err := json.Unmarshal(confirmRec.Body.Bytes(), &confirmBody); err != nil {
		t.Fatalf("decode confirm response: %v", err)
	}
	if strings.TrimSpace(confirmBody.PhotoID) == "" {
		t.Fatalf("expected non-empty photo_id in confirm response")
	}
	if confirmBody.Status != "pending" && confirmBody.Status != "processing" {
		t.Fatalf("expected pending/processing status after confirm, got %q", confirmBody.Status)
	}

	repository := NewRepository(pool)
	worker := NewService(repository)
	worker.SetMedia(mediaService, mediaCfg)
	drainDomainQueuesForAggregate(t, pool, worker, userID, 24)

	statusRec := performJSONRequest(
		t,
		router,
		http.MethodGet,
		"/api/reviews/photos/"+confirmBody.PhotoID+"/status",
		map[string]string{
			"X-Test-User-ID": userID,
			"X-Test-Role":    "user",
		},
		nil,
	)
	if statusRec.Code != http.StatusOK {
		t.Fatalf("status expected 200, got %d, body=%s", statusRec.Code, statusRec.Body.String())
	}

	var statusBody struct {
		PhotoID   string `json:"photo_id"`
		Status    string `json:"status"`
		ObjectKey string `json:"object_key"`
		FileURL   string `json:"file_url"`
		MimeType  string `json:"mime_type"`
		SizeBytes int64  `json:"size_bytes"`
	}
	if err := json.Unmarshal(statusRec.Body.Bytes(), &statusBody); err != nil {
		t.Fatalf("decode status response: %v", err)
	}
	if statusBody.Status != "ready" {
		t.Fatalf("expected ready status after worker processing, got %q body=%s", statusBody.Status, statusRec.Body.String())
	}
	if !strings.HasPrefix(statusBody.ObjectKey, "reviews/users/"+userID+"/optimized/") {
		t.Fatalf("unexpected final object key: %q", statusBody.ObjectKey)
	}
	if strings.TrimSpace(statusBody.FileURL) == "" {
		t.Fatalf("expected non-empty file_url in ready status")
	}
	if strings.TrimSpace(statusBody.MimeType) == "" {
		t.Fatalf("expected non-empty mime_type in ready status")
	}
	if statusBody.SizeBytes <= 0 {
		t.Fatalf("expected positive size_bytes in ready status, got %d", statusBody.SizeBytes)
	}
	if !fakeS3.hasObject(statusBody.ObjectKey) {
		t.Fatalf("expected optimized object %q to exist in fake s3", statusBody.ObjectKey)
	}
}
