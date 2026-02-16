import { Button, Paper, Stack, Switch, TextInput, Textarea, Title } from "@mantine/core";

import type { DrinkEditorState } from "../model/types";

type AdminDrinksEditCardProps = {
  drinkID: string;
  state: DrinkEditorState | null;
  loading: boolean;
  onChange: (patch: Partial<DrinkEditorState>) => void;
  onSave: () => void;
};

export default function AdminDrinksEditCard({
  drinkID,
  state,
  loading,
  onChange,
  onSave,
}: AdminDrinksEditCardProps) {
  if (!state) return null;

  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Title order={4}>Редактирование: {drinkID}</Title>
        <TextInput
          label="Название"
          value={state.name}
          onChange={(event) => onChange({ name: event.currentTarget.value })}
        />
        <TextInput
          label="Алиасы"
          description="Через запятую"
          value={state.aliases}
          onChange={(event) => onChange({ aliases: event.currentTarget.value })}
        />
        <TextInput
          label="Категория"
          value={state.category}
          onChange={(event) => onChange({ category: event.currentTarget.value })}
        />
        <TextInput
          label="Популярность"
          value={state.popularityRank}
          onChange={(event) => onChange({ popularityRank: event.currentTarget.value })}
        />
        <Textarea
          label="Короткое описание"
          minRows={2}
          value={state.description}
          onChange={(event) => onChange({ description: event.currentTarget.value })}
        />
        <Switch
          checked={state.isActive}
          onChange={(event) => onChange({ isActive: event.currentTarget.checked })}
          label="Активный"
        />
        <Button loading={loading} onClick={onSave}>
          Сохранить
        </Button>
      </Stack>
    </Paper>
  );
}
