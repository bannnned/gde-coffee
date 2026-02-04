import {
  Button,
  Chip,
  Drawer,
  Group,
  Stack,
  Text,
  useComputedColorScheme,
  useMantineTheme,
} from "@mantine/core";

import type { Amenity } from "../types";
import { AMENITY_LABELS, WORK_UI_TEXT } from "../constants";

type SettingsDrawerProps = {
  opened: boolean;
  onClose: () => void;
  radiusM: number;
  onRadiusChange: (value: number) => void;
  selectedAmenities: Amenity[];
  onChangeAmenities: (next: Amenity[]) => void;
};

const RADIUS_OPTIONS = [1000, 2500, 5000, 0] as const;

export default function SettingsDrawer({
  opened,
  onClose,
  radiusM,
  onRadiusChange,
  selectedAmenities,
  onChangeAmenities,
}: SettingsDrawerProps) {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const theme = useMantineTheme();

  const drawerStyles = {
    content: {
      background:
        scheme === "dark"
          ? "rgba(10, 15, 24, 0.75)"
          : "rgba(255, 255, 255, 0.78)",
      backdropFilter: "blur(18px) saturate(180%)",
      WebkitBackdropFilter: "blur(18px) saturate(180%)",
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      border: `1px solid ${
        scheme === "dark"
          ? "rgba(148, 163, 184, 0.22)"
          : "rgba(255, 255, 255, 0.7)"
      }`,
      boxShadow:
        scheme === "dark"
          ? "0 -18px 40px rgba(2, 6, 23, 0.7)"
          : "0 -18px 40px rgba(15, 23, 42, 0.18)",
    },
    header: {
      background: "transparent",
      borderBottom: `1px solid ${
        scheme === "dark"
          ? "rgba(148, 163, 184, 0.18)"
          : "rgba(255, 255, 255, 0.55)"
      }`,
    },
    body: {
      paddingTop: theme.spacing.sm,
    },
    overlay: {
      backdropFilter: "blur(2px)",
      backgroundColor:
        scheme === "dark" ? "rgba(2, 6, 23, 0.45)" : "rgba(15, 23, 42, 0.12)",
    },
  } as const;

  const glassButtonBase = {
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(15,23,42,0.65), rgba(15,23,42,0.35))"
        : "linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.6))",
    border: `1px solid ${
      scheme === "dark"
        ? "rgba(148, 163, 184, 0.25)"
        : "rgba(255, 255, 255, 0.7)"
    }`,
    boxShadow:
      scheme === "dark"
        ? "0 6px 18px rgba(2, 6, 23, 0.55)"
        : "0 6px 16px rgba(15, 23, 42, 0.14)",
    backdropFilter: "blur(16px) saturate(180%)",
    WebkitBackdropFilter: "blur(16px) saturate(180%)",
    color: scheme === "dark" ? theme.colors.gray[0] : theme.colors.dark[7],
  } as const;

  const glassButtonActive = {
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(56,189,248,0.32), rgba(14,116,144,0.38))"
        : "linear-gradient(135deg, rgba(59,130,246,0.32), rgba(56,189,248,0.24))",
    border: `1px solid ${
      scheme === "dark" ? "rgba(125,211,252,0.45)" : "rgba(59,130,246,0.4)"
    }`,
    color: scheme === "dark" ? theme.colors.gray[0] : theme.colors.dark[7],
    boxShadow:
      scheme === "dark"
        ? "0 8px 20px rgba(2, 6, 23, 0.6)"
        : "0 8px 18px rgba(30, 64, 175, 0.24)",
  } as const;

  const glassButtonStyles = (active: boolean) => ({
    root: {
      ...(glassButtonBase as object),
      ...(active ? (glassButtonActive as object) : null),
    },
  });

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
    paddingBlock: 6,
    border: `1px solid ${
      scheme === "dark" ? "rgba(2, 6, 23, 0.7)" : theme.colors.gray[3]
    }`,
    backdropFilter: "blur(18px) saturate(180%)",
    WebkitBackdropFilter: "blur(18px) saturate(180%)",
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(15,23,42,0.55), rgba(15,23,42,0.3))"
        : "linear-gradient(135deg, rgba(255,255,255,0.82), rgba(255,255,255,0.58))",
    boxShadow:
      scheme === "dark"
        ? "0 6px 18px rgba(2, 6, 23, 0.45)"
        : "0 6px 16px rgba(15, 23, 42, 0.14)",
    outline: "none",
    "&:active": {
      transform: "none",
    },
  } as const;

  const amenityChipLabelCheckedStyles = {
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(56,189,248,0.3), rgba(14,116,144,0.35))"
        : "linear-gradient(135deg, rgba(59,130,246,0.28), rgba(56,189,248,0.22))",
    borderColor:
      scheme === "dark" ? "rgba(125,211,252,0.45)" : "rgba(59,130,246,0.35)",
    boxShadow:
      scheme === "dark"
        ? "0 8px 20px rgba(2, 6, 23, 0.5)"
        : "0 8px 18px rgba(30, 64, 175, 0.22)",
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
          <Group gap="xs">
            {RADIUS_OPTIONS.map((value) => (
              <Button
                key={value}
                variant="transparent"
                size="xs"
                styles={glassButtonStyles(radiusM === value)}
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

      </Stack>
    </Drawer>
  );
}
