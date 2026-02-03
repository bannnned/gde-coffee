import { Button, Drawer, Group, Stack, Text } from "@mantine/core";

import type { SortBy } from "../types";
import { WORK_UI_TEXT } from "../constants";

type SettingsDrawerProps = {
  opened: boolean;
  onClose: () => void;
  radiusM: number;
  onRadiusChange: (value: number) => void;
  sortBy: SortBy;
  onSortChange: (value: SortBy) => void;
};

const RADIUS_OPTIONS = [1000, 2500, 5000, 0] as const;

export default function SettingsDrawer({
  opened,
  onClose,
  radiusM,
  onRadiusChange,
  sortBy,
  onSortChange,
}: SettingsDrawerProps) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="sm"
      title={WORK_UI_TEXT.settingsAria}
    >
      <Stack gap="md">
        <Group justify="space-between">
          <Text>{WORK_UI_TEXT.radiusTitle}</Text>
          <Group gap="xs">
            {RADIUS_OPTIONS.map((value) => (
              <Button
                key={value}
                variant={radiusM === value ? "filled" : "light"}
                size="xs"
                onClick={() => onRadiusChange(value)}
              >
                {value === 0
                  ? WORK_UI_TEXT.radiusAll
                  : `${value / 1000}${value === 2500 ? "2.5" : ""}`.includes(
                        "2.5",
                      )
                    ? "2.5 км"
                    : `${value / 1000} км`}
              </Button>
            ))}
          </Group>
        </Group>

        <Group justify="space-between">
          <Text>{WORK_UI_TEXT.sortTitle}</Text>
          <Group gap="xs">
            <Button
              size="xs"
              variant={sortBy === "work" ? "filled" : "light"}
              onClick={() => onSortChange("work")}
            >
              {WORK_UI_TEXT.sortWork}
            </Button>
            <Button
              size="xs"
              variant={sortBy === "distance" ? "filled" : "light"}
              onClick={() => onSortChange("distance")}
            >
              {WORK_UI_TEXT.sortDistance}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Drawer>
  );
}
