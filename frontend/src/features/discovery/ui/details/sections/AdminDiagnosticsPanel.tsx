import { Badge, Button, Group, Paper, Stack, Text } from "@mantine/core";

import type { CafeRatingDiagnostics } from "../../../../../api/reviews";

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
    <Paper
      withBorder
      radius="md"
      p="sm"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <Stack gap={8}>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap={8}>
          <Text fw={600} size="sm" style={{ flex: "1 1 220px", minWidth: 0 }}>
            Admin-диагностика рейтинга
          </Text>
          <Group gap={6} wrap="wrap" justify="flex-end" style={{ marginLeft: "auto" }}>
            <Button
              variant="light"
              size="compact-xs"
              onClick={onTriggerAISummary}
              loading={aiSummaryTriggerLoading}
            >
              Суммаризировать через AI
            </Button>
            <Button variant="light" size="compact-xs" onClick={onToggleExpanded}>
              {expanded ? "Скрыть" : "Показать"}
            </Button>
          </Group>
        </Group>

        {loading && (
          <Text size="xs" c="dimmed">
            Загружаем диагностику...
          </Text>
        )}
        {error && (
          <Text size="xs" c="dimmed">
            {error}
          </Text>
        )}

        {expanded && diagnostics && (
          <Stack gap={8}>
            <Group gap={6} wrap="wrap">
              <Badge size="xs" variant="light">
                Snapshot: {diagnostics.snapshot_rating.toFixed(2)}
              </Badge>
              <Badge size="xs" variant="light">
                Derived: {diagnostics.derived_rating.toFixed(2)}
              </Badge>
              <Badge
                size="xs"
                variant="light"
                color={diagnostics.is_consistent ? "teal" : "orange"}
              >
                Δ {diagnostics.rating_delta.toFixed(3)}
              </Badge>
              <Badge size="xs" variant="light">
                Trust: {trustValue.toFixed(3)}
              </Badge>
              <Badge size="xs" variant="light">
                Base: {baseValue.toFixed(3)}
              </Badge>
              <Badge size="xs" variant="light">
                Tags source: {diagnostics.descriptive_tags_source || "rules_v1"}
              </Badge>
              <Badge
                size="xs"
                variant="light"
                color={aiSummary?.status === "ok" ? "teal" : "orange"}
              >
                AI: {aiSummary?.status || "n/a"}
              </Badge>
            </Group>

            {aiSummary && (
              <Stack gap={4}>
                {aiSummary.summary_short ? (
                  <Text size="xs" c="dimmed">
                    AI summary: {aiSummary.summary_short}
                  </Text>
                ) : null}
                {aiSummary.stale_notice ? (
                  <Text size="xs" c="orange">
                    {aiSummary.stale_notice}
                  </Text>
                ) : null}
                {Array.isArray(aiSummary.tags) && aiSummary.tags.length > 0 ? (
                  <Group gap={6} wrap="wrap">
                    {aiSummary.tags.map((tag) => (
                      <Badge key={`ai-tag-${tag}`} size="xs" variant="light">
                        {tag}
                      </Badge>
                    ))}
                  </Group>
                ) : null}
              </Stack>
            )}

            {diagnostics.warnings.length > 0 && (
              <Group gap={6} wrap="wrap">
                {diagnostics.warnings.map((warning, index) => (
                  <Badge key={`rating-warning-${index}`} size="xs" color="orange">
                    {warning}
                  </Badge>
                ))}
              </Group>
            )}

            {topReviews.length > 0 && (
              <Stack gap={6}>
                <Text size="xs" fw={600} c="dimmed">
                  Топ отзывов по влиянию
                </Text>
                {topReviews.map((review) => (
                  <Paper
                    key={review.review_id}
                    withBorder
                    radius="sm"
                    p="xs"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <Group justify="space-between" align="center" gap={8}>
                      <Text size="xs" fw={600} lineClamp={1}>
                        {review.author_name}
                      </Text>
                      <Group gap={4}>
                        <Badge size="xs" variant="light">
                          Helpful {review.helpful_score.toFixed(1)}
                        </Badge>
                        <Badge size="xs" variant="light">
                          Q {review.quality_score.toFixed(0)}
                        </Badge>
                      </Group>
                    </Group>
                    <Text
                      size="xs"
                      c="dimmed"
                      mt={4}
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                      }}
                      lineClamp={2}
                    >
                      {review.summary_excerpt}
                    </Text>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
