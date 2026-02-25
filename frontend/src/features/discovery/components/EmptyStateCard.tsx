import {
  ActionIcon,
  Button,
  Paper,
  Select,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconCheck,
  IconMapPinOff,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { DISCOVERY_UI_TEXT } from "../constants";

type EmptyState = "no-results" | "no-geo" | "error";

type EmptyStateCardProps = {
  emptyState: EmptyState;
  isError: boolean;
  isLocating?: boolean;
  onResetFilters: () => void;
  onRetry: () => void;
  onLocate: () => void;
  locationOptions?: Array<{ id: string; label: string }>;
  onSelectLocation?: (id: string) => void;
};

export default function EmptyStateCard({
  emptyState,
  isError,
  isLocating,
  onResetFilters,
  onRetry,
  onLocate,
  locationOptions = [],
  onSelectLocation,
}: EmptyStateCardProps) {
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);
  const emptyConfig =
    isError || emptyState === "error"
      ? {
          icon: IconAlertCircle,
          title: DISCOVERY_UI_TEXT.emptyErrorTitle,
          subtitle: DISCOVERY_UI_TEXT.emptyErrorSubtitle,
          actionLabel: DISCOVERY_UI_TEXT.retry,
          onAction: onRetry,
        }
        : emptyState === "no-geo"
        ? {
            icon: IconMapPinOff,
            title: DISCOVERY_UI_TEXT.emptyNoGeoTitle,
            subtitle: DISCOVERY_UI_TEXT.emptyNoGeoSubtitle,
            actionLabel: DISCOVERY_UI_TEXT.locate,
            onAction: onLocate,
          }
        : {
            icon: null,
            title: DISCOVERY_UI_TEXT.emptyTitle,
            subtitle: DISCOVERY_UI_TEXT.emptySubtitle,
            actionLabel: DISCOVERY_UI_TEXT.resetFilters,
            onAction: onResetFilters,
          };

  const emptyCardStyles = {
    border: "1px solid var(--glass-border)",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--glass-grad-1) 95%, transparent), color-mix(in srgb, var(--glass-grad-2) 88%, transparent))",
    boxShadow:
      "0 10px 24px color-mix(in srgb, var(--color-surface-overlay-soft) 65%, transparent)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
  } as const;

  const emptyIconStyles = {
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 84%, var(--surface)), var(--surface))",
    border: "1px solid color-mix(in srgb, var(--color-brand-accent) 34%, var(--glass-border))",
    color: "var(--color-brand-accent)",
    boxShadow:
      "0 10px 22px color-mix(in srgb, var(--color-brand-accent-soft) 36%, transparent)",
  } as const;

  const compactNoResults = emptyState === "no-results" && !isError;
  const locateMode = emptyState === "no-geo" && !isError;
  const EmptyIcon = emptyConfig.icon;
  const locationSelectData = useMemo(
    () =>
      locationOptions.map((option) => ({
        value: option.id,
        label: option.label,
      })),
    [locationOptions],
  );
  const canApplyLocation =
    emptyState === "no-geo" &&
    Boolean(pendingLocationId) &&
    Boolean(onSelectLocation);
  const actionButtonStyles = {
    root: {
      height: 36,
      paddingInline: 16,
      borderRadius: 999,
      border: locateMode
        ? "1px solid color-mix(in srgb, var(--color-brand-accent) 58%, transparent)"
        : "1px solid color-mix(in srgb, var(--color-brand-accent) 44%, var(--glass-border))",
      background: locateMode
        ? "linear-gradient(135deg, var(--color-brand-accent), var(--color-brand-accent-strong))"
        : "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 72%, var(--surface)), color-mix(in srgb, var(--color-brand-accent) 18%, var(--surface)))",
      color: locateMode ? "var(--color-on-accent)" : "var(--text)",
      boxShadow: locateMode
        ? "0 12px 24px color-mix(in srgb, var(--color-brand-accent-soft) 46%, transparent)"
        : "0 8px 18px color-mix(in srgb, var(--color-surface-overlay-soft) 48%, transparent)",
      transition:
        "transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-base) var(--ease-standard)",
    },
    label: {
      fontWeight: 650,
      letterSpacing: "0.01em",
    },
  } as const;
  const selectStyles = {
    input: {
      height: 40,
      borderRadius: 14,
      border: "1px solid var(--border)",
      background:
        "linear-gradient(135deg, color-mix(in srgb, var(--surface) 86%, transparent), color-mix(in srgb, var(--surface) 72%, transparent))",
      color: "var(--text)",
    },
    dropdown: {
      borderRadius: 14,
      border: "1px solid var(--glass-border)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, transparent), color-mix(in srgb, var(--surface) 88%, transparent))",
      boxShadow:
        "0 12px 24px color-mix(in srgb, var(--color-surface-overlay-soft) 58%, transparent)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    },
  } as const;

  return (
    <Paper
      radius="xl"
      p={compactNoResults ? "sm" : "md"}
      withBorder
      style={emptyCardStyles}
    >
      <Stack gap={compactNoResults ? 6 : 8} align="center">
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
          variant="filled"
          onClick={emptyConfig.onAction}
          loading={emptyState === "no-geo" && isLocating}
          disabled={emptyState === "no-geo" && isLocating}
          styles={actionButtonStyles}
        >
          {emptyConfig.actionLabel}
        </Button>
        {emptyState === "no-geo" && locationSelectData.length > 0 && (
          <Stack gap={6} w="100%">
            <Text size="xs" c="dimmed" ta="center">
              или выберите город
            </Text>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: canApplyLocation ? "1fr auto" : "1fr",
                alignItems: "center",
                gap: 8,
                width: "100%",
              }}
            >
              <Select
                data={locationSelectData}
                value={pendingLocationId}
                placeholder="Выбрать город"
                searchable
                nothingFoundMessage="Ничего не найдено"
                onChange={setPendingLocationId}
                styles={selectStyles}
              />
              {canApplyLocation && (
                <ActionIcon
                  size="lg"
                  variant="gradient"
                  gradient={{ from: "green.6", to: "teal.5", deg: 135 }}
                  aria-label="Подтвердить город"
                  onClick={() => {
                    if (!pendingLocationId || !onSelectLocation) return;
                    onSelectLocation(pendingLocationId);
                    setPendingLocationId(null);
                  }}
                >
                  <IconCheck size={18} />
                </ActionIcon>
              )}
            </div>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
