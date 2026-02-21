package photos

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

func TestOptimizeCafePhotoResizesLargeJPEG(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 5200, 3400))
	fillCafeTestImage(src, color.RGBA{R: 220, G: 180, B: 120, A: 255})

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, src, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatalf("encode jpeg: %v", err)
	}

	result, err := optimizeCafePhoto("image/jpeg", buf.Bytes())
	if err != nil {
		t.Fatalf("optimize photo: %v", err)
	}
	if !result.Changed {
		t.Fatalf("expected resized image to be marked as changed")
	}
	if result.ContentType != "image/jpeg" {
		t.Fatalf("expected jpeg output, got %q", result.ContentType)
	}
	if result.Width > cafePhotoMaxSide || result.Height > cafePhotoMaxSide {
		t.Fatalf("expected resized dimensions <= %d, got %dx%d", cafePhotoMaxSide, result.Width, result.Height)
	}
}

func TestOptimizeCafePhotoKeepsAlphaAsPNG(t *testing.T) {
	src := image.NewNRGBA(image.Rect(0, 0, 220, 160))
	fillCafeTestImage(src, color.NRGBA{R: 10, G: 20, B: 30, A: 120})

	var buf bytes.Buffer
	encoder := png.Encoder{CompressionLevel: png.DefaultCompression}
	if err := encoder.Encode(&buf, src); err != nil {
		t.Fatalf("encode png: %v", err)
	}

	result, err := optimizeCafePhoto("image/png", buf.Bytes())
	if err != nil {
		t.Fatalf("optimize photo: %v", err)
	}
	if result.ContentType != "image/png" {
		t.Fatalf("expected png output for alpha image, got %q", result.ContentType)
	}
}

func TestOptimizeCafePhotoSkipsAVIF(t *testing.T) {
	original := []byte("fake-avif-content")
	result, err := optimizeCafePhoto("image/avif", original)
	if err != nil {
		t.Fatalf("optimize photo: %v", err)
	}
	if result.Changed {
		t.Fatalf("expected avif bytes to stay unchanged")
	}
	if result.ContentType != "image/avif" {
		t.Fatalf("expected avif content type, got %q", result.ContentType)
	}
	if !bytes.Equal(result.Content, original) {
		t.Fatalf("expected original payload to be returned for avif")
	}
}

func TestBuildCafePhotoVariantObjectKey(t *testing.T) {
	base := "cafes/cafe-1/cafe/optimized/1700000000000_abcd1234.jpg"
	got := buildCafePhotoVariantObjectKey(base, 1024)
	want := "cafes/cafe-1/cafe/optimized/1700000000000_abcd1234_w1024.jpg"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestBuildCafePhotoFormatVariantObjectKey(t *testing.T) {
	base := "cafes/cafe-1/cafe/optimized/1700000000000_abcd1234.jpg"
	got := buildCafePhotoFormatVariantObjectKey(base, 1024, "avif")
	want := "cafes/cafe-1/cafe/optimized/1700000000000_abcd1234_w1024.avif"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestEstimateCafePhotoFormatVariantCount(t *testing.T) {
	count := estimateCafePhotoFormatVariantCount(1800, []string{"webp", "avif"})
	if count != 8 {
		t.Fatalf("expected 8 variants, got %d", count)
	}
}

func fillCafeTestImage(dst image.Image, c color.Color) {
	bounds := dst.Bounds()
	switch canvas := dst.(type) {
	case *image.RGBA:
		for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
			for x := bounds.Min.X; x < bounds.Max.X; x++ {
				canvas.Set(x, y, c)
			}
		}
	case *image.NRGBA:
		for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
			for x := bounds.Min.X; x < bounds.Max.X; x++ {
				canvas.Set(x, y, c)
			}
		}
	default:
		for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
			for x := bounds.Min.X; x < bounds.Max.X; x++ {
				if setter, ok := dst.(interface{ Set(int, int, color.Color) }); ok {
					setter.Set(x, y, c)
				}
			}
		}
	}
}
