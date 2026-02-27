import { Badge, Button } from "../../../../../components/ui";

import type { CafeRatingDiagnostics } from "../../../../../api/reviews";
import classes from "./AdminDiagnosticsPanel.module.css";

type AdminDiagnosticsPanelProps = {
  diagnostics: CafeRatingDiagnostics | null;
  loading: boolean;
  error: string | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  trustValue: number;
  baseValue: number;
  topReviews: CafeRatingDiagnostics["reviews"];
  onTriggerAISummary: () => void;
  aiSummaryTriggerLoading: boolean;
};

export default function AdminDiagnosticsPanel({
  diagnostics,
  loading,
  error,
  expanded,
  onToggleExpanded,
  trustValue,
  baseValue,
  topReviews,
  onTriggerAISummary,
  aiSummaryTriggerLoading,
}: AdminDiagnosticsPanelProps) {
  const aiSummary = diagnostics?.ai_summary ?? null;

  return (
    <div className={classes.card}>
      <div className={classes.stack}>
        <div className={classes.headerRow}>
          <p className={classes.title}>Admin-диагностика рейтинга</p>
          <div className={classes.actionsRow}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={classes.actionButton}
              onClick={onTriggerAISummary}
              disabled={aiSummaryTriggerLoading}
              aria-busy={aiSummaryTriggerLoading ? "true" : undefined}
            >
              <span className={aiSummaryTriggerLoading ? classes.loadingHidden : ""}>
                Суммаризировать через AI
              </span>
              {aiSummaryTriggerLoading ? (
                <span className={classes.spinner} aria-hidden="true" />
              ) : null}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={classes.actionButton}
              onClick={onToggleExpanded}
            >
              {expanded ? "Скрыть" : "Показать"}
            </Button>
          </div>
        </div>

        {loading ? <p className={classes.metaText}>Загружаем диагностику...</p> : null}
        {error ? <p className={classes.metaText}>{error}</p> : null}

        {expanded && diagnostics ? (
          <div className={classes.detailsStack}>
            <div className={classes.badgesRow}>
              <Badge className={classes.badge}>Snapshot: {diagnostics.snapshot_rating.toFixed(2)}</Badge>
              <Badge className={classes.badge}>Derived: {diagnostics.derived_rating.toFixed(2)}</Badge>
              <Badge
                variant={diagnostics.is_consistent ? "success" : "warning"}
                className={classes.badge}
              >
                Δ {diagnostics.rating_delta.toFixed(3)}
              </Badge>
              <Badge className={classes.badge}>Trust: {trustValue.toFixed(3)}</Badge>
              <Badge className={classes.badge}>Base: {baseValue.toFixed(3)}</Badge>
              <Badge className={classes.badge}>
                Tags source: {diagnostics.descriptive_tags_source || "rules_v1"}
              </Badge>
              <Badge variant={aiSummary?.status === "ok" ? "success" : "warning"} className={classes.badge}>
                AI: {aiSummary?.status || "n/a"}
              </Badge>
            </div>

            {aiSummary ? (
              <div className={classes.aiStack}>
                {aiSummary.summary_short ? (
                  <p className={classes.metaText}>AI summary: {aiSummary.summary_short}</p>
                ) : null}
                {aiSummary.stale_notice ? (
                  <p className={classes.warningText}>{aiSummary.stale_notice}</p>
                ) : null}
                {Array.isArray(aiSummary.tags) && aiSummary.tags.length > 0 ? (
                  <div className={classes.badgesRow}>
                    {aiSummary.tags.map((tag) => (
                      <Badge key={`ai-tag-${tag}`} className={classes.badge}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {aiSummary.model ? <p className={classes.metaText}>Model: {aiSummary.model}</p> : null}
                {aiSummary.prompt_version ? (
                  <p className={classes.metaText}>Prompt: {aiSummary.prompt_version}</p>
                ) : null}
                {(typeof aiSummary.eligible_reviews_count === "number" ||
                  typeof aiSummary.attempted_reviews_count === "number" ||
                  aiSummary.last_attempt_reason) ? (
                  <div className={classes.badgesRow}>
                    {typeof aiSummary.eligible_reviews_count === "number" ? (
                      <Badge className={classes.badge}>Eligible: {aiSummary.eligible_reviews_count}</Badge>
                    ) : null}
                    {typeof aiSummary.attempted_reviews_count === "number" ? (
                      <Badge className={classes.badge}>Attempted: {aiSummary.attempted_reviews_count}</Badge>
                    ) : null}
                    {aiSummary.last_attempt_reason ? (
                      <Badge className={classes.badge}>Last attempt: {aiSummary.last_attempt_reason}</Badge>
                    ) : null}
                  </div>
                ) : null}
                {aiSummary.token_usage ? (
                  <div className={classes.badgesRow}>
                    <Badge className={classes.badge}>Prompt: {aiSummary.token_usage.prompt_tokens}</Badge>
                    <Badge className={classes.badge}>
                      Completion: {aiSummary.token_usage.completion_tokens}
                    </Badge>
                    <Badge className={classes.badge}>Total: {aiSummary.token_usage.total_tokens}</Badge>
                  </div>
                ) : null}
                {aiSummary.budget_guard_enabled ? (
                  <div className={classes.badgesRow}>
                    {typeof aiSummary.daily_token_budget === "number" ? (
                      <Badge className={classes.badge}>Budget/day: {aiSummary.daily_token_budget}</Badge>
                    ) : null}
                    {typeof aiSummary.daily_token_usage === "number" ? (
                      <Badge className={classes.badge}>Used today: {aiSummary.daily_token_usage}</Badge>
                    ) : null}
                    {typeof aiSummary.daily_token_remaining === "number" ? (
                      <Badge className={classes.badge}>Remaining: {aiSummary.daily_token_remaining}</Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {diagnostics.warnings.length > 0 ? (
              <div className={classes.badgesRow}>
                {diagnostics.warnings.map((warning, index) => (
                  <Badge key={`rating-warning-${index}`} variant="warning" className={classes.badge}>
                    {warning}
                  </Badge>
                ))}
              </div>
            ) : null}

            {topReviews.length > 0 ? (
              <div className={classes.topReviewsStack}>
                <p className={classes.topReviewsTitle}>Топ отзывов по влиянию</p>
                {topReviews.map((review) => (
                  <div key={review.review_id} className={classes.reviewCard}>
                    <div className={classes.reviewHeader}>
                      <p className={classes.reviewAuthor}>{review.author_name}</p>
                      <div className={classes.badgesRow}>
                        <Badge className={classes.badge}>Helpful {review.helpful_score.toFixed(1)}</Badge>
                        <Badge className={classes.badge}>Q {review.quality_score.toFixed(0)}</Badge>
                      </div>
                    </div>
                    <p className={classes.reviewExcerpt}>{review.summary_excerpt}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
