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
      scheme === "dark" ? theme.colors.dark[4] : theme.colors.gray[3]
    }`,
    backdropFilter: "blur(20px)",
    backgroundColor:
      scheme === "dark"
        ? "rgba(0,0,0,0.30)"
        : "rgba(255,255,255,0.78)",
    boxShadow: "none",
    outline: "none",
    "&:active": {
      transform: "none",
    },
  } as const;

  const amenityChipLabelCheckedStyles = {
    backgroundColor:
      scheme === "dark"
        ? "rgba(34,139,230,0.28)"
        : "rgba(34,139,230,0.22)",
    borderColor:
      scheme === "dark"
        ? "rgba(34,139,230,0.40)"
        : "rgba(34,139,230,0.35)",
    boxShadow: "none",
    transform: "none",
  } as const;

  return (
    <Box pos="absolute" top={0} left={0} right={0} p="sm" className={classes.root}>
      <Group justify="space-between" className={classes.header}>
        <Title order={4} style={{ margin: 0 }}>
          {WORK_UI_TEXT.title}
        </Title>

        <Group gap="xs">
          <ActionIcon
            variant="filled"
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
