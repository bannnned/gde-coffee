import {
  Button,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  useComputedColorScheme,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconCoffee,
  IconMapPinOff,
} from "@tabler/icons-react";
import type { MutableRefObject } from "react";

import type { Cafe } from "../types";
import { WORK_UI_TEXT } from "../constants";
import { formatDistance } from "../utils";

type EmptyState = "no-results" | "no-geo" | "error";

type CafeListProps = {
  cafes: Cafe[];
  isLoading: boolean;
  isError: boolean;
  emptyState: EmptyState;
  selectedCafeId: string | null;
  onSelectCafe: (id: string) => void;
  itemRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  onResetFilters: () => void;
  onRetry: () => void;
  onLocate: () => void;
};

export default function CafeList({
  cafes,
  isLoading,
  isError,
  emptyState,
  selectedCafeId,
  onSelectCafe,
  itemRefs,
  onResetFilters,
  onRetry,
  onLocate,
}: CafeListProps) {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

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
            icon: IconCoffee,
            title: WORK_UI_TEXT.emptyTitle,
            subtitle: WORK_UI_TEXT.emptySubtitle,
            actionLabel: WORK_UI_TEXT.resetFilters,
            onAction: onResetFilters,
          };

  const emptyCardStyles = {
    border:
      scheme === "dark"
        ? "1px solid rgba(148, 163, 184, 0.18)"
        : "1px solid rgba(15, 23, 42, 0.08)",
  } as const;

  const emptyIconStyles = {
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(59,130,246,0.35), rgba(14,116,144,0.45))"
        : "linear-gradient(135deg, rgba(59,130,246,0.22), rgba(56,189,248,0.25))",
    color: scheme === "dark" ? "rgba(248, 250, 252, 0.95)" : "#1f2937",
    boxShadow:
      scheme === "dark"
        ? "0 10px 20px rgba(2, 6, 23, 0.45)"
        : "0 10px 20px rgba(15, 23, 42, 0.14)",
  } as const;

  const EmptyIcon = emptyConfig.icon;

  return (
    <Stack gap="xs">
      {isLoading ? (
        <Text size="sm">{WORK_UI_TEXT.loading}</Text>
      ) : cafes.length === 0 ? (
        <Paper radius="xl" p="md" withBorder style={emptyCardStyles}>
          <Stack gap={6} align="center">
            <ThemeIcon size={48} radius={18} style={emptyIconStyles}>
              <EmptyIcon size={22} />
            </ThemeIcon>
            <Text size="sm" fw={600} ta="center">
              {emptyConfig.title}
            </Text>
            <Text size="xs" c="dimmed" ta="center">
              {emptyConfig.subtitle}
            </Text>
            <Button size="xs" variant="light" onClick={emptyConfig.onAction}>
              {emptyConfig.actionLabel}
            </Button>
          </Stack>
        </Paper>
      ) : (
        cafes.map((c) => (
          <Button
            key={c.id}
            ref={(el) => {
              itemRefs.current[c.id] = el;
            }}
            onClick={() => onSelectCafe(c.id)}
            variant={c.id === selectedCafeId ? "filled" : "default"}
            styles={{ inner: { justifyContent: "space-between" } }}
            size="sm"
            fullWidth
          >
            <span>
              {c.name}{" "}
              <span style={{ opacity: 0.7 }}>
                — {formatDistance(c.distance_m)}
              </span>
            </span>
            <span style={{ opacity: 0.8 }}>
              {WORK_UI_TEXT.workScorePrefix} {Math.round(c.work_score)}
            </span>
          </Button>
        ))
      )}
    </Stack>
  );
}
