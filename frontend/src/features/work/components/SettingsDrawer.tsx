import {
  Button,
  Chip,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  useMantineTheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconMapPin } from "@tabler/icons-react";

import type { Amenity } from "../types";
import { AMENITY_LABELS, WORK_UI_TEXT } from "../constants";
import { useAuth } from "../../../components/AuthGate";

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
}: SettingsDrawerProps) {
  const theme = useMantineTheme();
  const isCoarsePointer = useMediaQuery("(pointer: coarse)") ?? false;
  const { logout } = useAuth();

  const drawerStyles = {
    content: {
      background: "var(--glass-bg)",
      backdropFilter: "blur(18px) saturate(180%)",
      WebkitBackdropFilter: "blur(18px) saturate(180%)",
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      border: "1px solid var(--glass-border)",
      boxShadow: "var(--shadow)",
    },
    header: {
      background: "transparent",
      borderBottom: "1px solid var(--glass-border)",
    },
    body: {
      paddingTop: theme.spacing.sm,
    },
    overlay: {
      backdropFilter: "blur(2px)",
      backgroundColor: "var(--color-surface-overlay-soft)",
    },
  } as const;

  const glassButtonBase = {
    background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
    border: "1px solid var(--glass-border)",
    boxShadow: "var(--glass-shadow)",
    backdropFilter: "blur(16px) saturate(180%)",
    WebkitBackdropFilter: "blur(16px) saturate(180%)",
    color: "var(--text)",
  } as const;

  const glassButtonActive = {
    background: "var(--color-brand-accent-soft)",
    border: "1px solid var(--accent)",
    color: "var(--text)",
    boxShadow: "0 8px 20px var(--attention-glow)",
  } as const;

  const glassButtonStyles = (active: boolean) => ({
    root: {
      ...(glassButtonBase as object),
      ...(active ? (glassButtonActive as object) : null),
    },
  });

  const citySelectStyles = {
    input: {
      borderRadius: 12,
      border: "1px solid var(--glass-border)",
      background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
      boxShadow: "var(--glass-shadow)",
      color: "var(--text)",
      backdropFilter: "blur(16px) saturate(180%)",
      WebkitBackdropFilter: "blur(16px) saturate(180%)",
    },
    dropdown: {
      borderRadius: 12,
      border: "1px solid var(--glass-border)",
      background: "var(--card)",
      boxShadow: "var(--shadow)",
    },
  } as const;

  const amenityChipLabelBaseStyles = {
    boxSizing: "border-box",
    minWidth: 72,
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    fontWeight: 500,
    fontSize: theme.fontSizes.xs,
    lineHeight: 1,
    letterSpacing: 0,
    transform: "none",
    paddingInline: 10,
    paddingBlock: 8,
    border: "1px solid var(--border)",
    backdropFilter: "blur(18px) saturate(180%)",
    WebkitBackdropFilter: "blur(18px) saturate(180%)",
    background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
    boxShadow: "var(--glass-shadow)",
    outline: "none",
    "&:active": {
      transform: "none",
    },
  } as const;

  const amenityChipLabelCheckedStyles = {
    background: "var(--color-brand-accent-soft)",
    borderColor: "var(--accent)",
    boxShadow: "0 8px 20px var(--attention-glow)",
    transform: "none",
  } as const;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="sm"
      title={WORK_UI_TEXT.settingsAria}
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
            styles={citySelectStyles}
          />
          <Button
            variant="light"
            leftSection={<IconMapPin size={16} />}
            onClick={onOpenMapPicker}
            styles={glassButtonStyles(false)}
          >
            Выбрать вручную на карте
          </Button>
        </Stack>

        <Stack gap="xs">
          <Text>{WORK_UI_TEXT.filtersTitle}</Text>
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
                        ...amenityChipLabelBaseStyles,
                        ...(isChecked ? amenityChipLabelCheckedStyles : null),
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
          <Text>{WORK_UI_TEXT.radiusTitle}</Text>
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
                styles={glassButtonStyles(
                  isRadiusLocked ? value === 0 : radiusM === value,
                )}
                onClick={() => {
                  if (isRadiusLocked) return;
                  onRadiusChange(value);
                }}
                disabled={isRadiusLocked}
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

        <Button
          variant="light"
          onClick={async () => {
            await logout();
            onClose();
          }}
        >
          Выйти
        </Button>

      </Stack>
    </Drawer>
  );
}
