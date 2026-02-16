import { Badge, Button, Group, Paper, Select, Stack, Text, Title } from "@mantine/core";

import type { UnknownDrinkFormat } from "../../../api/adminDrinks";
import type { UnknownStatusOption } from "../model/types";

const UNKNOWN_STATUS_OPTIONS = [
  { value: "", label: "Все" },
  { value: "new", label: "new" },
  { value: "mapped", label: "mapped" },
  { value: "ignored", label: "ignored" },
];

type AdminDrinksUnknownCardProps = {
  status: UnknownStatusOption;
  unknown: UnknownDrinkFormat[];
  loading: boolean;
  drinkOptions: { value: string; label: string }[];
  unknownMapTarget: Record<number, string>;
  onStatusChange: (value: UnknownStatusOption) => void;
  onMapTargetChange: (id: number, drinkID: string) => void;
  onMapUnknown: (item: UnknownDrinkFormat) => void;
  onIgnoreUnknown: (item: UnknownDrinkFormat) => void;
};

export default function AdminDrinksUnknownCard({
  status,
  unknown,
  loading,
  drinkOptions,
  unknownMapTarget,
  onStatusChange,
  onMapTargetChange,
  onMapUnknown,
  onIgnoreUnknown,
}: AdminDrinksUnknownCardProps) {
  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={4}>Неизвестные форматы</Title>
          <Select
            value={status}
            data={UNKNOWN_STATUS_OPTIONS}
            w={180}
            onChange={(value) => onStatusChange((value ?? "") as UnknownStatusOption)}
          />
        </Group>

        {loading && <Text c="dimmed">Загрузка форматов...</Text>}
        {!loading && unknown.length === 0 && <Text c="dimmed">Список пуст.</Text>}

        {unknown.map((item) => (
          <Paper key={item.id} withBorder radius="md" p="sm">
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Group gap={8}>
                  <Text fw={600}>{item.name}</Text>
                  <Badge variant="light">mentions: {item.mentions_count}</Badge>
                  <Badge color={item.status === "new" ? "yellow" : "gray"}>{item.status}</Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  last: {new Date(item.last_seen_at).toLocaleDateString("ru-RU")}
                </Text>
              </Group>
              <Group align="end" wrap="wrap">
                <Select
                  searchable
                  w={320}
                  label="Привязать к напитку"
                  placeholder="Выберите напиток"
                  data={drinkOptions}
                  value={unknownMapTarget[item.id] ?? item.mapped_drink_id ?? ""}
                  onChange={(value) => onMapTargetChange(item.id, value ?? "")}
                />
                <Button onClick={() => onMapUnknown(item)} disabled={item.status === "mapped"}>
                  Map + alias
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
                  onClick={() => onIgnoreUnknown(item)}
                  disabled={item.status === "ignored"}
                >
                  Ignore
                </Button>
              </Group>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}
