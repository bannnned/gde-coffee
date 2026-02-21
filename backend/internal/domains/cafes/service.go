package cafes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"backend/internal/config"
	"backend/internal/domains/photos"
	"backend/internal/model"

	"github.com/jackc/pgx/v5"
)

type Service struct {
	repository *Repository
	cfg        config.Config
	client     *http.Client
}

func NewService(repository *Repository, cfg config.Config) *Service {
	return &Service{
		repository: repository,
		cfg:        cfg,
		client: &http.Client{
			Timeout: cfg.Geocoding.Timeout,
		},
	}
}

func (s *Service) List(ctx context.Context, params ListParams) ([]model.CafeResponse, error) {
	items, err := s.repository.QueryCafes(ctx, params, s.cfg.Limits)
	if err != nil {
		return nil, err
	}
	if err := photos.AttachCafeCoverPhotos(ctx, s.repository.pool, items, s.cfg.Media); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) UpdateDescription(ctx context.Context, cafeID, description string) (string, error) {
	return s.repository.UpdateDescription(ctx, cafeID, description)
}

func (s *Service) LookupAddress(ctx context.Context, address, city string) (GeocodeLookupResponse, error) {
	fullQuery := strings.TrimSpace(address)
	city = strings.TrimSpace(city)
	if city != "" {
		fullQuery = city + ", " + fullQuery
	}

	var yandexErr error
	if strings.TrimSpace(s.cfg.Geocoding.YandexAPIKey) != "" {
		result, err := s.lookupYandex(ctx, fullQuery)
		if err == nil && result.Found {
			return result, nil
		}
		if err != nil {
			yandexErr = err
		}
	}

	result, err := s.lookupNominatim(ctx, fullQuery)
	if err != nil {
		if yandexErr != nil {
			return GeocodeLookupResponse{}, fmt.Errorf("yandex: %w; nominatim: %w", yandexErr, err)
		}
		return GeocodeLookupResponse{}, err
	}
	return result, nil
}

func (s *Service) lookupYandex(ctx context.Context, query string) (GeocodeLookupResponse, error) {
	params := url.Values{}
	params.Set("apikey", strings.TrimSpace(s.cfg.Geocoding.YandexAPIKey))
	params.Set("format", "json")
	params.Set("results", "1")
	params.Set("lang", "ru_RU")
	params.Set("geocode", query)

	endpoint := "https://geocode-maps.yandex.ru/1.x/?" + params.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return GeocodeLookupResponse{}, err
	}
	req.Header.Set("Accept", "application/json")
	if ua := strings.TrimSpace(s.cfg.Geocoding.UserAgent); ua != "" {
		req.Header.Set("User-Agent", ua)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return GeocodeLookupResponse{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return GeocodeLookupResponse{}, fmt.Errorf("yandex geocoder status=%d", resp.StatusCode)
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
		return GeocodeLookupResponse{}, err
	}
	if len(payload.Response.GeoObjectCollection.FeatureMember) == 0 {
		return GeocodeLookupResponse{Found: false}, nil
	}

	item := payload.Response.GeoObjectCollection.FeatureMember[0].GeoObject
	coords := strings.Fields(strings.TrimSpace(item.Point.Pos))
	if len(coords) != 2 {
		return GeocodeLookupResponse{Found: false}, nil
	}

	lng, err := strconv.ParseFloat(coords[0], 64)
	if err != nil {
		return GeocodeLookupResponse{}, err
	}
	lat, err := strconv.ParseFloat(coords[1], 64)
	if err != nil {
		return GeocodeLookupResponse{}, err
	}

	return GeocodeLookupResponse{
		Found:       true,
		Latitude:    lat,
		Longitude:   lng,
		DisplayName: strings.TrimSpace(item.MetaDataProperty.GeocoderMetaData.Text),
		Provider:    "yandex",
	}, nil
}

func (s *Service) lookupNominatim(ctx context.Context, query string) (GeocodeLookupResponse, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(s.cfg.Geocoding.NominatimBaseURL), "/")
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
		return GeocodeLookupResponse{}, err
	}
	req.Header.Set("Accept", "application/json")
	if ua := strings.TrimSpace(s.cfg.Geocoding.UserAgent); ua != "" {
		req.Header.Set("User-Agent", ua)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return GeocodeLookupResponse{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return GeocodeLookupResponse{}, fmt.Errorf("nominatim status=%d", resp.StatusCode)
	}

	var payload []struct {
		Lat         string `json:"lat"`
		Lon         string `json:"lon"`
		DisplayName string `json:"display_name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return GeocodeLookupResponse{}, err
	}
	if len(payload) == 0 {
		return GeocodeLookupResponse{Found: false}, nil
	}

	lat, err := strconv.ParseFloat(strings.TrimSpace(payload[0].Lat), 64)
	if err != nil {
		return GeocodeLookupResponse{}, err
	}
	lng, err := strconv.ParseFloat(strings.TrimSpace(payload[0].Lon), 64)
	if err != nil {
		return GeocodeLookupResponse{}, err
	}

	return GeocodeLookupResponse{
		Found:       true,
		Latitude:    lat,
		Longitude:   lng,
		DisplayName: strings.TrimSpace(payload[0].DisplayName),
		Provider:    "nominatim",
	}, nil
}

func (s *Service) IsNotFound(err error) bool {
	return err == pgx.ErrNoRows
}

func (s *Service) TimeoutContext(parent context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, timeout)
}

func (s *Service) ImportJSON(ctx context.Context, req adminCafeImportRequest) (adminCafeImportResponse, error) {
	resp := adminCafeImportResponse{
		Mode:   req.Mode,
		DryRun: req.DryRun,
		Summary: adminCafeImportSummary{
			Total: len(req.Cafes),
		},
		Results: make([]adminCafeImportResultItem, 0, len(req.Cafes)),
		Issues:  make([]adminCafeImportIssue, 0, min(len(req.Cafes), 32)),
	}

	appendIssue := func(issue adminCafeImportIssue) {
		if len(resp.Issues) >= AdminCafeImportMaxIssues {
			return
		}
		resp.Issues = append(resp.Issues, issue)
	}

	for index, rawItem := range req.Cafes {
		nextIndex := index + 1
		normalized, validationIssues := normalizeCafeImportItem(rawItem)
		if len(validationIssues) > 0 {
			resp.Summary.Invalid++
			result := adminCafeImportResultItem{
				Index:   nextIndex,
				Status:  "invalid",
				Name:    strings.TrimSpace(rawItem.Name),
				Address: strings.TrimSpace(rawItem.Address),
				Message: validationIssues[0].Message,
			}
			resp.Results = append(resp.Results, result)
			for _, issue := range validationIssues {
				issue.Index = nextIndex
				appendIssue(issue)
			}
			continue
		}

		existingID, found, err := s.repository.FindCafeByNameAddress(ctx, normalized.Name, normalized.Address)
		if err != nil {
			resp.Summary.Failed++
			resp.Results = append(resp.Results, adminCafeImportResultItem{
				Index:   nextIndex,
				Status:  "failed",
				Name:    normalized.Name,
				Address: normalized.Address,
				Message: "Не удалось проверить существующую кофейню.",
			})
			appendIssue(adminCafeImportIssue{
				Index:   nextIndex,
				Message: "Ошибка проверки дубликатов в БД.",
			})
			continue
		}

		if found {
			if req.Mode == AdminCafeImportModeSkipExisting {
				resp.Summary.Skipped++
				resp.Results = append(resp.Results, adminCafeImportResultItem{
					Index:   nextIndex,
					Status:  "skipped",
					Name:    normalized.Name,
					Address: normalized.Address,
					CafeID:  &existingID,
					Message: "Кофейня уже существует.",
				})
				continue
			}

			if req.DryRun {
				resp.Summary.Updated++
				resp.Results = append(resp.Results, adminCafeImportResultItem{
					Index:   nextIndex,
					Status:  "would_update",
					Name:    normalized.Name,
					Address: normalized.Address,
					CafeID:  &existingID,
				})
				continue
			}

			if err := s.repository.UpdateCafeByID(ctx, existingID, normalized); err != nil {
				resp.Summary.Failed++
				resp.Results = append(resp.Results, adminCafeImportResultItem{
					Index:   nextIndex,
					Status:  "failed",
					Name:    normalized.Name,
					Address: normalized.Address,
					CafeID:  &existingID,
					Message: "Не удалось обновить кофейню.",
				})
				appendIssue(adminCafeImportIssue{
					Index:   nextIndex,
					Message: "Ошибка обновления кофейни в БД.",
				})
				continue
			}

			resp.Summary.Updated++
			resp.Results = append(resp.Results, adminCafeImportResultItem{
				Index:   nextIndex,
				Status:  "updated",
				Name:    normalized.Name,
				Address: normalized.Address,
				CafeID:  &existingID,
			})
			continue
		}

		if req.DryRun {
			resp.Summary.Created++
			resp.Results = append(resp.Results, adminCafeImportResultItem{
				Index:   nextIndex,
				Status:  "would_create",
				Name:    normalized.Name,
				Address: normalized.Address,
			})
			continue
		}

		createdID, err := s.repository.InsertCafe(ctx, normalized)
		if err != nil {
			resp.Summary.Failed++
			resp.Results = append(resp.Results, adminCafeImportResultItem{
				Index:   nextIndex,
				Status:  "failed",
				Name:    normalized.Name,
				Address: normalized.Address,
				Message: "Не удалось создать кофейню.",
			})
			appendIssue(adminCafeImportIssue{
				Index:   nextIndex,
				Message: "Ошибка создания кофейни в БД.",
			})
			continue
		}

		resp.Summary.Created++
		resp.Results = append(resp.Results, adminCafeImportResultItem{
			Index:   nextIndex,
			Status:  "created",
			Name:    normalized.Name,
			Address: normalized.Address,
			CafeID:  &createdID,
		})
	}

	if len(resp.Issues) == 0 {
		resp.Issues = nil
	}

	return resp, nil
}

func (s *Service) SearchAdminCafesByName(ctx context.Context, query string, limit int) ([]AdminCafeSearchItem, error) {
	normalizedQuery := strings.TrimSpace(query)
	if normalizedQuery == "" {
		return []AdminCafeSearchItem{}, nil
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	return s.repository.SearchAdminCafesByName(ctx, normalizedQuery, limit)
}
