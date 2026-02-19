package cafes

import "testing"

func TestDecodeAdminCafeImportRequest_ArrayPayload(t *testing.T) {
	t.Parallel()

	raw := []byte(`[
		{"name":"One","address":"Street 1","latitude":55.75,"longitude":37.61}
	]`)

	req, err := decodeAdminCafeImportRequest(raw)
	if err != nil {
		t.Fatalf("decode request: %v", err)
	}
	if len(req.Cafes) != 1 {
		t.Fatalf("expected 1 cafe, got %d", len(req.Cafes))
	}
}

func TestNormalizeAdminCafeImportMode_DefaultAndAliases(t *testing.T) {
	t.Parallel()

	cases := map[string]string{
		"":            AdminCafeImportModeSkipExisting,
		"skip":        AdminCafeImportModeSkipExisting,
		"create_only": AdminCafeImportModeSkipExisting,
		"upsert":      AdminCafeImportModeUpsert,
	}

	for input, expected := range cases {
		got, err := normalizeAdminCafeImportMode(input)
		if err != nil {
			t.Fatalf("normalize mode for %q failed: %v", input, err)
		}
		if got != expected {
			t.Fatalf("normalize mode for %q: expected %q, got %q", input, expected, got)
		}
	}
}

func TestNormalizeCafeImportItem_Valid(t *testing.T) {
	t.Parallel()

	lat := 55.75
	lng := 37.61
	desc := "  New cafe  "
	item := adminCafeImportItem{
		Name:        " Test Cafe ",
		Address:     " Main st 1 ",
		Description: &desc,
		Latitude:    &lat,
		Longitude:   &lng,
		Amenities:   []string{"WiFi", "wifi", "Power"},
	}

	normalized, issues := normalizeCafeImportItem(item)
	if len(issues) > 0 {
		t.Fatalf("expected no issues, got %d", len(issues))
	}
	if normalized.Name != "Test Cafe" {
		t.Fatalf("unexpected name: %q", normalized.Name)
	}
	if normalized.Address != "Main st 1" {
		t.Fatalf("unexpected address: %q", normalized.Address)
	}
	if normalized.Description != "New cafe" {
		t.Fatalf("unexpected description: %q", normalized.Description)
	}
	if len(normalized.Amenities) != 2 {
		t.Fatalf("expected 2 normalized amenities, got %d", len(normalized.Amenities))
	}
}

func TestNormalizeCafeImportItem_MissingCoordinates(t *testing.T) {
	t.Parallel()

	item := adminCafeImportItem{
		Name:    "Cafe",
		Address: "Street",
	}

	_, issues := normalizeCafeImportItem(item)
	if len(issues) == 0 {
		t.Fatal("expected validation issues")
	}
}
