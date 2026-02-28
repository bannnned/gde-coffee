import { Badge, Button, Group, Paper, Select, Stack, Text, Title } from "../../admin/ui";

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
    <Paper withBorder style={{ borderRadius: 16, padding: 16 }}>
      <Stack style={{ gap: 12 }}>
        <Group justify="space-between">
          <Title order={4}>Неизвестные форматы</Title>
          <Select
            value={status}
            data={UNKNOWN_STATUS_OPTIONS}
            style={{ width: 180 }}
            onChange={(value) => onStatusChange((value ?? "") as UnknownStatusOption)}
          />
        </Group>

        {loading && <Text style={{ color: "var(--muted)" }}>Загрузка форматов...</Text>}
        {!loading && unknown.length === 0 && <Text style={{ color: "var(--muted)" }}>Список пуст.</Text>}

        {unknown.map((item) => (
          <Paper key={item.id} withBorder style={{ borderRadius: 12, padding: 12 }}>
            <Stack style={{ gap: 8 }}>
              <Group justify="space-between" align="center">
                <Group style={{ gap: 8 }}>
                  <Text style={{ fontWeight: 600 }}>{item.name}</Text>
                  <Badge variant="secondary">mentions: {item.mentions_count}</Badge>
                  <Badge color={item.status === "new" ? "yellow" : "gray"}>{item.status}</Badge>
                </Group>
                <Text style={{ fontSize: 12, color: "var(--muted)" }}>
                  last: {new Date(item.last_seen_at).toLocaleDateString("ru-RU")}
                </Text>
              </Group>
              <Group align="end" wrap="wrap">
                <Select
                  searchable
                  style={{ width: 320 }}
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
                  variant="ghost"
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
