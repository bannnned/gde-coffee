import { Button, Paper, Stack, Switch, TextInput, Textarea, Title } from "../../admin/ui";

import type { DrinkEditorState } from "../model/types";

type AdminDrinksCreateCardProps = {
  state: DrinkEditorState;
  loading: boolean;
  onChange: (patch: Partial<DrinkEditorState>) => void;
  onSubmit: () => void;
};

export default function AdminDrinksCreateCard({
  state,
  loading,
  onChange,
  onSubmit,
}: AdminDrinksCreateCardProps) {
  return (
    <Paper withBorder style={{ borderRadius: 16, padding: 16 }}>
      <Stack style={{ gap: 12 }}>
        <Title order={4}>Добавить напиток</Title>
        <TextInput
          label="ID (опционально)"
          placeholder="pour-over"
          value={state.id}
          onChange={(event) => onChange({ id: event.currentTarget.value })}
        />
        <TextInput
          label="Название"
          required
          placeholder="воронка v60"
          value={state.name}
          onChange={(event) => onChange({ name: event.currentTarget.value })}
        />
        <TextInput
          label="Алиасы"
          description="Через запятую"
          placeholder="hario v60, пуровер"
          value={state.aliases}
          onChange={(event) => onChange({ aliases: event.currentTarget.value })}
        />
        <TextInput
          label="Категория"
          placeholder="manual"
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
        <Button loading={loading} onClick={onSubmit}>
          Добавить
        </Button>
      </Stack>
    </Paper>
  );
}
