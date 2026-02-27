import { Badge, Group, Paper, Stack, Text } from "@mantine/core";

import type {
  CafeRatingBestReview,
  CafeRatingDiagnostics,
} from "../../../../../api/reviews";
import AdminDiagnosticsPanel from "./AdminDiagnosticsPanel";

type RatingPanelProps = {
  ratingLabel: string;
  ratingIsPreliminary?: boolean;
  ratingReviews: number;
  verifiedSharePercent: number;
  showVerifiedSharePercent?: boolean;
  onOpenReviews?: () => void;
  ratingLoading: boolean;
  ratingError: string | null;
  bestReview: CafeRatingBestReview | null;
  canViewAdminDiagnostics: boolean;
  ratingDiagnostics: CafeRatingDiagnostics | null;
  ratingDiagnosticsLoading: boolean;
  ratingDiagnosticsError: string | null;
  ratingDiagnosticsExpanded: boolean;
  onToggleDiagnosticsExpanded: () => void;
  diagnosticsTrust: number;
  diagnosticsBase: number;
  diagnosticsTopReviews: CafeRatingDiagnostics["reviews"];
  aiSummaryTriggerLoading: boolean;
  onTriggerAISummary: () => void;
};

export default function RatingPanel({
  ratingLabel,
  ratingIsPreliminary = false,
  ratingReviews,
  verifiedSharePercent,
  showVerifiedSharePercent = false,
  onOpenReviews,
  ratingLoading,
  ratingError,
  bestReview,
  canViewAdminDiagnostics,
  ratingDiagnostics,
  ratingDiagnosticsLoading,
  ratingDiagnosticsError,
  ratingDiagnosticsExpanded,
  onToggleDiagnosticsExpanded,
  diagnosticsTrust,
  diagnosticsBase,
  diagnosticsTopReviews,
  aiSummaryTriggerLoading,
  onTriggerAISummary,
}: RatingPanelProps) {
  const statChipStyles = {
    root: {
      borderRadius: 999,
      minHeight: 30,
      paddingInline: 12,
      border: "1px solid color-mix(in srgb, var(--accent) 34%, var(--glass-border))",
      background:
        "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 56%, var(--surface)), color-mix(in srgb, var(--glass-grad-1) 90%, var(--surface)))",
      color: "var(--cafe-hero-emphasis-color)",
      fontWeight: 700,
      letterSpacing: "0.02em",
      boxShadow:
        "0 8px 18px color-mix(in srgb, var(--color-brand-accent-soft) 44%, transparent)",
      backdropFilter: "blur(8px) saturate(130%)",
      WebkitBackdropFilter: "blur(8px) saturate(130%)",
    },
    label: {
      lineHeight: 1.2,
    },
  } as const;

  const metaChipStyles = {
    root: {
      borderRadius: 999,
      minHeight: 24,
      paddingInline: 10,
      border: "1px solid color-mix(in srgb, var(--accent) 26%, var(--glass-border))",
      background:
        "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 48%, var(--surface)), color-mix(in srgb, var(--glass-grad-1) 84%, var(--surface)))",
      color: "var(--cafe-hero-emphasis-color)",
      fontWeight: 700,
      letterSpacing: "0.015em",
      boxShadow:
        "0 6px 14px color-mix(in srgb, var(--color-brand-accent-soft) 34%, transparent)",
      backdropFilter: "blur(6px) saturate(125%)",
      WebkitBackdropFilter: "blur(6px) saturate(125%)",
    },
  } as const;

  return (
    <>
      <Group gap={6} wrap="wrap">
        <Badge styles={statChipStyles}>Рейтинг: {ratingLabel}</Badge>
        <Badge
          styles={statChipStyles}
          component={onOpenReviews ? "button" : "span"}
          onClick={onOpenReviews}
          style={{
            cursor: onOpenReviews ? "pointer" : "default",
          }}
          aria-label="Перейти к отзывам"
          title={onOpenReviews ? "Открыть раздел отзывов" : undefined}
        >
          Отзывы: {ratingReviews}
        </Badge>
        {showVerifiedSharePercent && (
          <Badge styles={statChipStyles}>Визиты: {verifiedSharePercent}%</Badge>
        )}
      </Group>
      {ratingLoading && (
        <Text size="xs" c="dimmed">
          Обновляем рейтинг...
        </Text>
      )}
      {ratingError && (
        <Text size="xs" c="dimmed">
          {ratingError}
        </Text>
      )}
      {ratingIsPreliminary && ratingReviews > 0 && (
        <Text size="xs" c="dimmed">
          Предварительный рейтинг: до 5 отзывов показываем среднюю оценку по звёздам.
        </Text>
      )}
      {canViewAdminDiagnostics && (
        <AdminDiagnosticsPanel
          diagnostics={ratingDiagnostics}
          loading={ratingDiagnosticsLoading}
          error={ratingDiagnosticsError}
          expanded={ratingDiagnosticsExpanded}
          onToggleExpanded={onToggleDiagnosticsExpanded}
          trustValue={diagnosticsTrust}
          baseValue={diagnosticsBase}
          topReviews={diagnosticsTopReviews}
          onTriggerAISummary={onTriggerAISummary}
          aiSummaryTriggerLoading={aiSummaryTriggerLoading}
        />
      )}
      {bestReview && bestReview.id && (
        <Paper
          withBorder
          radius="md"
          p="sm"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <Stack gap={4}>
            <Group justify="space-between" align="center">
              <Text fw={600} size="sm">
                Лучший отзыв
              </Text>
              <Badge size="xs" styles={metaChipStyles}>
                Полезность: {bestReview.helpful_score.toFixed(1)}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {bestReview.author_name}
            </Text>
            <Text
              size="sm"
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
              lineClamp={3}
            >
              {bestReview.summary}
            </Text>
          </Stack>
        </Paper>
      )}
    </>
  );
}
