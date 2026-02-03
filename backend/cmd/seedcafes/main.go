package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

type Cafe struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Address   string   `json:"address"`
	Latitude  float64  `json:"latitude"`
	Longitude float64  `json:"longitude"`
	Amenities []string `json:"amenities"`
}

// Overpass JSON response structs (minimum fields we need)
type overpassResp struct {
	Elements []element `json:"elements"`
}

type element struct {
	Type   string            `json:"type"`
	ID     int64             `json:"id"`
	Lat    *float64          `json:"lat,omitempty"`
	Lon    *float64          `json:"lon,omitempty"`
	Center *center           `json:"center,omitempty"`
	Tags   map[string]string `json:"tags,omitempty"`
}

type center struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

func main() {
	rand.Seed(time.Now().UnixNano())

	// Санкт-Петербург — OSM relation 337422 => Overpass area 3600337422
	// Собираем только те, где есть name и хотя бы addr:street или addr:full
	overpassQL := `
[out:json][timeout:60];
area(3600337422)->.spb;
(
  nwr["amenity"="cafe"]["name"]["addr:street"](area.spb);
  nwr["amenity"="cafe"]["name"]["addr:full"](area.spb);
  nwr["shop"="coffee"]["name"]["addr:street"](area.spb);
  nwr["shop"="coffee"]["name"]["addr:full"](area.spb);
);
out tags center;
`

	endpoint := "https://overpass-api.de/api/interpreter"

	data, err := overpassFetch(endpoint, overpassQL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "overpass fetch error:", err)
		os.Exit(1)
	}

	cafes := buildCafes(data, 15) // попробуем набрать 60, чтобы точно было >= 50 после дедупа/фильтра
	if len(cafes) < 20 {
		// Фолбэк: чуть расширим запрос (без адресного фильтра), а адрес возьмём из addr:* если есть,
		// остальные пропустим — часто всё равно добьёт до 50.
		overpassQL2 := `
[out:json][timeout:90];
area(3600337422)->.spb;
(
  nwr["amenity"="cafe"]["name"](area.spb);
  nwr["shop"="coffee"]["name"](area.spb);
);
out tags center;
`
		data2, err2 := overpassFetch(endpoint, overpassQL2)
		if err2 == nil {
			cafes = buildCafes(data2, 80)
		}
	}

	if len(cafes) < 20 {
		fmt.Fprintln(os.Stderr, "не смог набрать 20 кафе (в OSM может не хватать адресных тегов). Сейчас:", len(cafes))
		os.Exit(2)
	}

	// Берём ровно 20 (можешь поменять)
	cafes = cafes[:20]

	printGoSlice(cafes)
}

func overpassFetch(url, query string) (*overpassResp, error) {
	req, err := http.NewRequest("POST", url, bytes.NewBufferString(query))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 2000))
		return nil, fmt.Errorf("http %d: %s", resp.StatusCode, string(b))
	}

	var out overpassResp
	dec := json.NewDecoder(resp.Body)
	if err := dec.Decode(&out); err != nil {
		return nil, err
	}
	return &out, nil
}

func buildCafes(r *overpassResp, want int) []Cafe {
	type key struct {
		name string
		addr string
	}
	seen := map[key]bool{}

	amenityPool := []string{
		"wifi", "power", "quiet", "pet_friendly", "outdoor",
		"breakfast", "vegan", "desserts", "parking", "music",
	}

	var out []Cafe

	for _, el := range r.Elements {
		if el.Tags == nil {
			continue
		}
		name := strings.TrimSpace(el.Tags["name"])
		if name == "" {
			continue
		}

		lat, lon, ok := elementLatLon(el)
		if !ok {
			continue
		}

		addr := buildAddress(el.Tags)
		if addr == "" {
			// адрес обязателен по твоему ТЗ — пропускаем
			continue
		}

		k := key{name: strings.ToLower(name), addr: strings.ToLower(addr)}
		if seen[k] {
			continue
		}
		seen[k] = true

		out = append(out, Cafe{
			ID:        "", // проставим позже
			Name:      name,
			Address:   addr,
			Latitude:  lat,
			Longitude: lon,
			Amenities: randomAmenities(amenityPool),
		})

		if len(out) >= want {
			break
		}
	}

	// Для стабильности выдачи — сортируем по имени+адресу
	sort.Slice(out, func(i, j int) bool {
		if out[i].Name == out[j].Name {
			return out[i].Address < out[j].Address
		}
		return out[i].Name < out[j].Name
	})

	// Проставляем ID
	for i := range out {
		out[i].ID = fmt.Sprintf("cafe-%d", i+1)
	}
	return out
}

func elementLatLon(el element) (float64, float64, bool) {
	if el.Lat != nil && el.Lon != nil {
		return *el.Lat, *el.Lon, true
	}
	if el.Center != nil {
		return el.Center.Lat, el.Center.Lon, true
	}
	return 0, 0, false
}

func buildAddress(tags map[string]string) string {
	if full := strings.TrimSpace(tags["addr:full"]); full != "" {
		return full
	}
	st := strings.TrimSpace(tags["addr:street"])
	hn := strings.TrimSpace(tags["addr:housenumber"])

	if st == "" {
		return ""
	}
	if hn == "" {
		return st
	}
	// формат ближе к твоему примеру: "Street, 10"
	return fmt.Sprintf("%s, %s", st, hn)
}

func randomAmenities(pool []string) []string {
	// 2..4 уникальных аменити
	n := 2 + rand.Intn(3)

	p := make([]string, len(pool))
	copy(p, pool)
	rand.Shuffle(len(p), func(i, j int) { p[i], p[j] = p[j], p[i] })

	return p[:n]
}

func printGoSlice(cafes []Cafe) {
	fmt.Println("package data\nimport \"backend/internal/model\"\nvar cafes = []model.Cafe{")
	for _, c := range cafes {
		fmt.Printf("\t{ID: %q, Name: %q, Address: %q, Latitude: %.6f, Longitude: %.6f, Amenities: []string{%s}},\n",
			c.ID,
			c.Name,
			c.Address,
			c.Latitude,
			c.Longitude,
			formatStringSlice(c.Amenities),
		)
	}
	fmt.Println("}")
}

func formatStringSlice(ss []string) string {
	var b strings.Builder
	for i, s := range ss {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString(fmt.Sprintf("%q", s))
	}
	return b.String()
}
