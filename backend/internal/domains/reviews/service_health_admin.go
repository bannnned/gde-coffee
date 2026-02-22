package reviews

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	sqlSelectAISummaryWindowStatsByStatus = `select
	status,
	count(*)::int as events_count,
	coalesce(sum(prompt_tokens), 0)::int as prompt_tokens,
	coalesce(sum(completion_tokens), 0)::int as completion_tokens,
	coalesce(sum(total_tokens), 0)::int as total_tokens
from public.ai_summary_metrics
where created_at >= $1
  and created_at < $2
group by status`

	sqlSelectAISummaryLastEvent = `select
	status,
	reason,
	model,
	used_reviews,
	prompt_tokens,
	completion_tokens,
	total_tokens,
	input_hash,
	metadata,
	created_at
from public.ai_summary_metrics
order by created_at desc
limit 1`

	sqlSelectAISummaryLastStatusAt = `select created_at
from public.ai_summary_metrics
where status = $1
order by created_at desc
limit 1`

	sqlSelectReviewsAIHealthQueues = `select
	coalesce((select count(*) from public.domain_events where status = 'pending'), 0)::int as outbox_pending,
	coalesce((select count(*) from public.domain_events where status = 'processing'), 0)::int as outbox_processing,
	coalesce((select count(*) from public.domain_events where status = 'failed'), 0)::int as outbox_failed,
	coalesce((select count(*) from public.domain_event_inbox where status = 'pending'), 0)::int as inbox_pending,
	coalesce((select count(*) from public.domain_event_inbox where status = 'processing'), 0)::int as inbox_processing,
	coalesce((select count(*) from public.domain_event_inbox where status = 'failed'), 0)::int as inbox_failed,
	coalesce((select count(*) from public.domain_event_dlq where resolved_at is null), 0)::int as dlq_open`

	sqlSelectReviewsAIHealthCoverage = `select
	coalesce((select count(*) from public.cafes), 0)::int as cafes_total,
	coalesce((select count(*) from public.cafe_rating_snapshots), 0)::int as snapshots_total,
	coalesce((select count(*) from public.cafe_rating_snapshots where computed_at >= now() - interval '24 hours'), 0)::int as snapshots_recent_24h,
	coalesce((select count(*) from public.ai_summary_metrics where status = 'ok' and created_at >= now() - interval '24 hours'), 0)::int as ai_ok_recent_24h,
	coalesce((select count(*) from public.ai_summary_metrics where status = 'ok' and created_at >= now() - interval '7 days'), 0)::int as ai_ok_recent_7d`
)

type aiHealthWindowStats struct {
	TotalEvents       int
	OkEvents          int
	ErrorEvents       int
	PromptTokens      int
	CompletionTokens  int
	TotalTokens       int
	SuccessRate       float64
	StatusEventCounts map[string]int
}

func (s *Service) GetReviewsAIHealth(ctx context.Context) (map[string]interface{}, error) {
	nowUTC := time.Now().UTC()
	last24h, err := s.loadAISummaryWindowStats(ctx, nowUTC.Add(-24*time.Hour), nowUTC)
	if err != nil {
		return nil, err
	}
	last7d, err := s.loadAISummaryWindowStats(ctx, nowUTC.Add(-7*24*time.Hour), nowUTC)
	if err != nil {
		return nil, err
	}

	lastEvent, err := s.loadAISummaryLastEvent(ctx)
	if err != nil {
		return nil, err
	}
	lastSuccessAt, err := s.loadAISummaryLastStatusAt(ctx, "ok")
	if err != nil {
		return nil, err
	}
	lastErrorAt, err := s.loadAISummaryLastErrorAt(ctx)
	if err != nil {
		return nil, err
	}

	var (
		outboxPending    int
		outboxProcessing int
		outboxFailed     int
		inboxPending     int
		inboxProcessing  int
		inboxFailed      int
		dlqOpen          int
	)
	if err := s.repository.Pool().QueryRow(ctx, sqlSelectReviewsAIHealthQueues).Scan(
		&outboxPending,
		&outboxProcessing,
		&outboxFailed,
		&inboxPending,
		&inboxProcessing,
		&inboxFailed,
		&dlqOpen,
	); err != nil {
		return nil, err
	}

	var (
		cafesTotal         int
		snapshotsTotal     int
		snapshotsRecent24h int
		aiOKRecent24h      int
		aiOKRecent7d       int
	)
	if err := s.repository.Pool().QueryRow(ctx, sqlSelectReviewsAIHealthCoverage).Scan(
		&cafesTotal,
		&snapshotsTotal,
		&snapshotsRecent24h,
		&aiOKRecent24h,
		&aiOKRecent7d,
	); err != nil {
		return nil, err
	}

	budgetDecision := decideAISummaryBudget(s.aiSummaryCfg, 0, nil, false)
	if budgetDecision.GuardEnabled {
		usedTokens, usageErr := s.loadAISummaryDailyTokenUsage(ctx, nowUTC)
		budgetDecision = decideAISummaryBudget(s.aiSummaryCfg, usedTokens, usageErr, false)
	}

	response := map[string]interface{}{
		"generated_at": nowUTC.Format(time.RFC3339),
		"ai_summary": map[string]interface{}{
			"enabled":                   s.aiSummaryCfg.Enabled,
			"model":                     s.aiSummaryCfg.Model,
			"prompt_version":            s.aiSummaryCfg.PromptVersion,
			"timeout":                   s.aiSummaryCfg.Timeout.String(),
			"max_input_reviews":         s.aiSummaryCfg.MaxInputReviews,
			"max_output_tags":           s.aiSummaryCfg.MaxOutputTags,
			"min_reviews":               s.aiSummaryCfg.MinReviews,
			"review_step":               aiSummaryReviewStep,
			"budget_guard_enabled":      budgetDecision.GuardEnabled,
			"daily_token_budget":        budgetDecision.LimitTokens,
			"daily_token_usage":         budgetDecision.UsedTokens,
			"daily_token_remaining":     budgetDecision.RemainingTokens,
			"daily_budget_blocked":      budgetDecision.Blocked,
			"daily_budget_block_reason": budgetDecision.Reason,
		},
		"windows": map[string]interface{}{
			"last_24h": aiHealthWindowToMap(last24h),
			"last_7d":  aiHealthWindowToMap(last7d),
		},
		"queues": map[string]interface{}{
			"outbox": map[string]interface{}{
				"pending":    outboxPending,
				"processing": outboxProcessing,
				"failed":     outboxFailed,
			},
			"inbox": map[string]interface{}{
				"pending":    inboxPending,
				"processing": inboxProcessing,
				"failed":     inboxFailed,
			},
			"dlq_open": dlqOpen,
		},
		"coverage": map[string]interface{}{
			"cafes_total":          cafesTotal,
			"snapshots_total":      snapshotsTotal,
			"snapshots_recent_24h": snapshotsRecent24h,
			"ai_ok_recent_24h":     aiOKRecent24h,
			"ai_ok_recent_7d":      aiOKRecent7d,
		},
		"last": map[string]interface{}{
			"event":        lastEvent,
			"ok_at":        formatTimeRFC3339(lastSuccessAt),
			"error_at":     formatTimeRFC3339(lastErrorAt),
			"event_status": toStringSafe(lastEvent["status"]),
		},
	}
	s.appendVersionMetadata(response)
	return response, nil
}

func aiHealthWindowToMap(stats aiHealthWindowStats) map[string]interface{} {
	return map[string]interface{}{
		"total_events":        stats.TotalEvents,
		"ok_events":           stats.OkEvents,
		"error_events":        stats.ErrorEvents,
		"prompt_tokens":       stats.PromptTokens,
		"completion_tokens":   stats.CompletionTokens,
		"total_tokens":        stats.TotalTokens,
		"success_rate":        roundFloat(stats.SuccessRate, 4),
		"status_event_counts": stats.StatusEventCounts,
	}
}

func (s *Service) loadAISummaryWindowStats(
	ctx context.Context,
	from time.Time,
	to time.Time,
) (aiHealthWindowStats, error) {
	stats := aiHealthWindowStats{
		StatusEventCounts: map[string]int{},
	}

	rows, err := s.repository.Pool().Query(ctx, sqlSelectAISummaryWindowStatsByStatus, from.UTC(), to.UTC())
	if err != nil {
		return stats, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			status           string
			eventsCount      int
			promptTokens     int
			completionTokens int
			totalTokens      int
		)
		if err := rows.Scan(&status, &eventsCount, &promptTokens, &completionTokens, &totalTokens); err != nil {
			return stats, err
		}
		status = strings.TrimSpace(status)
		stats.StatusEventCounts[status] = eventsCount
		stats.TotalEvents += eventsCount
		if status == "ok" {
			stats.OkEvents += eventsCount
		}
		if isAISummaryErrorStatus(status) {
			stats.ErrorEvents += eventsCount
		}
		stats.PromptTokens += maxInt(0, promptTokens)
		stats.CompletionTokens += maxInt(0, completionTokens)
		stats.TotalTokens += maxInt(0, totalTokens)
	}
	if err := rows.Err(); err != nil {
		return stats, err
	}

	if stats.TotalEvents > 0 {
		stats.SuccessRate = float64(stats.OkEvents) / float64(stats.TotalEvents)
	}
	return stats, nil
}

func isAISummaryErrorStatus(status string) bool {
	normalized := strings.TrimSpace(strings.ToLower(status))
	return normalized == "error" || normalized == "prepare_error"
}

func (s *Service) loadAISummaryLastEvent(ctx context.Context) (map[string]interface{}, error) {
	var (
		status           string
		reason           string
		model            string
		usedReviews      int
		promptTokens     int
		completionTokens int
		totalTokens      int
		inputHash        string
		metadataRaw      []byte
		createdAt        time.Time
	)
	err := s.repository.Pool().QueryRow(ctx, sqlSelectAISummaryLastEvent).Scan(
		&status,
		&reason,
		&model,
		&usedReviews,
		&promptTokens,
		&completionTokens,
		&totalTokens,
		&inputHash,
		&metadataRaw,
		&createdAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return map[string]interface{}{}, nil
		}
		return nil, err
	}
	metadata := map[string]interface{}{}
	if len(metadataRaw) > 0 {
		_ = json.Unmarshal(metadataRaw, &metadata)
	}
	return map[string]interface{}{
		"status":            status,
		"reason":            reason,
		"model":             model,
		"used_reviews":      usedReviews,
		"prompt_tokens":     promptTokens,
		"completion_tokens": completionTokens,
		"total_tokens":      totalTokens,
		"input_hash":        inputHash,
		"metadata":          metadata,
		"created_at":        createdAt.UTC().Format(time.RFC3339),
	}, nil
}

func (s *Service) loadAISummaryLastStatusAt(ctx context.Context, status string) (time.Time, error) {
	var createdAt time.Time
	err := s.repository.Pool().QueryRow(ctx, sqlSelectAISummaryLastStatusAt, strings.TrimSpace(status)).Scan(&createdAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return time.Time{}, nil
		}
		return time.Time{}, err
	}
	return createdAt.UTC(), nil
}

func (s *Service) loadAISummaryLastErrorAt(ctx context.Context) (time.Time, error) {
	var createdAt time.Time
	err := s.repository.Pool().QueryRow(
		ctx,
		`select created_at
		from public.ai_summary_metrics
		where status in ('error', 'prepare_error')
		order by created_at desc
		limit 1`,
	).Scan(&createdAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return time.Time{}, nil
		}
		return time.Time{}, err
	}
	return createdAt.UTC(), nil
}

func formatTimeRFC3339(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339)
}
