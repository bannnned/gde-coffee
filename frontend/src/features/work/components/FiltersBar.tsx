import {
  ActionIcon,
  Badge,
  Box,
  Chip,
  Group,
  Title,
  useComputedColorScheme,
  useMantineTheme,
} from "@mantine/core";

import { ColorSchemeToggle } from "../../../components/ColorSchemeToggle";
import type { Amenity } from "../types";
import { AMENITY_LABELS, WORK_ICONS, WORK_UI_TEXT } from "../constants";
import classes from "./FiltersBar.module.css";

type FiltersBarProps = {
  selectedAmenities: Amenity[];
  onChangeAmenities: (next: Amenity[]) => void;
  onOpenSettings: () => void;
  showFetchingBadge: boolean;
};

export default function FiltersBar({
  selectedAmenities,
  onChangeAmenities,
  onOpenSettings,
  showFetchingBadge,
}: FiltersBarProps) {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const theme = useMantineTheme();

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
      scheme === "dark"
        ? "rgba(125,211,252,0.45)"
        : "rgba(59,130,246,0.35)",
    boxShadow:
      scheme === "dark"
        ? "0 8px 20px rgba(2, 6, 23, 0.5)"
        : "0 8px 18px rgba(30, 64, 175, 0.22)",
    transform: "none",
  } as const;

  return (
    <Box
      pos="absolute"
      top={0}
      left={0}
      right={0}
      p="sm"
      className={classes.root}
      data-ui="filters-bar"
    >
      <Group justify="space-between" className={classes.header}>
        <Title order={4} className={classes.logo} style={{ margin: 0 }}>
          {WORK_UI_TEXT.title}
        </Title>

        <Group gap="xs">
          <ActionIcon
            variant="transparent"
            size={42}
            className="glass-action glass-action--square"
            aria-label={WORK_UI_TEXT.settingsAria}
            onClick={onOpenSettings}
          >
            <WORK_ICONS.settings size={18} />
          </ActionIcon>

          <ColorSchemeToggle />
        </Group>
      </Group>

      <Group mt="xs" gap="xs" wrap="wrap" className={classes.chipsRow}>
        <Chip.Group
          multiple
          value={selectedAmenities}
          onChange={(v) => onChangeAmenities(v as Amenity[])}
        >
          {(Object.keys(AMENITY_LABELS) as Amenity[]).map((a) => {
            const isChecked = selectedAmenities.includes(a);
            return (
              <Chip
                className="main-filters"
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
        </Chip.Group>

        {showFetchingBadge && (
          <Badge
            variant="filled"
            styles={{
              root: {
                backdropFilter: "blur(8px)",
                background: "rgba(0,0,0,0.65)",
              },
            }}
          >
            {WORK_UI_TEXT.fetching}
          </Badge>
        )}
      </Group>
    </Box>
  );
}
