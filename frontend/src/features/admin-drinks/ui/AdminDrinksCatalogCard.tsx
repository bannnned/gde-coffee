import { Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";

import type { AdminDrink } from "../../../api/adminDrinks";

type AdminDrinksCatalogCardProps = {
  drinks: AdminDrink[];
  loading: boolean;
  selectedDrinkID: string;
  onSelectDrink: (id: string) => void;
  onToggleActive: (drink: AdminDrink, nextActive: boolean) => void;
};

export default function AdminDrinksCatalogCard({
  drinks,
  loading,
  selectedDrinkID,
  onSelectDrink,
  onToggleActive,
}: AdminDrinksCatalogCardProps) {
  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Title order={4}>Каталог</Title>
        {loading && <Text c="dimmed">Загрузка списка...</Text>}
        {!loading && drinks.length === 0 && <Text c="dimmed">Ничего не найдено.</Text>}
        {drinks.map((item) => (
          <Paper
            key={item.id}
            withBorder
            radius="md"
            p="sm"
            style={{
              borderColor: item.id === selectedDrinkID ? "var(--color-brand-accent)" : undefined,
            }}
          >
            <Stack gap={6}>
              <Group justify="space-between" align="center">
                <Group gap={8}>
                  <Text fw={600}>{item.name}</Text>
                  <Badge variant="light">{item.id}</Badge>
                  {!item.is_active && <Badge color="gray">hidden</Badge>}
                </Group>
                <Group gap={8}>
                  <Button variant="light" size="xs" onClick={() => onSelectDrink(item.id)}>
                    Редактировать
                  </Button>
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => onToggleActive(item, !item.is_active)}
                  >
                    {item.is_active ? "Скрыть" : "Показать"}
                  </Button>
                </Group>
              </Group>
              {item.aliases.length > 0 && (
                <Text size="xs" c="dimmed">
                  Алиасы: {item.aliases.join(", ")}
                </Text>
              )}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}
