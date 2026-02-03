import {
  Button,
  Drawer,
  Group,
  Stack,
  Text,
  useComputedColorScheme,
  useMantineTheme,
} from "@mantine/core";

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
        scheme === "dark" ? "rgba(148, 163, 184, 0.22)" : "rgba(255, 255, 255, 0.7)"
      }`,
      boxShadow:
        scheme === "dark"
          ? "0 -18px 40px rgba(2, 6, 23, 0.7)"
          : "0 -18px 40px rgba(15, 23, 42, 0.18)",
    },
    header: {
      background: "transparent",
      borderBottom: `1px solid ${
        scheme === "dark" ? "rgba(148, 163, 184, 0.18)" : "rgba(255, 255, 255, 0.55)"
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
      scheme === "dark" ? "rgba(148, 163, 184, 0.25)" : "rgba(255, 255, 255, 0.7)"
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

        <Group justify="space-between">
          <Text>{WORK_UI_TEXT.sortTitle}</Text>
          <Group gap="xs">
            <Button
              size="xs"
              variant="transparent"
              styles={glassButtonStyles(sortBy === "work")}
              onClick={() => onSortChange("work")}
            >
              {WORK_UI_TEXT.sortWork}
            </Button>
            <Button
              size="xs"
              variant="transparent"
              styles={glassButtonStyles(sortBy === "distance")}
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
