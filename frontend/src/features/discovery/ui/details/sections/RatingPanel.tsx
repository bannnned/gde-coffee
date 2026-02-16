import { Badge, Group, Paper, Stack, Text } from "@mantine/core";

import type {
  CafeRatingBestReview,
  CafeRatingDiagnostics,
} from "../../../../../api/reviews";
import AdminDiagnosticsPanel from "./AdminDiagnosticsPanel";

type RatingPanelProps = {
  ratingLabel: string;
  ratingReviews: number;
  verifiedSharePercent: number;
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
};

export default function RatingPanel({
  ratingLabel,
  ratingReviews,
  verifiedSharePercent,
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
}: RatingPanelProps) {
  return (
    <>
      <Group gap={6} wrap="wrap">
        <Badge variant="light">Рейтинг: {ratingLabel}</Badge>
        <Badge variant="light">Отзывы: {ratingReviews}</Badge>
        <Badge variant="light">Визиты: {verifiedSharePercent}%</Badge>
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
              <Badge size="xs" variant="light">
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
