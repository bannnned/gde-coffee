import {
  ActionIcon,
  Box,
  useComputedColorScheme,
  useMantineTheme,
} from "@mantine/core";

import { WORK_ICONS, WORK_UI_TEXT } from "../constants";
import classes from "./FloatingControls.module.css";

type FloatingControlsProps = {
  onLocate: () => void;
};

export default function FloatingControls({ onLocate }: FloatingControlsProps) {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const theme = useMantineTheme();

  const glassControlStyles = {
    root: {
      backgroundColor:
        scheme === "dark"
          ? "rgba(16,18,22,0.60)"
          : "rgba(255,255,255,0.70)",
      border: `1px solid ${
        scheme === "dark"
          ? "rgba(255,255,255,0.12)"
          : "rgba(255,255,255,0.60)"
      }`,
      backdropFilter: "blur(14px)",
      boxShadow:
        scheme === "dark"
          ? "0 12px 28px rgba(0,0,0,0.45)"
          : "0 12px 28px rgba(20,20,20,0.12)",
      color: scheme === "dark" ? theme.colors.gray[0] : theme.colors.dark[7],
    },
  } as const;

  return (
    <Box pos="absolute" className={classes.wrapper}>
      <ActionIcon
        size="lg"
        variant="transparent"
        aria-label={WORK_UI_TEXT.locateAria}
        onClick={onLocate}
        styles={glassControlStyles}
      >
        <WORK_ICONS.locate size={18} />
      </ActionIcon>
    </Box>
  );
}
