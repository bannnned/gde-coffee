package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"backend/internal/config"

	"github.com/gin-gonic/gin"
)

type geocodeAPI struct {
	client *http.Client
	cfg    config.GeocodingConfig
}

type geocodeLookupResponse struct {
	Found       bool    `json:"found"`
	Latitude    float64 `json:"latitude,omitempty"`
	Longitude   float64 `json:"longitude,omitempty"`
	DisplayName string  `json:"display_name,omitempty"`
	Provider    string  `json:"provider,omitempty"`
}

func newGeocodeAPI(cfg config.GeocodingConfig) *geocodeAPI {
	return &geocodeAPI{
		cfg: cfg,
		client: &http.Client{
			Timeout: cfg.Timeout,
		},
	}
}

func (h *geocodeAPI) Lookup(c *gin.Context) {
	address := strings.TrimSpace(c.Query("address"))
	city := strings.TrimSpace(c.Query("city"))
	if address == "" {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Параметр address обязателен.", nil)
		return
	}
	if len([]rune(address)) < 3 {
		respondError(c, http.StatusBadRequest, "invalid_argument", "Введите более подробный адрес.", nil)
		return
	}

	fullQuery := address
	if city != "" {
		fullQuery = city + ", " + address
	}

	result, err := h.lookup(c.Request.Context(), fullQuery)
	if err != nil {
		respondError(c, http.StatusBadGateway, "upstream_error", "Не удалось определить координаты по адресу.", nil)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *geocodeAPI) lookup(ctx context.Context, query string) (geocodeLookupResponse, error) {
	var yandexErr error

	if strings.TrimSpace(h.cfg.YandexAPIKey) != "" {
		result, err := h.lookupYandex(ctx, query)
		if err == nil && result.Found {
			return result, nil
		}
		if err != nil {
			yandexErr = err
		}
	}

	result, err := h.lookupNominatim(ctx, query)
	if err != nil {
		if yandexErr != nil {
			return geocodeLookupResponse{}, fmt.Errorf("yandex: %w; nominatim: %w", yandexErr, err)
		}
		return geocodeLookupResponse{}, err
	}
	return result, nil
}

func (h *geocodeAPI) lookupYandex(ctx context.Context, query string) (geocodeLookupResponse, error) {
	params := url.Values{}
	params.Set("apikey", strings.TrimSpace(h.cfg.YandexAPIKey))
	params.Set("format", "json")
	params.Set("results", "1")
	params.Set("lang", "ru_RU")
	params.Set("geocode", query)

	endpoint := "https://geocode-maps.yandex.ru/1.x/?" + params.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return geocodeLookupResponse{}, err
	}
	req.Header.Set("Accept", "application/json")
	if ua := strings.TrimSpace(h.cfg.UserAgent); ua != "" {
		req.Header.Set("User-Agent", ua)
	}

	resp, err := h.client.Do(req)
	if err != nil {
		return geocodeLookupResponse{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return geocodeLookupResponse{}, fmt.Errorf("yandex geocoder status=%d", resp.StatusCode)
	}

	var payload struct {
		Response struct {
			GeoObjectCollection struct {
				FeatureMember []struct {
					GeoObject struct {
						Point struct {
							Pos string `json:"pos"`
						} `json:"Point"`
						MetaDataProperty struct {
							GeocoderMetaData struct {
								Text string `json:"text"`
							} `json:"GeocoderMetaData"`
						} `json:"metaDataProperty"`
					} `json:"GeoObject"`
				} `json:"featureMember"`
			} `json:"GeoObjectCollection"`
		} `json:"response"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return geocodeLookupResponse{}, err
	}
	if len(payload.Response.GeoObjectCollection.FeatureMember) == 0 {
		return geocodeLookupResponse{Found: false}, nil
	}

	item := payload.Response.GeoObjectCollection.FeatureMember[0].GeoObject
	coords := strings.Fields(strings.TrimSpace(item.Point.Pos))
	if len(coords) != 2 {
		return geocodeLookupResponse{Found: false}, nil
	}

	lng, err := strconv.ParseFloat(coords[0], 64)
	if err != nil {
		return geocodeLookupResponse{}, err
	}
	lat, err := strconv.ParseFloat(coords[1], 64)
	if err != nil {
		return geocodeLookupResponse{}, err
	}

	return geocodeLookupResponse{
		Found:       true,
		Latitude:    lat,
		Longitude:   lng,
		DisplayName: strings.TrimSpace(item.MetaDataProperty.GeocoderMetaData.Text),
		Provider:    "yandex",
	}, nil
}

func (h *geocodeAPI) lookupNominatim(ctx context.Context, query string) (geocodeLookupResponse, error) {
	baseURL := strings.TrimSpace(h.cfg.NominatimBaseURL)
	baseURL = strings.TrimRight(baseURL, "/")
	if baseURL == "" {
		baseURL = "https://nominatim.openstreetmap.org"
	}

	params := url.Values{}
	params.Set("q", query)
	params.Set("format", "jsonv2")
	params.Set("limit", "1")
	params.Set("addressdetails", "0")
	params.Set("accept-language", "ru")

	endpoint := baseURL + "/search?" + params.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return geocodeLookupResponse{}, err
	}
	req.Header.Set("Accept", "application/json")
	if ua := strings.TrimSpace(h.cfg.UserAgent); ua != "" {
		req.Header.Set("User-Agent", ua)
	}

	resp, err := h.client.Do(req)
	if err != nil {
		return geocodeLookupResponse{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return geocodeLookupResponse{}, fmt.Errorf("nominatim status=%d", resp.StatusCode)
	}

	var payload []struct {
		Lat         string `json:"lat"`
		Lon         string `json:"lon"`
		DisplayName string `json:"display_name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return geocodeLookupResponse{}, err
	}
	if len(payload) == 0 {
		return geocodeLookupResponse{Found: false}, nil
	}

	lat, err := strconv.ParseFloat(strings.TrimSpace(payload[0].Lat), 64)
	if err != nil {
		return geocodeLookupResponse{}, err
	}
	lng, err := strconv.ParseFloat(strings.TrimSpace(payload[0].Lon), 64)
	if err != nil {
		return geocodeLookupResponse{}, err
	}

	return geocodeLookupResponse{
		Found:       true,
		Latitude:    lat,
		Longitude:   lng,
		DisplayName: strings.TrimSpace(payload[0].DisplayName),
		Provider:    "nominatim",
	}, nil
}
