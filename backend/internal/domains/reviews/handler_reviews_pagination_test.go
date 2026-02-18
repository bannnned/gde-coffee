package reviews

import (
	"strings"
	"testing"
)

func TestParseReviewPageSize(t *testing.T) {
	tests := []struct {
		name      string
		raw       string
		want      int
		expectErr bool
	}{
		{name: "default when empty", raw: "", want: defaultReviewPageSize},
		{name: "custom within bounds", raw: "15", want: 15},
		{name: "max bound", raw: "50", want: 50},
		{name: "zero rejected", raw: "0", expectErr: true},
		{name: "negative rejected", raw: "-1", expectErr: true},
		{name: "over max rejected", raw: "51", expectErr: true},
		{name: "non numeric rejected", raw: "abc", expectErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseReviewPageSize(tt.raw)
			if tt.expectErr {
				if err == nil {
					t.Fatalf("expected error for raw=%q", tt.raw)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error for raw=%q: %v", tt.raw, err)
			}
			if got != tt.want {
				t.Fatalf("expected size=%d, got %d", tt.want, got)
			}
		})
	}
}

func TestParseReviewCursorOffsetRoundTrip(t *testing.T) {
	cursor := encodeReviewCursor(42, "helpful")
	got, err := parseReviewCursorOffset(cursor, "helpful")
	if err != nil {
		t.Fatalf("unexpected parse cursor error: %v", err)
	}
	if got != 42 {
		t.Fatalf("expected offset=42, got %d", got)
	}
}

func TestParseReviewCursorOffsetSortMismatch(t *testing.T) {
	cursor := encodeReviewCursor(8, "new")
	_, err := parseReviewCursorOffset(cursor, "verified")
	if err == nil {
		t.Fatalf("expected sort mismatch error")
	}
	if !strings.Contains(err.Error(), "cursor не соответствует выбранной сортировке") {
		t.Fatalf("unexpected mismatch error: %v", err)
	}
}

func TestParseReviewCursorOffsetInvalidFormat(t *testing.T) {
	_, err := parseReviewCursorOffset("not-base64", "new")
	if err == nil {
		t.Fatalf("expected invalid cursor format error")
	}
	if !strings.Contains(err.Error(), "cursor имеет некорректный формат") {
		t.Fatalf("unexpected invalid cursor error: %v", err)
	}
}

func TestParseReviewCursorOffsetOutOfRange(t *testing.T) {
	cursor := encodeReviewCursor(maxReviewCursorOffset+1, "new")
	_, err := parseReviewCursorOffset(cursor, "new")
	if err == nil {
		t.Fatalf("expected cursor out of range error")
	}
	if !strings.Contains(err.Error(), "cursor содержит некорректное смещение") {
		t.Fatalf("unexpected out of range error: %v", err)
	}
}
