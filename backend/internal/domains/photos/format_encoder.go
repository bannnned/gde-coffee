package photos

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"backend/internal/config"
)

const (
	photoFormatEncoderProviderImgproxy = "imgproxy"
	photoFormatEncoderProviderLibvips  = "libvips"
)

type photoFormatEncoderClient struct {
	provider string
	baseURL  string
	quality  int
	client   *http.Client
}

type libvipsEncodeRequest struct {
	SourceURL string `json:"source_url"`
	Width     int    `json:"width"`
	Format    string `json:"format"`
	Quality   int    `json:"quality"`
}

func newPhotoFormatEncoderClient(cfg config.MediaConfig) *photoFormatEncoderClient {
	if !cfg.PhotoFormatEncoderEnabled {
		return nil
	}
	timeout := cfg.PhotoFormatEncoderTimeout
	if timeout <= 0 {
		timeout = 8 * time.Second
	}
	quality := cfg.PhotoFormatEncoderQuality
	if quality < 1 || quality > 100 {
		quality = 78
	}
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.PhotoFormatEncoderBaseURL), "/")
	if baseURL == "" {
		return nil
	}
	provider := strings.TrimSpace(strings.ToLower(cfg.PhotoFormatEncoderProvider))
	if provider == "" {
		provider = photoFormatEncoderProviderImgproxy
	}
	return &photoFormatEncoderClient{
		provider: provider,
		baseURL:  baseURL,
		quality:  quality,
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *photoFormatEncoderClient) Encode(
	ctx context.Context,
	sourceURL string,
	width int,
	format string,
) ([]byte, string, error) {
	switch c.provider {
	case photoFormatEncoderProviderImgproxy:
		return c.encodeViaImgproxy(ctx, sourceURL, width, format)
	case photoFormatEncoderProviderLibvips:
		return c.encodeViaLibvips(ctx, sourceURL, width, format)
	default:
		return nil, "", fmt.Errorf("unsupported photo format encoder provider: %s", c.provider)
	}
}

func (c *photoFormatEncoderClient) encodeViaImgproxy(
	ctx context.Context,
	sourceURL string,
	width int,
	format string,
) ([]byte, string, error) {
	if width <= 0 {
		return nil, "", fmt.Errorf("width must be > 0")
	}
	source := strings.TrimSpace(sourceURL)
	if source == "" {
		return nil, "", fmt.Errorf("source url is required")
	}
	format = normalizePhotoVariantFormat(format)
	if format == "" {
		return nil, "", fmt.Errorf("format is required")
	}

	encodedSource := base64.RawURLEncoding.EncodeToString([]byte(source))
	endpoint := fmt.Sprintf(
		"%s/insecure/rs:fit:%d:0/q:%d/%s.%s",
		c.baseURL,
		width,
		c.quality,
		encodedSource,
		format,
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		payload, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, "", fmt.Errorf("imgproxy status=%d: %s", resp.StatusCode, strings.TrimSpace(string(payload)))
	}
	payload, err := io.ReadAll(io.LimitReader(resp.Body, 16*1024*1024))
	if err != nil {
		return nil, "", err
	}
	if len(payload) == 0 {
		return nil, "", fmt.Errorf("imgproxy returned empty payload")
	}
	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = contentTypeByPhotoVariantFormat(format)
	}
	return payload, contentType, nil
}

func (c *photoFormatEncoderClient) encodeViaLibvips(
	ctx context.Context,
	sourceURL string,
	width int,
	format string,
) ([]byte, string, error) {
	if width <= 0 {
		return nil, "", fmt.Errorf("width must be > 0")
	}
	source := strings.TrimSpace(sourceURL)
	if source == "" {
		return nil, "", fmt.Errorf("source url is required")
	}
	format = normalizePhotoVariantFormat(format)
	if format == "" {
		return nil, "", fmt.Errorf("format is required")
	}

	body, err := json.Marshal(libvipsEncodeRequest{
		SourceURL: source,
		Width:     width,
		Format:    format,
		Quality:   c.quality,
	})
	if err != nil {
		return nil, "", err
	}
	endpoint := c.baseURL + "/v1/encode"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "image/*")
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		payload, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, "", fmt.Errorf("libvips encoder status=%d: %s", resp.StatusCode, strings.TrimSpace(string(payload)))
	}

	payload, err := io.ReadAll(io.LimitReader(resp.Body, 16*1024*1024))
	if err != nil {
		return nil, "", err
	}
	if len(payload) == 0 {
		return nil, "", fmt.Errorf("libvips encoder returned empty payload")
	}
	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = contentTypeByPhotoVariantFormat(format)
	}
	return payload, contentType, nil
}

func normalizePhotoVariantFormat(value string) string {
	v := strings.ToLower(strings.TrimSpace(value))
	switch v {
	case "webp", "avif":
		return v
	default:
		return ""
	}
}

func contentTypeByPhotoVariantFormat(format string) string {
	switch normalizePhotoVariantFormat(format) {
	case "webp":
		return "image/webp"
	case "avif":
		return "image/avif"
	default:
		return "application/octet-stream"
	}
}
