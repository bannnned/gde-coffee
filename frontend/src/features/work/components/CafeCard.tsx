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

import type { Cafe } from "../types";
import { AMENITY_LABELS, WORK_UI_TEXT } from "../constants";
import { formatDistance } from "../utils";

type CafeCardProps = {
  cafe: Cafe;
  onOpen2gis: (cafe: Cafe) => void;
  onOpenYandex: (cafe: Cafe) => void;
};

export default function CafeCard({
  cafe,
  onOpen2gis,
  onOpenYandex,
}: CafeCardProps) {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  const cardStyles = {
    zIndex: 1,
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(15,23,42,0.72), rgba(2,6,23,0.62))"
        : "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(255,255,255,0.68))",
    border:
      scheme === "dark"
        ? "1px solid rgba(148, 163, 184, 0.2)"
        : "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow:
      scheme === "dark"
        ? "0 18px 40px rgba(2, 6, 23, 0.5), 0 8px 20px rgba(2, 6, 23, 0.35)"
        : "0 18px 40px rgba(15, 23, 42, 0.12), 0 8px 18px rgba(15, 23, 42, 0.1)",
    backdropFilter: "blur(18px) saturate(160%)",
    WebkitBackdropFilter: "blur(18px) saturate(160%)",
  } as const;

  const badgeStyles = {
    root: {
      background:
        scheme === "dark"
          ? "rgba(148, 163, 184, 0.15)"
          : "rgba(255, 255, 255, 0.6)",
      border:
        scheme === "dark"
          ? "1px solid rgba(148, 163, 184, 0.22)"
          : "1px solid rgba(15, 23, 42, 0.08)",
      color: scheme === "dark" ? "rgba(226, 232, 240, 0.95)" : "#1f2937",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    },
  } as const;

  return (
    <Paper withBorder radius="lg" p="sm" style={cardStyles}>
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
          <Button size="xs" onClick={() => onOpen2gis(cafe)}>
            {WORK_UI_TEXT.route2gis}
          </Button>
          <Button size="xs" variant="light" onClick={() => onOpenYandex(cafe)}>
            {WORK_UI_TEXT.routeYandex}
          </Button>
        </Stack>
      </Group>
    </Paper>
  );
}
