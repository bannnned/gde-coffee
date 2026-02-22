package reviews

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	defaultAISummaryTimeout        = 10 * time.Second
	defaultAISummaryMaxInput       = 20
	defaultAISummaryMaxOutputTags  = 6
	defaultAISummaryMinReviewCount = 3
	defaultAIProxySource           = "gde-kofe-backend"
	defaultAIModel                 = "gpt-4"
	aiSummaryReviewStep            = 5
	aiSummaryStaleWindow           = 14 * 24 * time.Hour
	aiSummaryPromptSummaryRunes    = 180
	aiSummaryCompletionTokens      = 120
)

type aiSummaryConfig struct {
	Enabled            bool
	ChatCompletionsURL string
	BearerToken        string
	ProxySource        string
	Model              string
	Timeout            time.Duration
	MaxInputReviews    int
	MaxOutputTags      int
	MinReviews         int
}

type aiReviewSignal struct {
	ReviewID      string
	Rating        float64
	Summary       string
	TasteTags     []string
	HelpfulScore  float64
	VisitVerified bool
	CreatedAt     time.Time
}

type aiSummaryResult struct {
	SummaryShort string
	Tags         []string
	UsedReviews  int
	InputHash    string
}

type aiSummaryState struct {
	Reusable        bool
	GeneratedAt     time.Time
	GeneratedAtStep int
	DescriptiveTags []cafeSemanticTag
	Payload         map[string]interface{}
}

type aiSummaryPromptReview struct {
	Rating        float64 `json:"rating"`
	Summary       string  `json:"summary"`
	VisitVerified bool    `json:"visit_verified"`
}

func loadAISummaryConfigFromEnv() aiSummaryConfig {
	cfg := aiSummaryConfig{
		Enabled:            envBool("AI_SUMMARY_ENABLED", false),
		ChatCompletionsURL: normalizeChatCompletionsURL(os.Getenv("TIMEWEB_AI_OPENAI_URL")),
		BearerToken:        loadTimewebBearerTokenFromEnv(),
		ProxySource:        normalizeNonEmpty(os.Getenv("TIMEWEB_AI_PROXY_SOURCE"), defaultAIProxySource),
		Model:              normalizeNonEmpty(os.Getenv("TIMEWEB_AI_MODEL"), defaultAIModel),
		Timeout:            parseDurationWithFallback("TIMEWEB_AI_TIMEOUT", defaultAISummaryTimeout),
		MaxInputReviews:    parseIntWithFallback("TIMEWEB_AI_MAX_INPUT_REVIEWS", defaultAISummaryMaxInput),
		MaxOutputTags:      parseIntWithFallback("TIMEWEB_AI_MAX_OUTPUT_TAGS", defaultAISummaryMaxOutputTags),
		MinReviews:         parseIntWithFallback("TIMEWEB_AI_MIN_REVIEWS", defaultAISummaryMinReviewCount),
	}

	if cfg.MaxInputReviews < 1 {
		cfg.MaxInputReviews = defaultAISummaryMaxInput
	}
	if cfg.MaxOutputTags < 1 {
		cfg.MaxOutputTags = defaultAISummaryMaxOutputTags
	}
	if cfg.MinReviews < 1 {
		cfg.MinReviews = defaultAISummaryMinReviewCount
	}

	if !cfg.Enabled {
		return cfg
	}
	if cfg.ChatCompletionsURL == "" || cfg.BearerToken == "" {
		// Defensive default: if integration is not fully configured,
		// keep rule-based tags without failing review flows.
		cfg.Enabled = false
	}
	return cfg
}

func loadTimewebBearerTokenFromEnv() string {
	if token := strings.TrimSpace(os.Getenv("TIMEWEB_AI_BEARER_TOKEN")); token != "" {
		return token
	}

	var builder strings.Builder
	for index := 1; index <= 6; index++ {
		part := strings.TrimSpace(os.Getenv(fmt.Sprintf("TIMEWEB_AI_BEARER_TOKEN_P%d", index)))
		if part == "" {
			continue
		}
		builder.WriteString(part)
	}
	return strings.TrimSpace(builder.String())
}

func normalizeChatCompletionsURL(raw string) string {
	base := strings.TrimSpace(raw)
	if base == "" {
		return ""
	}
	base = strings.TrimRight(base, "/")
	if strings.HasSuffix(strings.ToLower(base), "/chat/completions") {
		return base
	}
	return base + "/chat/completions"
}

func parseDurationWithFallback(envKey string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(envKey))
	if raw == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func parseIntWithFallback(envKey string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(envKey))
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func truncateText(value string, maxRunes int) string {
	if maxRunes <= 0 {
		return ""
	}
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= maxRunes {
		return string(runes)
	}
	return string(runes[:maxRunes])
}

func collapseWhitespace(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func selectTopAIReviews(input []aiReviewSignal, limit int) []aiReviewSignal {
	if len(input) == 0 || limit <= 0 {
		return nil
	}
	clean := make([]aiReviewSignal, 0, len(input))
	for _, item := range input {
		if strings.TrimSpace(item.Summary) == "" {
			continue
		}
		clean = append(clean, item)
	}
	sort.SliceStable(clean, func(i, j int) bool {
		if clean[i].HelpfulScore != clean[j].HelpfulScore {
			return clean[i].HelpfulScore > clean[j].HelpfulScore
		}
		if clean[i].VisitVerified != clean[j].VisitVerified {
			return clean[i].VisitVerified
		}
		if !clean[i].CreatedAt.Equal(clean[j].CreatedAt) {
			return clean[i].CreatedAt.After(clean[j].CreatedAt)
		}
		if clean[i].Rating != clean[j].Rating {
			return clean[i].Rating > clean[j].Rating
		}
		return clean[i].ReviewID > clean[j].ReviewID
	})
	if len(clean) > limit {
		clean = clean[:limit]
	}
	return clean
}

func buildAISummaryPromptReviews(
	reviews []aiReviewSignal,
	cfg aiSummaryConfig,
) ([]aiSummaryPromptReview, error) {
	selected := selectTopAIReviews(reviews, cfg.MaxInputReviews)
	if len(selected) < cfg.MinReviews {
		return nil, fmt.Errorf("not enough reviews for ai summary")
	}

	promptItems := make([]aiSummaryPromptReview, 0, len(selected))
	for _, item := range selected {
		summary := truncateText(collapseWhitespace(item.Summary), aiSummaryPromptSummaryRunes)
		if summary == "" {
			continue
		}
		promptItems = append(promptItems, aiSummaryPromptReview{
			Rating:        roundFloat(item.Rating, 2),
			Summary:       summary,
			VisitVerified: item.VisitVerified,
		})
	}
	if len(promptItems) < cfg.MinReviews {
		return nil, fmt.Errorf("not enough reviews for ai summary")
	}
	return promptItems, nil
}

func computeAISummaryInputHash(cafeID string, promptItems []aiSummaryPromptReview) (string, error) {
	payloadRaw, err := json.Marshal(map[string]interface{}{
		"cafe_id": cafeID,
		"reviews": promptItems,
	})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(payloadRaw)
	return hex.EncodeToString(sum[:]), nil
}

func (s *Service) calculateAISummaryInputHash(
	cafeID string,
	reviews []aiReviewSignal,
) (string, int, error) {
	cfg := s.aiSummaryCfg
	if !cfg.Enabled {
		return "", 0, fmt.Errorf("ai summary disabled")
	}
	promptItems, err := buildAISummaryPromptReviews(reviews, cfg)
	if err != nil {
		return "", 0, err
	}
	inputHash, err := computeAISummaryInputHash(cafeID, promptItems)
	if err != nil {
		return "", 0, err
	}
	return inputHash, len(promptItems), nil
}

func normalizeAITagLabels(input []string, limit int) []string {
	if limit <= 0 {
		return []string{}
	}
	result := make([]string, 0, min(limit, len(input)))
	seen := make(map[string]struct{}, len(input))
	for _, raw := range input {
		label := normalizeSemanticTagLabel(raw)
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

func buildAIDescriptiveCafeTags(labels []string, reviewsCount int) []cafeSemanticTag {
	normalized := normalizeAITagLabels(labels, len(labels))
	if len(normalized) == 0 {
		return []cafeSemanticTag{}
	}

	support := maxInt(1, reviewsCount/3)
	result := make([]cafeSemanticTag, 0, len(normalized))
	for index, label := range normalized {
		score := 100.0 - (float64(index) * 7.0)
		if score < 55 {
			score = 55
		}
		result = append(result, cafeSemanticTag{
			Key:          normalizeSemanticTagToken(label),
			Label:        label,
			Type:         "descriptive",
			Category:     "review_summary",
			Score:        roundFloat(score, 3),
			SupportCount: support,
			Source:       "timeweb_ai_v1",
		})
	}
	return result
}

func decideAISummaryAttempt(
	cfg aiSummaryConfig,
	previous aiSummaryState,
	force bool,
	reviewsCount int,
) (bool, string, int) {
	if !cfg.Enabled {
		return false, "disabled", 0
	}
	if force {
		return true, "manual_force", 0
	}
	if reviewsCount < aiSummaryReviewStep {
		return false, "not_enough_reviews", aiSummaryReviewStep
	}

	currentStep := reviewsCount / aiSummaryReviewStep
	previousStep := previous.GeneratedAtStep / aiSummaryReviewStep
	if previous.GeneratedAtStep <= 0 {
		if previous.GeneratedAt.IsZero() {
			return true, "threshold_reached", nextAISummaryStepThreshold(reviewsCount)
		}
		// Backward compatibility for snapshots generated before step-based metadata.
		// Re-run once and persist step counters.
		return true, "backfill_step_metadata", nextAISummaryStepThreshold(reviewsCount)
	}

	if currentStep > previousStep {
		return true, "threshold_reached", nextAISummaryStepThreshold(reviewsCount)
	}

	return false, "threshold_wait", (previousStep + 1) * aiSummaryReviewStep
}

func nextAISummaryStepThreshold(reviewsCount int) int {
	if reviewsCount < aiSummaryReviewStep {
		return aiSummaryReviewStep
	}
	return ((reviewsCount / aiSummaryReviewStep) + 1) * aiSummaryReviewStep
}

func buildAISummaryStaleNotice(reviews []aiReviewSignal, now time.Time) string {
	if len(reviews) == 0 {
		return ""
	}
	lastReviewAt := reviews[0].CreatedAt
	for _, item := range reviews[1:] {
		if item.CreatedAt.After(lastReviewAt) {
			lastReviewAt = item.CreatedAt
		}
	}
	if lastReviewAt.IsZero() {
		return ""
	}
	if now.UTC().Sub(lastReviewAt.UTC()) < aiSummaryStaleWindow {
		return ""
	}
	return "Сюда давно не заходили. Исправьте это и оставьте свежий отзыв."
}

func intFromAny(value interface{}) int {
	switch cast := value.(type) {
	case int:
		return cast
	case int32:
		return int(cast)
	case int64:
		return int(cast)
	case float64:
		return int(cast)
	case float32:
		return int(cast)
	default:
		return 0
	}
}

func extractAISummaryState(snapshot map[string]interface{}, snapshotErr error) aiSummaryState {
	if snapshotErr != nil || snapshot == nil {
		return aiSummaryState{}
	}

	components, ok := snapshot["components"].(map[string]interface{})
	if !ok || components == nil {
		return aiSummaryState{}
	}
	rawPayload, ok := components["ai_summary"].(map[string]interface{})
	if !ok || rawPayload == nil {
		return aiSummaryState{}
	}

	payload := cloneMap(rawPayload)
	generatedAt := parseAIStampToTime(rawPayload["generated_at"])
	if generatedAt.IsZero() {
		// Backward compatibility for earlier AI payloads without generated_at.
		generatedAt = parseAIStampToTime(snapshot["computed_at"])
	}

	descriptiveTags := parseSnapshotDescriptiveTags(components["descriptive_tags"])
	reusable := len(descriptiveTags) > 0 && normalizeSemanticTagToken(toStringSafe(components["descriptive_tags_source"])) == "timeweb_ai_v1"

	return aiSummaryState{
		Reusable:        reusable,
		GeneratedAt:     generatedAt,
		GeneratedAtStep: intFromAny(rawPayload["generated_reviews_count"]),
		DescriptiveTags: descriptiveTags,
		Payload:         payload,
	}
}

func parseSnapshotDescriptiveTags(raw interface{}) []cafeSemanticTag {
	switch typed := raw.(type) {
	case []cafeSemanticTag:
		out := make([]cafeSemanticTag, 0, len(typed))
		for _, item := range typed {
			if item.Key == "" || item.Label == "" {
				continue
			}
			out = append(out, item)
		}
		return out
	default:
		return sanitizeCafeSemanticTags(raw, "descriptive")
	}
}

func parseAIStampToTime(raw interface{}) time.Time {
	text := strings.TrimSpace(toStringSafe(raw))
	if text == "" {
		return time.Time{}
	}
	parsed, err := time.Parse(time.RFC3339, text)
	if err != nil {
		return time.Time{}
	}
	return parsed.UTC()
}

func cloneMap(input map[string]interface{}) map[string]interface{} {
	if input == nil {
		return map[string]interface{}{}
	}
	out := make(map[string]interface{}, len(input))
	for key, value := range input {
		out[key] = value
	}
	return out
}

func (s *Service) generateAIReviewSummary(
	ctx context.Context,
	cafeID string,
	reviews []aiReviewSignal,
) (*aiSummaryResult, error) {
	cfg := s.aiSummaryCfg
	if !cfg.Enabled {
		return nil, fmt.Errorf("ai summary disabled")
	}

	promptItems, err := buildAISummaryPromptReviews(reviews, cfg)
	if err != nil {
		return nil, err
	}

	payloadRaw, err := json.Marshal(map[string]interface{}{
		"cafe_id": cafeID,
		"reviews": promptItems,
	})
	if err != nil {
		return nil, err
	}
	inputHash, err := computeAISummaryInputHash(cafeID, promptItems)
	if err != nil {
		return nil, err
	}

	systemPrompt := "Ты аналитик отзывов о кофейнях. Ответ строго JSON без пояснений."
	userPrompt := "Верни JSON: {\"summary_short\":\"...\",\"descriptive_tags\":[\"...\"]}.\n" +
		"Правила: summary_short 1-2 коротких предложения по-русски; descriptive_tags 3-6 тегов, lowercase, 1-3 слова; " +
		"только про опыт в заведении, без напитков/меню.\n" +
		"Отзывы:\n" + string(payloadRaw)

	requestBody := map[string]interface{}{
		"model": cfg.Model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"temperature":           0.2,
		"max_completion_tokens": aiSummaryCompletionTokens,
		"response_format": map[string]string{
			"type": "json_object",
		},
	}
	bodyRaw, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	callCtx := ctx
	cancel := func() {}
	if cfg.Timeout > 0 {
		callCtx, cancel = context.WithTimeout(ctx, cfg.Timeout)
	}
	defer cancel()

	req, err := http.NewRequestWithContext(callCtx, http.MethodPost, cfg.ChatCompletionsURL, bytes.NewReader(bodyRaw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.BearerToken)
	req.Header.Set("x-proxy-source", cfg.ProxySource)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("timeweb ai status=%d body=%s", resp.StatusCode, truncateText(string(respBody), 260))
	}

	type openAIChatResponse struct {
		Choices []struct {
			Message struct {
				Content interface{} `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	var parsed openAIChatResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, err
	}
	if len(parsed.Choices) == 0 {
		return nil, fmt.Errorf("timeweb ai returned empty choices")
	}

	content, err := readChatMessageContent(parsed.Choices[0].Message.Content)
	if err != nil {
		return nil, err
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, fmt.Errorf("timeweb ai returned empty content")
	}

	type summaryPayload struct {
		SummaryShort    string   `json:"summary_short"`
		DescriptiveTags []string `json:"descriptive_tags"`
	}
	var aiPayload summaryPayload
	if err := json.Unmarshal(extractFirstJSONObject(content), &aiPayload); err != nil {
		return nil, err
	}

	tags := normalizeAITagLabels(aiPayload.DescriptiveTags, cfg.MaxOutputTags)
	summary := truncateText(collapseWhitespace(aiPayload.SummaryShort), 240)
	if len(tags) == 0 {
		return nil, fmt.Errorf("timeweb ai returned no descriptive tags")
	}

	return &aiSummaryResult{
		SummaryShort: summary,
		Tags:         tags,
		UsedReviews:  len(promptItems),
		InputHash:    inputHash,
	}, nil
}

func readChatMessageContent(raw interface{}) (string, error) {
	switch value := raw.(type) {
	case string:
		return value, nil
	case []interface{}:
		parts := make([]string, 0, len(value))
		for _, item := range value {
			obj, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			if strings.TrimSpace(toStringSafe(obj["type"])) != "text" {
				continue
			}
			text := strings.TrimSpace(toStringSafe(obj["text"]))
			if text != "" {
				parts = append(parts, text)
			}
		}
		return strings.Join(parts, "\n"), nil
	default:
		return "", fmt.Errorf("unsupported chat content type")
	}
}

func extractFirstJSONObject(raw string) []byte {
	text := strings.TrimSpace(raw)
	if text == "" {
		return []byte("{}")
	}
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start < 0 || end <= start {
		return []byte(text)
	}
	return []byte(text[start : end+1])
}
