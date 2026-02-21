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
