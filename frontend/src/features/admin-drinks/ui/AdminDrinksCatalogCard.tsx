import { Badge, Button, Group, Paper, Stack } from "../../admin/ui";

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
    <Paper style={{ border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
      <Stack style={{ gap: 12 }}>
        <h4 className="m-0 text-xl font-bold text-text">Каталог</h4>
        {loading && <p style={{ margin: 0,  color: "var(--muted)" }}>Загрузка списка...</p>}
        {!loading && drinks.length === 0 && <p style={{ margin: 0,  color: "var(--muted)" }}>Ничего не найдено.</p>}
        {drinks.map((item) => (
          <Paper
            key={item.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 12,
              borderColor: item.id === selectedDrinkID ? "var(--color-brand-accent)" : undefined,
            }}
          >
            <Stack style={{ gap: 6 }}>
              <Group justify="space-between" align="center">
                <Group style={{ gap: 8 }}>
                  <p style={{ margin: 0,  fontWeight: 600 }}>{item.name}</p>
                  <Badge variant="secondary">{item.id}</Badge>
                  {!item.is_active && <Badge variant="secondary" color="gray">hidden</Badge>}
                </Group>
                <Group style={{ gap: 8 }}>
                  <Button variant="secondary" size="sm" onClick={() => onSelectDrink(item.id)}>
                    Редактировать
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleActive(item, !item.is_active)}
                  >
                    {item.is_active ? "Скрыть" : "Показать"}
                  </Button>
                </Group>
              </Group>
              {item.aliases.length > 0 && (
                <p style={{ margin: 0,  fontSize: 12, color: "var(--muted)" }}>
                  Алиасы: {item.aliases.join(", ")}
                </p>
              )}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}
