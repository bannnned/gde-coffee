import { Button, ScrollArea, Stack, Text } from "@mantine/core";
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
  return (
    <ScrollArea h={180} type="auto">
      <Stack gap="xs">
        {isLoading ? (
          <Text size="sm">{WORK_UI_TEXT.loading}</Text>
        ) : cafes.length === 0 ? (
          <Stack gap={6} align="center" py="md">
            {isError || emptyState === "error" ? (
              <>
                <Text size="sm" c="dimmed" ta="center">
                  {WORK_UI_TEXT.emptyErrorTitle}
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  {WORK_UI_TEXT.emptyErrorSubtitle}
                </Text>
                <Button size="xs" variant="light" onClick={onRetry}>
                  {WORK_UI_TEXT.retry}
                </Button>
              </>
            ) : emptyState === "no-geo" ? (
              <>
                <Text size="sm" c="dimmed" ta="center">
                  {WORK_UI_TEXT.emptyNoGeoTitle}
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  {WORK_UI_TEXT.emptyNoGeoSubtitle}
                </Text>
                <Button size="xs" variant="light" onClick={onLocate}>
                  {WORK_UI_TEXT.locate}
                </Button>
              </>
            ) : (
              <>
                <Text size="sm" c="dimmed" ta="center">
                  {WORK_UI_TEXT.emptyTitle}
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  {WORK_UI_TEXT.emptySubtitle}
                </Text>
                <Button size="xs" variant="light" onClick={onResetFilters}>
                  {WORK_UI_TEXT.resetFilters}
                </Button>
              </>
            )}
          </Stack>
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
    </ScrollArea>
  );
}
