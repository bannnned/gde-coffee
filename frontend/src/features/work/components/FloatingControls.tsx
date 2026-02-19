import { ActionIcon, Box } from "@mantine/core";

import { WORK_ICONS } from "../constants";

type FloatingControlsProps = {
  onLocate: () => void;
  isLocating?: boolean;
};

export default function FloatingControls({
  onLocate,
  isLocating = false,
}: FloatingControlsProps) {
  return (
    <Box
      pos="absolute"
      style={{
        right: 12,
        bottom: "calc(var(--sheet-height) + 12px)",
        zIndex: 8,
      }}
    >
      <ActionIcon
        size={42}
        variant="transparent"
        className="glass-action glass-action--square"
        aria-label="Найти меня"
        onClick={onLocate}
        loading={isLocating}
        disabled={isLocating}
      >
        <WORK_ICONS.locate size={18} />
      </ActionIcon>
    </Box>
  );
}
