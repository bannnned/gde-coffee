import { Button, Paper, Select, Stack, Text } from "@mantine/core";

type LocationOption = {
  id: string;
  label: string;
};

type DiscoveryLocationChoiceHeaderProps = {
  locationOptions: LocationOption[];
  selectedLocationId: string;
  onLocateMe: () => void;
  onStartManualPick: () => void;
  onSelectLocation: (id: string) => void;
};

export default function DiscoveryLocationChoiceHeader({
  locationOptions,
  selectedLocationId,
  onLocateMe,
  onStartManualPick,
  onSelectLocation,
}: DiscoveryLocationChoiceHeaderProps) {
  return (
    <Paper radius="xl" p="md" withBorder>
      <Stack gap="sm">
        <Text size="sm" fw={600}>
          Выберите, как определить точку поиска
        </Text>
        <Button
          variant="gradient"
          gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
          onClick={onLocateMe}
        >
          Включить геолокацию
        </Button>
        <Button variant="light" onClick={onStartManualPick}>
          Выбрать вручную на карте
        </Button>
        <Select
          data={locationOptions.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          value={selectedLocationId || null}
          placeholder="Или выбрать город"
          searchable
          nothingFoundMessage="Ничего не найдено"
          onChange={(value) => {
            if (!value) return;
            onSelectLocation(value);
          }}
        />
      </Stack>
    </Paper>
  );
}
