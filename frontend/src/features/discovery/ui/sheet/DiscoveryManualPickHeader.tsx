import { Paper, Stack, Text } from "@mantine/core";

export default function DiscoveryManualPickHeader() {
  return (
    <Paper radius="xl" p="md" withBorder>
      <Stack gap={4}>
        <Text size="sm" fw={600}>
          Выбор точки на карте
        </Text>
        <Text size="sm" c="dimmed">
          Передвигайте карту. Точка фиксируется по пину в центре открытой области.
        </Text>
      </Stack>
    </Paper>
  );
}
