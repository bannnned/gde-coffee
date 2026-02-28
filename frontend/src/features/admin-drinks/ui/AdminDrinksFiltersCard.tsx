import { Paper, Stack, Switch, TextInput } from "../../admin/ui";

type AdminDrinksFiltersCardProps = {
  query: string;
  includeInactive: boolean;
  onQueryChange: (value: string) => void;
  onIncludeInactiveChange: (value: boolean) => void;
};

export default function AdminDrinksFiltersCard({
  query,
  includeInactive,
  onQueryChange,
  onIncludeInactiveChange,
}: AdminDrinksFiltersCardProps) {
  return (
    <Paper withBorder style={{ borderRadius: 16, padding: 16 }}>
      <Stack style={{ gap: 12 }}>
        <TextInput
          label="Поиск по справочнику"
          placeholder="например, v60 или эспрессо"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
        />
        <Switch
          checked={includeInactive}
          onChange={(event) => onIncludeInactiveChange(event.currentTarget.checked)}
          label="Показывать скрытые напитки"
        />
      </Stack>
    </Paper>
  );
}
