import {
  Chip,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  Button,
  useMantineTheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconMapPin, IconPlus } from "@tabler/icons-react";

import type { Amenity } from "../../../../entities/cafe/model/types";
import { AMENITY_LABELS, DISCOVERY_UI_TEXT } from "../../constants";
import {
  createDiscoveryAmenityChipLabelStyles,
  getDiscoveryGlassButtonStyles,
  discoveryGlassSelectStyles,
} from "../styles/glass";

type LocationOption = {
  id: string;
  label: string;
};

type SettingsDrawerProps = {
  opened: boolean;
  onClose: () => void;
  radiusM: number;
  onRadiusChange: (value: number) => void;
  isRadiusLocked?: boolean;
  selectedAmenities: Amenity[];
  onChangeAmenities: (next: Amenity[]) => void;
  locationLabel: string;
  locationOptions: LocationOption[];
  selectedLocationId: string;
  onSelectLocation: (id: string) => void;
  onOpenMapPicker: () => void;
  highlightLocationBlock?: boolean;
  onSuggestCafe?: () => void;
};

const RADIUS_OPTIONS = [1000, 2500, 5000, 0] as const;

export default function SettingsDrawer({
  opened,
  onClose,
  radiusM,
  onRadiusChange,
  isRadiusLocked = false,
  selectedAmenities,
  onChangeAmenities,
  locationLabel,
  locationOptions,
  selectedLocationId,
  onSelectLocation,
  onOpenMapPicker,
  highlightLocationBlock = false,
  onSuggestCafe,
}: SettingsDrawerProps) {
  const theme = useMantineTheme();
  const isCoarsePointer = useMediaQuery("(pointer: coarse)") ?? false;

  const drawerStyles = {
    content: {
      background: "var(--glass-bg)",
      backdropFilter: "blur(18px) saturate(180%)",
      WebkitBackdropFilter: "blur(18px) saturate(180%)",
      borderRadius: 0,
      height: "100dvh",
      maxHeight: "100dvh",
      border: "1px solid var(--glass-border)",
      boxShadow: "var(--shadow)",
    },
    header: {
      position: "sticky",
      top: 0,
      zIndex: 8,
      background: "color-mix(in srgb, var(--glass-bg) 88%, transparent)",
      backdropFilter: "blur(20px) saturate(170%)",
      WebkitBackdropFilter: "blur(20px) saturate(170%)",
      borderBottom: "1px solid var(--glass-border)",
    },
    body: {
      paddingTop: theme.spacing.sm,
    },
    overlay: {
      backdropFilter: "blur(10px)",
      backgroundColor: "var(--color-surface-overlay-strong)",
    },
  } as const;
  const amenityChipLabelStyles = createDiscoveryAmenityChipLabelStyles(theme.fontSizes.xs);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="100%"
      title="Настройки"
      styles={drawerStyles}
    >
      <Stack gap="md">
        <Stack
          gap="xs"
          style={
            highlightLocationBlock
              ? {
                  padding: 10,
                  borderRadius: 14,
                  border: "1px solid var(--attention-ring)",
                  boxShadow: "0 0 20px var(--attention-glow)",
                  background: "var(--color-brand-accent-soft)",
                }
              : undefined
          }
        >
          <Group justify="space-between" align="center">
            <Text>Место</Text>
            <Text size="sm" c="dimmed">
              {locationLabel}
            </Text>
          </Group>
          <Select
            data={locationOptions.map((option) => ({
              value: option.id,
              label: option.label,
            }))}
            value={selectedLocationId || null}
            placeholder="Выбрать город"
            searchable={!isCoarsePointer}
            nothingFoundMessage="Ничего не найдено"
            onChange={(value) => {
              if (!value) return;
              onSelectLocation(value);
            }}
            comboboxProps={{ withinPortal: false }}
            styles={discoveryGlassSelectStyles}
          />
          <Button
            variant="light"
            leftSection={<IconMapPin size={16} />}
            onClick={onOpenMapPicker}
            styles={getDiscoveryGlassButtonStyles(false)}
          >
            Выбрать вручную на карте
          </Button>
        </Stack>

        <Stack gap="xs">
          <Text>Контент</Text>
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={onSuggestCafe}
            styles={getDiscoveryGlassButtonStyles(false)}
          >
            Предложить кофейню
          </Button>
        </Stack>

        <Stack gap="xs">
          <Text>{DISCOVERY_UI_TEXT.filtersTitle}</Text>
          <Chip.Group
            multiple
            value={selectedAmenities}
            onChange={(v) => onChangeAmenities(v as Amenity[])}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                alignItems: "center",
              }}
            >
              {(Object.keys(AMENITY_LABELS) as Amenity[]).map((a) => {
                const isChecked = selectedAmenities.includes(a);
                return (
                  <Chip
                    key={a}
                    value={a}
                    size="xs"
                    radius="xl"
                    variant="filled"
                    icon={null}
                    styles={{
                      iconWrapper: { display: "none" },
                      label: {
                        ...amenityChipLabelStyles.base,
                        ...(isChecked ? amenityChipLabelStyles.checked : null),
                      },
                    }}
                  >
                    {AMENITY_LABELS[a]}
                  </Chip>
                );
              })}
            </div>
          </Chip.Group>
        </Stack>

        <Group justify="space-between">
          <Text>{DISCOVERY_UI_TEXT.radiusTitle}</Text>
          {isRadiusLocked && (
            <Text size="xs" c="dimmed">
              Фиксирован по городу
            </Text>
          )}
          <Group gap="xs">
            {RADIUS_OPTIONS.map((value) => (
              <Button
                key={value}
                variant="transparent"
                size="xs"
                styles={getDiscoveryGlassButtonStyles(
                  isRadiusLocked ? value === 0 : radiusM === value,
                )}
                onClick={() => {
                  if (isRadiusLocked) return;
                  onRadiusChange(value);
                }}
                disabled={isRadiusLocked}
              >
                {value === 0
                  ? DISCOVERY_UI_TEXT.radiusAll
                  : `${value / 1000}${value === 2500 ? "2.5" : ""}`.includes(
                        "2.5",
                      )
                    ? "2.5 км"
                    : `${value / 1000} км`}
              </Button>
            ))}
          </Group>
        </Group>
      </Stack>
    </Drawer>
  );
}
