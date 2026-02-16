package media

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type Config struct {
	Enabled         bool
	Endpoint        string
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	PublicBaseURL   string
	UsePathStyle    bool
	PresignTTL      time.Duration
}

type PresignPutResult struct {
	UploadURL string
	Headers   map[string]string
	ExpiresAt time.Time
}

const uploadCacheControl = "public, max-age=31536000, immutable"

type Service struct {
	cfg       Config
	client    *s3.Client
	presigner *s3.PresignClient
}

func NewS3Service(ctx context.Context, cfg Config) (*Service, error) {
	if !cfg.Enabled {
		return &Service{cfg: cfg}, nil
	}

	endpoint := normalizeEndpoint(cfg.Endpoint)
	awsCfg, err := awsconfig.LoadDefaultConfig(
		ctx,
		awsconfig.WithRegion(cfg.Region),
		awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(opts *s3.Options) {
		opts.UsePathStyle = cfg.UsePathStyle
		opts.BaseEndpoint = aws.String(endpoint)
	})

	return &Service{
		cfg:       cfg,
		client:    client,
		presigner: s3.NewPresignClient(client),
	}, nil
}

func (s *Service) Enabled() bool {
	return s != nil && s.cfg.Enabled && s.client != nil && s.presigner != nil
}

func (s *Service) PresignPutObject(
	ctx context.Context,
	key string,
	contentType string,
) (*PresignPutResult, error) {
	if !s.Enabled() {
		return nil, fmt.Errorf("s3 is not enabled")
	}
	key = strings.TrimSpace(strings.TrimPrefix(key, "/"))
	if key == "" {
		return nil, fmt.Errorf("object key is required")
	}

	req, err := s.presigner.PresignPutObject(
		ctx,
		&s3.PutObjectInput{
			Bucket:       aws.String(s.cfg.Bucket),
			Key:          aws.String(key),
			ContentType:  aws.String(contentType),
			CacheControl: aws.String(uploadCacheControl),
		},
		s3.WithPresignExpires(s.cfg.PresignTTL),
	)
	if err != nil {
		return nil, fmt.Errorf("presign put object: %w", err)
	}

	headers := make(map[string]string, len(req.SignedHeader))
	for k, values := range req.SignedHeader {
		lower := strings.ToLower(strings.TrimSpace(k))
		if lower == "" {
			continue
		}
		if lower == "host" ||
			lower == "content-length" ||
			lower == "user-agent" ||
			lower == "accept-encoding" ||
			lower == "connection" {
			continue
		}
		if len(values) == 0 {
			continue
		}
		headers[k] = values[0]
	}

	return &PresignPutResult{
		UploadURL: req.URL,
		Headers:   headers,
		ExpiresAt: time.Now().Add(s.cfg.PresignTTL),
	}, nil
}

func (s *Service) HeadObject(ctx context.Context, key string) (int64, string, error) {
	if !s.Enabled() {
		return 0, "", fmt.Errorf("s3 is not enabled")
	}
	key = strings.TrimSpace(strings.TrimPrefix(key, "/"))
	if key == "" {
		return 0, "", fmt.Errorf("object key is required")
	}
	out, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.cfg.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return 0, "", fmt.Errorf("head object: %w", err)
	}
	contentType := ""
	if out.ContentType != nil {
		contentType = strings.TrimSpace(*out.ContentType)
	}
	sizeBytes := int64(0)
	if out.ContentLength != nil {
		sizeBytes = *out.ContentLength
	}
	return sizeBytes, contentType, nil
}

func (s *Service) GetObject(ctx context.Context, key string) ([]byte, string, error) {
	if !s.Enabled() {
		return nil, "", fmt.Errorf("s3 is not enabled")
	}
	key = strings.TrimSpace(strings.TrimPrefix(key, "/"))
	if key == "" {
		return nil, "", fmt.Errorf("object key is required")
	}
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.cfg.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, "", fmt.Errorf("get object: %w", err)
	}
	defer out.Body.Close()

	payload, err := io.ReadAll(out.Body)
	if err != nil {
		return nil, "", fmt.Errorf("read object body: %w", err)
	}
	contentType := ""
	if out.ContentType != nil {
		contentType = strings.TrimSpace(*out.ContentType)
	}
	return payload, contentType, nil
}

func (s *Service) PutObject(ctx context.Context, key string, contentType string, payload []byte) error {
	if !s.Enabled() {
		return fmt.Errorf("s3 is not enabled")
	}
	key = strings.TrimSpace(strings.TrimPrefix(key, "/"))
	if key == "" {
		return fmt.Errorf("object key is required")
	}
	if len(payload) == 0 {
		return fmt.Errorf("payload must not be empty")
	}
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:       aws.String(s.cfg.Bucket),
		Key:          aws.String(key),
		Body:         bytes.NewReader(payload),
		ContentType:  aws.String(strings.TrimSpace(contentType)),
		CacheControl: aws.String(uploadCacheControl),
	})
	if err != nil {
		return fmt.Errorf("put object: %w", err)
	}
	return nil
}

func (s *Service) DeleteObject(ctx context.Context, key string) error {
	if !s.Enabled() {
		return fmt.Errorf("s3 is not enabled")
	}
	key = strings.TrimSpace(strings.TrimPrefix(key, "/"))
	if key == "" {
		return fmt.Errorf("object key is required")
	}
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.cfg.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("delete object: %w", err)
	}
	return nil
}

func (s *Service) PublicURL(key string) string {
	key = strings.TrimSpace(strings.TrimPrefix(key, "/"))
	if key == "" {
		return ""
	}
	if strings.TrimSpace(s.cfg.PublicBaseURL) != "" {
		return strings.TrimRight(s.cfg.PublicBaseURL, "/") + "/" + key
	}

	endpoint := normalizeEndpoint(s.cfg.Endpoint)
	base, err := url.Parse(endpoint)
	if err != nil || base.Host == "" {
		return key
	}

	if s.cfg.UsePathStyle {
		return fmt.Sprintf("%s://%s/%s/%s", base.Scheme, base.Host, s.cfg.Bucket, key)
	}
	return fmt.Sprintf("%s://%s.%s/%s", base.Scheme, s.cfg.Bucket, base.Host, key)
}

func normalizeEndpoint(endpoint string) string {
	raw := strings.TrimSpace(endpoint)
	if raw == "" {
		return ""
	}
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return strings.TrimRight(raw, "/")
	}
	return "https://" + strings.TrimRight(raw, "/")
}
