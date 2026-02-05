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
import { useAuth } from "../../../components/AuthGate";

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
  const { logout } = useAuth();

  const drawerStyles = {
    content: {
      background:
        scheme === "dark"
          ? "rgba(26, 26, 26, 0.78)"
          : "rgba(255, 255, 240, 0.82)",
      backdropFilter: "blur(18px) saturate(180%)",
      WebkitBackdropFilter: "blur(18px) saturate(180%)",
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      border: `1px solid ${
        scheme === "dark"
          ? "rgba(255, 255, 240, 0.18)"
          : "rgba(255, 255, 240, 0.8)"
      }`,
      boxShadow:
        scheme === "dark"
          ? "0 -18px 40px rgba(0, 0, 0, 0.7)"
          : "0 -18px 40px rgba(26, 26, 26, 0.18)",
    },
    header: {
      background: "transparent",
      borderBottom: `1px solid ${
        scheme === "dark"
          ? "rgba(255, 255, 240, 0.12)"
          : "rgba(255, 255, 240, 0.6)"
      }`,
    },
    body: {
      paddingTop: theme.spacing.sm,
    },
    overlay: {
      backdropFilter: "blur(2px)",
      backgroundColor:
        scheme === "dark"
          ? "rgba(26, 26, 26, 0.45)"
          : "rgba(26, 26, 26, 0.12)",
    },
  } as const;

  const glassButtonBase = {
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(26,26,26,0.7), rgba(26,26,26,0.5))"
        : "linear-gradient(135deg, rgba(255,255,240,0.9), rgba(255,255,240,0.65))",
    border: `1px solid ${
      scheme === "dark"
        ? "rgba(255, 255, 240, 0.2)"
        : "rgba(255, 255, 240, 0.75)"
    }`,
    boxShadow:
      scheme === "dark"
        ? "0 6px 18px rgba(0, 0, 0, 0.55)"
        : "0 6px 16px rgba(26, 26, 26, 0.14)",
    backdropFilter: "blur(16px) saturate(180%)",
    WebkitBackdropFilter: "blur(16px) saturate(180%)",
    color: scheme === "dark" ? "#FFFFF0" : "#1A1A1A",
  } as const;

  const glassButtonActive = {
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(69,126,115,0.45), rgba(69,126,115,0.3))"
        : "linear-gradient(135deg, rgba(69,126,115,0.35), rgba(69,126,115,0.22))",
    border: `1px solid ${
      scheme === "dark" ? "rgba(69,126,115,0.55)" : "rgba(69,126,115,0.45)"
    }`,
    color: scheme === "dark" ? "#FFFFF0" : "#1A1A1A",
    boxShadow:
      scheme === "dark"
        ? "0 8px 20px rgba(69, 126, 115, 0.35)"
        : "0 8px 18px rgba(69, 126, 115, 0.25)",
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
      scheme === "dark"
        ? "rgba(255, 255, 240, 0.18)"
        : "rgba(26, 26, 26, 0.12)"
    }`,
    backdropFilter: "blur(18px) saturate(180%)",
    WebkitBackdropFilter: "blur(18px) saturate(180%)",
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(26,26,26,0.7), rgba(26,26,26,0.5))"
        : "linear-gradient(135deg, rgba(255,255,240,0.92), rgba(255,255,240,0.68))",
    boxShadow:
      scheme === "dark"
        ? "0 6px 18px rgba(0, 0, 0, 0.5)"
        : "0 6px 16px rgba(26, 26, 26, 0.14)",
    outline: "none",
    "&:active": {
      transform: "none",
    },
  } as const;

  const amenityChipLabelCheckedStyles = {
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(69,126,115,0.45), rgba(69,126,115,0.3))"
        : "linear-gradient(135deg, rgba(69,126,115,0.35), rgba(69,126,115,0.2))",
    borderColor:
      scheme === "dark" ? "rgba(69,126,115,0.55)" : "rgba(69,126,115,0.45)",
    boxShadow:
      scheme === "dark"
        ? "0 8px 20px rgba(69, 126, 115, 0.35)"
        : "0 8px 18px rgba(69, 126, 115, 0.25)",
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
