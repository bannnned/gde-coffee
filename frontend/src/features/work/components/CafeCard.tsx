import { Badge, Box, Button, Group, Paper, Stack, Text } from "@mantine/core";

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
  return (
    <Paper withBorder radius="md" p="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text fw={700} c="text">
            {cafe.name}
          </Text>
          <Text c="dimmed" size="sm">
            {cafe.address}
          </Text>
          <Text size="sm" mt={4}>
            {formatDistance(cafe.distance_m)} · {WORK_UI_TEXT.workScorePrefix}{" "}
            {Math.round(cafe.work_score)}
          </Text>
          <Group gap={6} mt={6} wrap="wrap">
            {cafe.amenities.map((a) => (
              <Badge key={a} variant="light">
                {AMENITY_LABELS[a] ?? a}
              </Badge>
            ))}
          </Group>
        </Box>

        <Stack gap={6} miw={160}>
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
