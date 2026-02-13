import { ActionIcon, Box } from "@mantine/core";

import { WORK_ICONS, WORK_UI_TEXT } from "../constants";
import classes from "./FloatingControls.module.css";

type FloatingControlsProps = {
  onLocate: () => void;
  isLocating?: boolean;
  highlight?: boolean;
};

export default function FloatingControls({
  onLocate,
  isLocating,
  highlight = false,
}: FloatingControlsProps) {
  return (
    <Box pos="absolute" className={`floating-controls ${classes.wrapper}`}>
      <ActionIcon
        size={42}
        variant="transparent"
        className={`glass-action glass-action--square ${
          highlight ? classes.attentionButton : ""
        }`}
        aria-label={WORK_UI_TEXT.locateAria}
        onClick={onLocate}
        loading={isLocating}
        disabled={isLocating}
        styles={{
          loader: {
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
          icon: {
            opacity: isLocating ? 0 : 1,
          },
        }}
      >
        <WORK_ICONS.locate size={18} />
      </ActionIcon>
    </Box>
  );
}
