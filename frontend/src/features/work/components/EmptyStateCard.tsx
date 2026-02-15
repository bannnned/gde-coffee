import {
  Button,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconMapPinOff,
} from "@tabler/icons-react";

import { WORK_UI_TEXT } from "../constants";

type EmptyState = "no-results" | "no-geo" | "error";

type EmptyStateCardProps = {
  emptyState: EmptyState;
  isError: boolean;
  isLocating?: boolean;
  onResetFilters: () => void;
  onRetry: () => void;
  onLocate: () => void;
};

export default function EmptyStateCard({
  emptyState,
  isError,
  isLocating,
  onResetFilters,
  onRetry,
  onLocate,
}: EmptyStateCardProps) {
  const emptyConfig =
    isError || emptyState === "error"
      ? {
          icon: IconAlertCircle,
          title: WORK_UI_TEXT.emptyErrorTitle,
          subtitle: WORK_UI_TEXT.emptyErrorSubtitle,
          actionLabel: WORK_UI_TEXT.retry,
          onAction: onRetry,
        }
        : emptyState === "no-geo"
        ? {
            icon: IconMapPinOff,
            title: WORK_UI_TEXT.emptyNoGeoTitle,
            subtitle: WORK_UI_TEXT.emptyNoGeoSubtitle,
            actionLabel: WORK_UI_TEXT.locate,
            onAction: onLocate,
          }
        : {
            icon: null,
            title: WORK_UI_TEXT.emptyTitle,
            subtitle: WORK_UI_TEXT.emptySubtitle,
            actionLabel: WORK_UI_TEXT.resetFilters,
            onAction: onResetFilters,
          };

  const emptyCardStyles = {
    border: "1px solid var(--border)",
  } as const;

  const emptyIconStyles = {
    background:
      "linear-gradient(135deg, var(--color-brand-accent-soft), var(--surface))",
    color: "var(--text)",
    boxShadow: "var(--shadow)",
  } as const;

  const compactNoResults = emptyState === "no-results" && !isError;
  const EmptyIcon = emptyConfig.icon;

  return (
    <Paper
      radius="xl"
      p={compactNoResults ? "sm" : "md"}
      withBorder
      style={emptyCardStyles}
    >
      <Stack gap={compactNoResults ? 4 : 6} align="center">
        {EmptyIcon && (
          <ThemeIcon size={48} radius={18} style={emptyIconStyles}>
            <EmptyIcon size={22} />
          </ThemeIcon>
        )}
        <Text size="sm" fw={600} ta="center">
          {emptyConfig.title}
        </Text>
        <Text size="xs" c="dimmed" ta="center">
          {emptyConfig.subtitle}
        </Text>
        <Button
          size="xs"
          variant="light"
          onClick={emptyConfig.onAction}
          loading={emptyState === "no-geo" && isLocating}
          disabled={emptyState === "no-geo" && isLocating}
        >
          {emptyConfig.actionLabel}
        </Button>
      </Stack>
    </Paper>
  );
}
