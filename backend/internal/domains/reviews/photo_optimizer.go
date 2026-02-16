package reviews

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"strings"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	reviewPhotoMaxPixels   = 24_000_000
	reviewPhotoMaxSide     = 1920
	reviewPhotoJPEGQuality = 82
)

type optimizedPhotoResult struct {
	Content     []byte
	ContentType string
	Width       int
	Height      int
	Changed     bool
}

func optimizeReviewPhoto(contentType string, original []byte) (optimizedPhotoResult, error) {
	normalizedType := normalizeReviewPhotoContentType(contentType)
	result := optimizedPhotoResult{
		Content:     original,
		ContentType: normalizedType,
	}
	if len(original) == 0 {
		return result, fmt.Errorf("photo payload is empty")
	}

	// AVIF encoding/decoding is not wired in backend yet, so we keep original bytes.
	if normalizedType == "image/avif" {
		return result, nil
	}

	cfg, format, err := image.DecodeConfig(bytes.NewReader(original))
	if err != nil {
		return result, err
	}
	if cfg.Width <= 0 || cfg.Height <= 0 {
		return result, fmt.Errorf("invalid image dimensions")
	}
	if cfg.Width*cfg.Height > reviewPhotoMaxPixels {
		return result, fmt.Errorf("image is too large")
	}

	img, _, err := image.Decode(bytes.NewReader(original))
	if err != nil {
		return result, err
	}

	targetWidth, targetHeight := fitWithin(cfg.Width, cfg.Height, reviewPhotoMaxSide)
	resized := img
	if targetWidth != cfg.Width || targetHeight != cfg.Height {
		dst := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
		draw.CatmullRom.Scale(dst, dst.Bounds(), img, img.Bounds(), draw.Over, nil)
		resized = dst
		result.Changed = true
	}

	var encoded bytes.Buffer
	outputType := "image/jpeg"
	if hasAlphaChannel(resized) {
		encoder := png.Encoder{CompressionLevel: png.DefaultCompression}
		if err := encoder.Encode(&encoded, resized); err != nil {
			return result, err
		}
		outputType = "image/png"
	} else {
		if err := jpeg.Encode(&encoded, resized, &jpeg.Options{Quality: reviewPhotoJPEGQuality}); err != nil {
			return result, err
		}
	}

	next := encoded.Bytes()
	// If file was not resized and recompression produced larger output, keep original bytes.
	if !result.Changed && len(next) >= len(original) {
		result.Width = cfg.Width
		result.Height = cfg.Height
		if normalizedType == "" {
			normalizedType = formatToContentType(format)
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

func fitWithin(width, height, maxSide int) (int, int) {
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

func hasAlphaChannel(img image.Image) bool {
	bounds := img.Bounds()
	stepX := maxInt(1, bounds.Dx()/16)
	stepY := maxInt(1, bounds.Dy()/16)

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

func formatToContentType(format string) string {
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

func contentTypeExtension(contentType string) string {
	switch normalizeReviewPhotoContentType(contentType) {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/avif":
		return ".avif"
	default:
		return ".bin"
	}
}
