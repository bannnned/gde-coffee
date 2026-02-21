package tags

import (
	"context"
	"strings"
)

type repository interface {
	ListPopularDescriptiveTags(ctx context.Context, scope GeoScope, limit int) ([]popularTagRow, error)
	ListDescriptiveTagOptions(ctx context.Context, scope GeoScope, search string, limit int) ([]string, error)
	ListExistingDescriptiveTagLabels(ctx context.Context, scope GeoScope, keys []string) (map[string]string, error)
	ListUserPreferences(ctx context.Context, userID string, category string, limit int) ([]string, error)
	ReplaceUserPreferences(ctx context.Context, userID string, category string, tags []string) error
}

type Service struct {
	repository repository
}

func NewService(repository repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) GetDiscoveryDescriptiveTags(
	ctx context.Context,
	scope GeoScope,
	userID *string,
	limit int,
) (DiscoveryResponse, error) {
	limit = normalizeLimit(limit, DefaultLimit, MaxLimit)

	if userID != nil {
		safeUserID := strings.TrimSpace(*userID)
		if safeUserID != "" {
			preferences, err := s.repository.ListUserPreferences(ctx, safeUserID, CategoryDescriptive, MaxPreferenceTags)
			if err != nil {
				return DiscoveryResponse{}, err
			}
			if len(preferences) > 0 {
				items := make([]DiscoveryTag, 0, min(limit, len(preferences)))
				for _, label := range preferences {
					if len(items) >= limit {
						break
					}
					label = strings.TrimSpace(label)
					if label == "" {
						continue
					}
					items = append(items, DiscoveryTag{
						Label:    label,
						Category: CategoryDescriptive,
						Score:    1,
					})
				}
				if len(items) > 0 {
					return DiscoveryResponse{
						Source: "user_favorites",
						Tags:   items,
					}, nil
				}
			}
		}
	}

	popular, err := s.repository.ListPopularDescriptiveTags(ctx, scope, limit)
	if err != nil {
		return DiscoveryResponse{}, err
	}

	items := make([]DiscoveryTag, 0, len(popular))
	for _, row := range popular {
		if strings.TrimSpace(row.Label) == "" {
			continue
		}
		items = append(items, DiscoveryTag{
			Label:    row.Label,
			Category: CategoryDescriptive,
			Score:    row.AvgWeight,
		})
	}
	return DiscoveryResponse{
		Source: "city_popular",
		Tags:   items,
	}, nil
}

func (s *Service) ListDescriptiveTagOptions(
	ctx context.Context,
	scope GeoScope,
	search string,
	limit int,
) (OptionsResponse, error) {
	limit = normalizeLimit(limit, DefaultOptionsLimit, MaxOptionsLimit)
	search = strings.TrimSpace(search)
	options, err := s.repository.ListDescriptiveTagOptions(ctx, scope, search, limit)
	if err != nil {
		return OptionsResponse{}, err
	}
	return OptionsResponse{Tags: options}, nil
}

func (s *Service) GetUserDescriptivePreferences(
	ctx context.Context,
	userID string,
) (PreferencesResponse, error) {
	items, err := s.repository.ListUserPreferences(ctx, userID, CategoryDescriptive, MaxPreferenceTags)
	if err != nil {
		return PreferencesResponse{}, err
	}
	return PreferencesResponse{
		Category: CategoryDescriptive,
		Tags:     items,
	}, nil
}

func (s *Service) ReplaceUserDescriptivePreferences(
	ctx context.Context,
	userID string,
	scope GeoScope,
	tags []string,
) (PreferencesResponse, error) {
	normalized := normalizeTagLabels(tags, MaxPreferenceTags)
	if len(normalized) == 0 {
		if err := s.repository.ReplaceUserPreferences(ctx, userID, CategoryDescriptive, []string{}); err != nil {
			return PreferencesResponse{}, err
		}
		return PreferencesResponse{
			Category: CategoryDescriptive,
			Tags:     []string{},
		}, nil
	}

	keys := make([]string, 0, len(normalized))
	for _, label := range normalized {
		keys = append(keys, strings.ToLower(strings.TrimSpace(label)))
	}
	existing, err := s.repository.ListExistingDescriptiveTagLabels(ctx, scope, keys)
	if err != nil {
		return PreferencesResponse{}, err
	}

	filtered := make([]string, 0, len(normalized))
	seen := make(map[string]struct{}, len(normalized))
	for _, label := range normalized {
		key := strings.ToLower(strings.TrimSpace(label))
		knownLabel, ok := existing[key]
		if !ok {
			continue
		}
		if _, duplicated := seen[key]; duplicated {
			continue
		}
		seen[key] = struct{}{}
		filtered = append(filtered, knownLabel)
	}

	if err := s.repository.ReplaceUserPreferences(ctx, userID, CategoryDescriptive, filtered); err != nil {
		return PreferencesResponse{}, err
	}
	return PreferencesResponse{
		Category: CategoryDescriptive,
		Tags:     filtered,
	}, nil
}

func normalizeTagLabels(input []string, limit int) []string {
	if len(input) == 0 {
		return []string{}
	}
	if limit <= 0 {
		limit = len(input)
	}
	seen := make(map[string]struct{}, len(input))
	result := make([]string, 0, min(len(input), limit))
	for _, raw := range input {
		label := strings.Join(strings.Fields(strings.TrimSpace(raw)), " ")
		if label == "" {
			continue
		}
		key := strings.ToLower(label)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, label)
		if len(result) >= limit {
			break
		}
	}
	return result
}

func normalizeLimit(value int, defaultValue int, maxValue int) int {
	if value <= 0 {
		value = defaultValue
	}
	if value > maxValue {
		value = maxValue
	}
	return value
}

func min(left int, right int) int {
	if left < right {
		return left
	}
	return right
}
