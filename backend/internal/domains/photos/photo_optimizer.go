package photos

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"path"
	"strings"
	"time"

	"backend/internal/config"
	"backend/internal/media"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	cafePhotoMaxPixels   = 36_000_000
	cafePhotoMaxSide     = 2048
	cafePhotoJPEGQuality = 82
)

var cafePhotoVariantWidths = []int{320, 640, 1024, 1536}

var (
	ErrCafePhotoInvalid  = errors.New("invalid cafe photo")
	ErrCafePhotoTooLarge = errors.New("cafe photo too large")
)

type optimizedCafePhotoResult struct {
	Content     []byte
	ContentType string
	Width       int
	Height      int
	Changed     bool
}

type OptimizedCafePhotoMeta struct {
	ObjectKey               string
	MimeType                string
	SizeBytes               int64
	Rewritten               bool
	GeneratedVariants       int
	GeneratedFormatVariants int
	VariantSourceWidth      int
}

func OptimizeAndPersistCafePhoto(
	ctx context.Context,
	s3 *media.Service,
	cfg config.MediaConfig,
	cafeID string,
	photoKind string,
	sourceObjectKey string,
	sourceMimeType string,
	sourceSizeBytes int64,
) (OptimizedCafePhotoMeta, error) {
	return optimizeAndPersistCafePhoto(
		ctx,
		s3,
		cfg,
		cafeID,
		photoKind,
		sourceObjectKey,
		sourceMimeType,
		sourceSizeBytes,
		true,
	)
}

func PreviewCafePhotoOptimization(
	ctx context.Context,
	s3 *media.Service,
	cfg config.MediaConfig,
	cafeID string,
	photoKind string,
	sourceObjectKey string,
	sourceMimeType string,
	sourceSizeBytes int64,
) (OptimizedCafePhotoMeta, error) {
	return optimizeAndPersistCafePhoto(
		ctx,
		s3,
		cfg,
		cafeID,
		photoKind,
		sourceObjectKey,
		sourceMimeType,
		sourceSizeBytes,
		false,
	)
}

func optimizeAndPersistCafePhoto(
	ctx context.Context,
	s3 *media.Service,
	cfg config.MediaConfig,
	cafeID string,
	photoKind string,
	sourceObjectKey string,
	sourceMimeType string,
	sourceSizeBytes int64,
	persist bool,
) (OptimizedCafePhotoMeta, error) {
	if s3 == nil || !s3.Enabled() {
		return OptimizedCafePhotoMeta{}, fmt.Errorf("media service is unavailable")
	}

	trimmedCafeID := strings.TrimSpace(cafeID)
	if trimmedCafeID == "" {
		return OptimizedCafePhotoMeta{}, fmt.Errorf("%w: cafe id is required", ErrCafePhotoInvalid)
	}

	normalizedKind, err := NormalizePhotoKind(photoKind)
	if err != nil {
		return OptimizedCafePhotoMeta{}, fmt.Errorf("%w: %v", ErrCafePhotoInvalid, err)
	}

	trimmedSourceKey := strings.TrimSpace(strings.TrimPrefix(sourceObjectKey, "/"))
	if trimmedSourceKey == "" {
		return OptimizedCafePhotoMeta{}, fmt.Errorf("%w: object key is required", ErrCafePhotoInvalid)
	}

	objectContent, objectMimeType, err := s3.GetObject(ctx, trimmedSourceKey)
	if err != nil {
		return OptimizedCafePhotoMeta{}, fmt.Errorf("get source photo: %w", err)
	}
	if len(objectContent) == 0 {
		return OptimizedCafePhotoMeta{}, fmt.Errorf("%w: uploaded photo is empty", ErrCafePhotoInvalid)
	}

	normalizedSourceType := NormalizeContentType(sourceMimeType)
	if strings.TrimSpace(objectMimeType) != "" {
		normalizedSourceType = NormalizeContentType(objectMimeType)
	}

	optimized, err := optimizeCafePhoto(normalizedSourceType, objectContent)
	if err != nil {
		return OptimizedCafePhotoMeta{}, err
	}
	if len(optimized.Content) == 0 {
		return OptimizedCafePhotoMeta{}, fmt.Errorf("%w: optimized photo is empty", ErrCafePhotoInvalid)
	}

	maxBytes := cfg.S3MaxUploadBytes
	if maxBytes <= 0 {
		maxBytes = 8 * 1024 * 1024
	}
	if int64(len(optimized.Content)) > maxBytes {
		return OptimizedCafePhotoMeta{}, fmt.Errorf("%w: optimized photo exceeds max size %d", ErrCafePhotoTooLarge, maxBytes)
	}

	normalizedOutputType := NormalizeContentType(optimized.ContentType)
	if normalizedOutputType == "" {
		normalizedOutputType = normalizedSourceType
	}
	if normalizedOutputType == "" {
		return OptimizedCafePhotoMeta{}, fmt.Errorf("%w: unable to determine output mime type", ErrCafePhotoInvalid)
	}

	targetPrefix := fmt.Sprintf("cafes/%s/%s/", trimmedCafeID, normalizedKind)
	// Rewrite is required when bytes changed, mime type changed or object still lives
	// outside canonical cafes/<id>/<kind>/ path (e.g. pending submissions bucket path).
	shouldRewrite := optimized.Changed ||
		NormalizeContentType(sourceMimeType) != normalizedOutputType ||
		!strings.HasPrefix(trimmedSourceKey, targetPrefix)

	finalObjectKey := trimmedSourceKey
	finalSizeBytes := sourceSizeBytes
	rewritten := false
	if finalSizeBytes <= 0 {
		finalSizeBytes = int64(len(objectContent))
	}

	if shouldRewrite {
		nextObjectKey := buildOptimizedCafePhotoObjectKey(
			trimmedCafeID,
			normalizedKind,
			optimized.Content,
			normalizedOutputType,
		)
		if persist {
			if err := s3.PutObject(ctx, nextObjectKey, normalizedOutputType, optimized.Content); err != nil {
				return OptimizedCafePhotoMeta{}, fmt.Errorf("put optimized photo: %w", err)
			}
			if nextObjectKey != trimmedSourceKey {
				_ = s3.DeleteObject(ctx, trimmedSourceKey)
			}
		}
		finalObjectKey = nextObjectKey
		finalSizeBytes = int64(len(optimized.Content))
		rewritten = true
	}

	variantSource := objectContent
	if rewritten {
		variantSource = optimized.Content
	}
	var variantSourceWidth int
	if cfg, _, err := image.DecodeConfig(bytes.NewReader(variantSource)); err == nil {
		variantSourceWidth = cfg.Width
	}

	var rasterVariantsGenerated int
	var formatVariantsGenerated int
	if persist {
		// Responsive variants are best-effort: base image remains canonical source.
		// If variant generation fails we still return success to avoid blocking uploads.
		rasterVariantsGenerated, _ = ensureCafePhotoVariants(
			ctx,
			s3,
			finalObjectKey,
			normalizedOutputType,
			variantSource,
		)
		formatVariantsGenerated, _ = ensureCafePhotoFormatVariants(
			ctx,
			s3,
			cfg,
			finalObjectKey,
			variantSourceWidth,
		)
	} else {
		rasterVariantsGenerated = estimateCafePhotoVariantCount(variantSourceWidth)
		formatVariantsGenerated = estimateCafePhotoFormatVariantCount(variantSourceWidth, cfg.PhotoFormatEncoderFormats)
	}
	totalVariantsGenerated := rasterVariantsGenerated + formatVariantsGenerated

	return OptimizedCafePhotoMeta{
		ObjectKey:               finalObjectKey,
		MimeType:                normalizedOutputType,
		SizeBytes:               finalSizeBytes,
		Rewritten:               rewritten,
		GeneratedVariants:       totalVariantsGenerated,
		GeneratedFormatVariants: formatVariantsGenerated,
		VariantSourceWidth:      variantSourceWidth,
	}, nil
}

func optimizeCafePhoto(contentType string, original []byte) (optimizedCafePhotoResult, error) {
	normalizedType := NormalizeContentType(contentType)
	result := optimizedCafePhotoResult{
		Content:     original,
		ContentType: normalizedType,
	}
	if len(original) == 0 {
		return result, fmt.Errorf("%w: photo payload is empty", ErrCafePhotoInvalid)
	}

	// AVIF transform is intentionally skipped until encoder support is wired in backend.
	if normalizedType == "image/avif" {
		return result, nil
	}

	cfg, format, err := image.DecodeConfig(bytes.NewReader(original))
	if err != nil {
		return result, fmt.Errorf("%w: %v", ErrCafePhotoInvalid, err)
	}
	if cfg.Width <= 0 || cfg.Height <= 0 {
		return result, fmt.Errorf("%w: invalid image dimensions", ErrCafePhotoInvalid)
	}
	if cfg.Width*cfg.Height > cafePhotoMaxPixels {
		return result, fmt.Errorf("%w: image dimensions are too large", ErrCafePhotoTooLarge)
	}

	img, _, err := image.Decode(bytes.NewReader(original))
	if err != nil {
		return result, fmt.Errorf("%w: %v", ErrCafePhotoInvalid, err)
	}

	targetWidth, targetHeight := cafePhotoFitWithin(cfg.Width, cfg.Height, cafePhotoMaxSide)
	resized := img
	if targetWidth != cfg.Width || targetHeight != cfg.Height {
		dst := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
		draw.CatmullRom.Scale(dst, dst.Bounds(), img, img.Bounds(), draw.Over, nil)
		resized = dst
		result.Changed = true
	}

	var encoded bytes.Buffer
	outputType := "image/jpeg"
	if cafePhotoHasAlphaChannel(resized) {
		encoder := png.Encoder{CompressionLevel: png.DefaultCompression}
		if err := encoder.Encode(&encoded, resized); err != nil {
			return result, fmt.Errorf("encode png: %w", err)
		}
		outputType = "image/png"
	} else {
		if err := jpeg.Encode(&encoded, resized, &jpeg.Options{Quality: cafePhotoJPEGQuality}); err != nil {
			return result, fmt.Errorf("encode jpeg: %w", err)
		}
	}

	next := encoded.Bytes()
	// Keep original bytes when image dimensions are unchanged and recompression
	// produced a larger file. This avoids quality loss without bandwidth gain.
	if !result.Changed && len(next) >= len(original) {
		result.Width = cfg.Width
		result.Height = cfg.Height
		if normalizedType == "" {
			normalizedType = cafePhotoFormatToContentType(format)
		}
		if normalizedType != "" {
			result.ContentType = normalizedType
		}
		return result, nil
	}

	result.Content = next
	result.ContentType = outputType
	result.Width = targetWidth
	result.Height = targetHeight
	result.Changed = true
	return result, nil
}

func buildOptimizedCafePhotoObjectKey(cafeID, photoKind string, content []byte, contentType string) string {
	extension := cafePhotoContentTypeExtension(contentType)
	hashBytes := sha256.Sum256(content)
	hashPart := hex.EncodeToString(hashBytes[:8])
	return fmt.Sprintf(
		"cafes/%s/%s/optimized/%d_%s%s",
		strings.TrimSpace(cafeID),
		strings.TrimSpace(photoKind),
		time.Now().UnixNano(),
		hashPart,
		extension,
	)
}

func ensureCafePhotoVariants(
	ctx context.Context,
	s3 *media.Service,
	baseObjectKey string,
	contentType string,
	content []byte,
) (int, error) {
	normalizedType := NormalizeContentType(contentType)
	if normalizedType != "image/jpeg" && normalizedType != "image/png" {
		return 0, nil
	}

	baseKey := strings.TrimSpace(strings.TrimPrefix(baseObjectKey, "/"))
	if baseKey == "" {
		return 0, nil
	}
	if !strings.Contains(baseKey, "/optimized/") {
		return 0, nil
	}

	cfg, _, err := image.DecodeConfig(bytes.NewReader(content))
	if err != nil {
		return 0, err
	}
	if cfg.Width <= 0 || cfg.Height <= 0 {
		return 0, nil
	}

	widths := cafePhotoVariantWidthsForSource(cfg.Width)
	if len(widths) == 0 {
		return 0, nil
	}

	img, _, err := image.Decode(bytes.NewReader(content))
	if err != nil {
		return 0, err
	}

	generated := 0
	for _, width := range widths {
		height := int(float64(cfg.Height) * (float64(width) / float64(cfg.Width)))
		if height < 1 {
			height = 1
		}
		dst := image.NewRGBA(image.Rect(0, 0, width, height))
		draw.CatmullRom.Scale(dst, dst.Bounds(), img, img.Bounds(), draw.Over, nil)

		payload, err := encodeCafePhotoByContentType(normalizedType, dst)
		if err != nil {
			return generated, err
		}
		variantKey := buildCafePhotoVariantObjectKey(baseKey, width)
		if err := s3.PutObject(ctx, variantKey, normalizedType, payload); err != nil {
			return generated, err
		}
		generated++
	}
	return generated, nil
}

func ensureCafePhotoFormatVariants(
	ctx context.Context,
	s3 *media.Service,
	cfg config.MediaConfig,
	baseObjectKey string,
	sourceWidth int,
) (int, error) {
	baseKey := strings.TrimSpace(strings.TrimPrefix(baseObjectKey, "/"))
	if baseKey == "" {
		return 0, nil
	}
	if !strings.Contains(baseKey, "/optimized/") {
		return 0, nil
	}
	widths := cafePhotoVariantWidthsForSource(sourceWidth)
	if len(widths) == 0 {
		return 0, nil
	}

	encoder := newPhotoFormatEncoderClient(cfg)
	if encoder == nil {
		return 0, nil
	}
	sourceURL := strings.TrimSpace(s3.PublicURL(baseKey))
	if sourceURL == "" {
		return 0, nil
	}

	formats := cfg.PhotoFormatEncoderFormats
	if len(formats) == 0 {
		formats = []string{"webp", "avif"}
	}

	generated := 0
	var firstErr error
	for _, format := range formats {
		normalizedFormat := normalizePhotoVariantFormat(format)
		if normalizedFormat == "" {
			continue
		}
		for _, width := range widths {
			payload, contentType, err := encoder.Encode(ctx, sourceURL, width, normalizedFormat)
			if err != nil {
				if firstErr == nil {
					firstErr = err
				}
				continue
			}
			if len(payload) == 0 {
				continue
			}
			key := buildCafePhotoFormatVariantObjectKey(baseKey, width, normalizedFormat)
			finalContentType := strings.TrimSpace(contentType)
			if finalContentType == "" {
				finalContentType = contentTypeByPhotoVariantFormat(normalizedFormat)
			}
			if err := s3.PutObject(ctx, key, finalContentType, payload); err != nil {
				if firstErr == nil {
					firstErr = err
				}
				continue
			}
			generated++
		}
	}
	return generated, firstErr
}

func buildCafePhotoVariantObjectKey(baseObjectKey string, width int) string {
	key := strings.TrimSpace(strings.TrimPrefix(baseObjectKey, "/"))
	ext := path.Ext(key)
	if ext == "" {
		return fmt.Sprintf("%s_w%d", key, width)
	}
	base := strings.TrimSuffix(key, ext)
	return fmt.Sprintf("%s_w%d%s", base, width, ext)
}

func buildCafePhotoFormatVariantObjectKey(baseObjectKey string, width int, format string) string {
	key := strings.TrimSpace(strings.TrimPrefix(baseObjectKey, "/"))
	base := strings.TrimSuffix(key, path.Ext(key))
	normalizedFormat := normalizePhotoVariantFormat(format)
	if normalizedFormat == "" {
		normalizedFormat = "webp"
	}
	return fmt.Sprintf("%s_w%d.%s", base, width, normalizedFormat)
}

func encodeCafePhotoByContentType(contentType string, img image.Image) ([]byte, error) {
	var encoded bytes.Buffer
	switch NormalizeContentType(contentType) {
	case "image/png":
		encoder := png.Encoder{CompressionLevel: png.DefaultCompression}
		if err := encoder.Encode(&encoded, img); err != nil {
			return nil, err
		}
	default:
		if err := jpeg.Encode(&encoded, img, &jpeg.Options{Quality: cafePhotoJPEGQuality}); err != nil {
			return nil, err
		}
	}
	return encoded.Bytes(), nil
}

func estimateCafePhotoVariantCount(sourceWidth int) int {
	return len(cafePhotoVariantWidthsForSource(sourceWidth))
}

func estimateCafePhotoFormatVariantCount(sourceWidth int, formats []string) int {
	widthCount := len(cafePhotoVariantWidthsForSource(sourceWidth))
	if widthCount == 0 {
		return 0
	}
	formatCount := 0
	for _, f := range formats {
		if normalizePhotoVariantFormat(f) != "" {
			formatCount++
		}
	}
	return widthCount * formatCount
}

func cafePhotoVariantWidthsForSource(sourceWidth int) []int {
	if sourceWidth <= 0 {
		return nil
	}
	out := make([]int, 0, len(cafePhotoVariantWidths))
	for _, width := range cafePhotoVariantWidths {
		if width < sourceWidth {
			out = append(out, width)
		}
	}
	return out
}

func cafePhotoContentTypeExtension(contentType string) string {
	if ext, ok := AllowedPhotoContentTypes[NormalizeContentType(contentType)]; ok {
		return ext
	}
	return ".jpg"
}

func cafePhotoFitWithin(width, height, maxSide int) (int, int) {
	if width <= 0 || height <= 0 || maxSide <= 0 {
		return width, height
	}
	if width <= maxSide && height <= maxSide {
		return width, height
	}
	if width >= height {
		nextWidth := maxSide
		nextHeight := int(float64(height) * (float64(maxSide) / float64(width)))
		if nextHeight < 1 {
			nextHeight = 1
		}
		return nextWidth, nextHeight
	}
	nextHeight := maxSide
	nextWidth := int(float64(width) * (float64(maxSide) / float64(height)))
	if nextWidth < 1 {
		nextWidth = 1
	}
	return nextWidth, nextHeight
}

func cafePhotoHasAlphaChannel(img image.Image) bool {
	bounds := img.Bounds()
	stepX := cafePhotoMaxInt(1, bounds.Dx()/16)
	stepY := cafePhotoMaxInt(1, bounds.Dy()/16)

	for y := bounds.Min.Y; y < bounds.Max.Y; y += stepY {
		for x := bounds.Min.X; x < bounds.Max.X; x += stepX {
			_, _, _, alpha := img.At(x, y).RGBA()
			if alpha != 0xffff {
				return true
			}
		}
	}
	_, _, _, alpha := img.At(bounds.Max.X-1, bounds.Max.Y-1).RGBA()
	return alpha != 0xffff
}

func cafePhotoFormatToContentType(format string) string {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "jpeg", "jpg":
		return "image/jpeg"
	case "png":
		return "image/png"
	case "webp":
		return "image/webp"
	case "avif":
		return "image/avif"
	default:
		return ""
	}
}

func cafePhotoMaxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
