import { Box, Button, Group } from "@mantine/core";
import { IconMapPinFilled } from "@tabler/icons-react";

type ManualPickOverlayProps = {
  pinOffsetY: number;
  canConfirm: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ManualPickOverlay({
  pinOffsetY,
  canConfirm,
  onCancel,
  onConfirm,
}: ManualPickOverlayProps) {
  return (
    <>
      <Box
        style={{
          position: "absolute",
          left: "50%",
          top: `calc(50% - (var(--sheet-height, 240px) / 2) + ${pinOffsetY}px)`,
          transform: "translate(-50%, -100%)",
          pointerEvents: "none",
          zIndex: 4,
        }}
      >
        <IconMapPinFilled size={40} color="var(--color-map-cafe-marker)" stroke={1.5} />
      </Box>
      <Group
        justify="center"
        gap="xs"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "calc(var(--sheet-height, 240px) + 20px)",
          zIndex: 4,
          pointerEvents: "none",
        }}
      >
        <Button variant="default" style={{ pointerEvents: "auto" }} onClick={onCancel}>
          Отмена
        </Button>
        <Button
          variant="gradient"
          gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
          style={{ pointerEvents: "auto" }}
          onClick={onConfirm}
          disabled={!canConfirm}
        >
          Выбрать
        </Button>
      </Group>
    </>
  );
}
