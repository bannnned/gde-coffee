package reviews

import (
	"context"
	"time"
)

func (s *Service) GetVersioningStatus(ctx context.Context) map[string]interface{} {
	payload := s.versioningSnapshot()

	aiSummary := map[string]interface{}{
		"enabled":              s.aiSummaryCfg.Enabled,
		"model":                s.aiSummaryCfg.Model,
		"prompt_version":       s.aiSummaryCfg.PromptVersion,
		"max_input_reviews":    s.aiSummaryCfg.MaxInputReviews,
		"max_output_tags":      s.aiSummaryCfg.MaxOutputTags,
		"min_reviews":          s.aiSummaryCfg.MinReviews,
		"budget_guard_enabled": s.aiSummaryCfg.BudgetGuardEnabled,
		"daily_token_budget":   maxInt(0, s.aiSummaryCfg.DailyTokenBudget),
	}
	if s.aiSummaryCfg.BudgetGuardEnabled && s.aiSummaryCfg.DailyTokenBudget > 0 {
		usedTokens, err := s.loadAISummaryDailyTokenUsage(ctx, time.Now().UTC())
		if err == nil {
			limit := maxInt(0, s.aiSummaryCfg.DailyTokenBudget)
			aiSummary["daily_token_usage"] = usedTokens
			aiSummary["daily_token_remaining"] = maxInt(0, limit-usedTokens)
		}
	}
	payload["ai_summary"] = aiSummary
	return payload
}
