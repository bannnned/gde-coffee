package moderation

import (
	"strings"
	"testing"

	"backend/internal/config"
)

func TestNormalizeAmenities(t *testing.T) {
	input := []string{" WiFi ", "wifi", "  outlets", "OUTLETS", "", "  "}
	got := normalizeAmenities(input)
	if len(got) != 2 {
		t.Fatalf("expected 2 unique amenities, got %d: %v", len(got), got)
	}
	if got[0] != "wifi" || got[1] != "outlets" {
		t.Fatalf("unexpected normalized amenities: %v", got)
	}
}

func TestExtractStringArray(t *testing.T) {
	fromStrings := extractStringArray([]string{" a ", "b", "", "  "})
	if len(fromStrings) != 2 || fromStrings[0] != "a" || fromStrings[1] != "b" {
		t.Fatalf("unexpected []string extraction: %v", fromStrings)
	}

	fromAny := extractStringArray([]any{" x ", 123, "y", nil, ""})
	if len(fromAny) != 2 || fromAny[0] != "x" || fromAny[1] != "y" {
		t.Fatalf("unexpected []any extraction: %v", fromAny)
	}

	unsupported := extractStringArray(map[string]string{"a": "b"})
	if unsupported != nil {
		t.Fatalf("expected nil for unsupported type, got %v", unsupported)
	}
}

func TestDecodeSubmissionPayload(t *testing.T) {
	payload := map[string]any{
		"name":      "Test",
		"latitude":  55.7,
		"longitude": 37.6,
	}
	var target struct {
		Name      string  `json:"name"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	}
	if err := decodeSubmissionPayload(payload, &target); err != nil {
		t.Fatalf("decode payload failed: %v", err)
	}
	if target.Name != "Test" || target.Latitude != 55.7 || target.Longitude != 37.6 {
		t.Fatalf("unexpected decoded payload: %+v", target)
	}
}

func TestPublicURLForObjectKeyWithoutS3(t *testing.T) {
	handler := &Handler{
		cfg: config.MediaConfig{
			S3PublicBaseURL: "https://cdn.example.com/media/",
		},
	}

	url := handler.publicURLForObjectKey("/folder/image.jpg")
	if strings.TrimSpace(url) != "https://cdn.example.com/media/folder/image.jpg" {
		t.Fatalf("unexpected public url: %q", url)
	}
}

func TestObjectKeysToPublicURLsWithoutS3(t *testing.T) {
	handler := &Handler{
		cfg: config.MediaConfig{
			S3PublicBaseURL: "https://cdn.example.com/base",
		},
	}

	got := handler.objectKeysToPublicURLs([]string{" a.jpg ", "", "/b.jpg"})
	if len(got) != 2 {
		t.Fatalf("expected 2 urls, got %d: %v", len(got), got)
	}
	if got[0] != "https://cdn.example.com/base/a.jpg" || got[1] != "https://cdn.example.com/base/b.jpg" {
		t.Fatalf("unexpected urls: %v", got)
	}
}
