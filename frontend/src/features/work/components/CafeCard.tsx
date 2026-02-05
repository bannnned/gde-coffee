import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  useComputedColorScheme,
} from "@mantine/core";
import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import type { Cafe } from "../types";
import { AMENITY_LABELS, WORK_UI_TEXT } from "../constants";
import { formatDistance } from "../utils";

type CafeCardProps = {
  cafe: Cafe;
  onOpen2gis: (cafe: Cafe) => void;
  onOpenYandex: (cafe: Cafe) => void;
  onOpenDetails?: () => void;
};

export default function CafeCard({
  cafe,
  onOpen2gis,
  onOpenYandex,
  onOpenDetails,
}: CafeCardProps) {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);

  const cardStyles = {
    zIndex: 1,
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(26,26,26,0.78), rgba(26,26,26,0.6))"
        : "linear-gradient(135deg, rgba(255,255,240,0.94), rgba(255,255,240,0.72))",
    border:
      scheme === "dark"
        ? "1px solid rgba(255, 255, 240, 0.16)"
        : "1px solid rgba(26, 26, 26, 0.1)",
    boxShadow:
      scheme === "dark"
        ? "0 18px 40px rgba(0, 0, 0, 0.6), 0 8px 20px rgba(0, 0, 0, 0.45)"
        : "0 18px 40px rgba(26, 26, 26, 0.14), 0 8px 18px rgba(26, 26, 26, 0.12)",
    backdropFilter: "blur(18px) saturate(160%)",
    WebkitBackdropFilter: "blur(18px) saturate(160%)",
  } as const;

  const badgeStyles = {
    root: {
      background:
        scheme === "dark"
          ? "rgba(255, 255, 240, 0.08)"
          : "rgba(255, 255, 240, 0.7)",
      border:
        scheme === "dark"
          ? "1px solid rgba(255, 255, 240, 0.18)"
          : "1px solid rgba(26, 26, 26, 0.12)",
      color: scheme === "dark" ? "rgba(255, 255, 240, 0.95)" : "#1A1A1A",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    },
  } as const;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onOpenDetails) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest(
        'button, a, input, textarea, select, [data-no-drag="true"]',
      )
    ) {
      return;
    }
    clickStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onOpenDetails) return;
    const start = clickStartRef.current;
    clickStartRef.current = null;
    if (!start) return;
    const dx = Math.abs(event.clientX - start.x);
    const dy = Math.abs(event.clientY - start.y);
    if (dx <= 8 && dy <= 8) {
      onOpenDetails();
    }
  };

  const handlePointerCancel = () => {
    clickStartRef.current = null;
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!onOpenDetails) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenDetails();
    }
  };

  return (
    <Paper
      withBorder
      radius="lg"
      p="sm"
      style={{
        ...cardStyles,
        cursor: onOpenDetails ? "pointer" : "default",
      }}
      role={onOpenDetails ? "button" : undefined}
      tabIndex={onOpenDetails ? 0 : -1}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text fw={700} c="text" size="md" lineClamp={1} title={cafe.name}>
            {cafe.name}
          </Text>
          <Text c="dimmed" size="sm" lineClamp={1} title={cafe.address}>
            {cafe.address}
          </Text>
          <Text size="sm" mt={6}>
            {formatDistance(cafe.distance_m)} В· {WORK_UI_TEXT.workScorePrefix}{" "}
            {Math.round(cafe.work_score)}
          </Text>
          <Group
            gap={6}
            mt={8}
            wrap="nowrap"
            style={{
              overflow: "hidden",
              WebkitMaskImage: "linear-gradient(90deg, #000 85%, transparent)",
              maskImage: "linear-gradient(90deg, #000 85%, transparent)",
            }}
          >
            {cafe.amenities.map((a) => (
              <Badge key={a} variant="light" styles={badgeStyles}>
                {AMENITY_LABELS[a] ?? a}
              </Badge>
            ))}
          </Group>
        </Box>

        <Stack gap={6} miw={160} style={{ flexShrink: 0 }}>
          <Button
            size="xs"
            onClick={(event) => {
              event.stopPropagation();
              onOpen2gis(cafe);
            }}
          >
            {WORK_UI_TEXT.route2gis}
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={(event) => {
              event.stopPropagation();
              onOpenYandex(cafe);
            }}
          >
            {WORK_UI_TEXT.routeYandex}
          </Button>
        </Stack>
      </Group>
    </Paper>
  );
}
