import { IconMapPinFilled } from "@tabler/icons-react";

import { Button } from "../../../../components/ui";
import classes from "./ManualPickOverlay.module.css";

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
      <div
        className={classes.pin}
        style={{
          top: `calc(50% - (var(--sheet-height, 240px) / 2) + ${pinOffsetY}px)`,
        }}
      >
        <IconMapPinFilled size={40} color="var(--color-map-cafe-marker)" stroke={1.5} />
      </div>
      <div
        className={classes.actions}
        style={{
          bottom: "calc(var(--sheet-height, 240px) + 20px)",
        }}
      >
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={classes.actionButton}
          onClick={onCancel}
        >
          Отмена
        </Button>
        <Button
          type="button"
          size="sm"
          className={`${classes.actionButton} ${classes.confirmButton}`}
          onClick={onConfirm}
          disabled={!canConfirm}
        >
          Выбрать
        </Button>
      </div>
    </>
  );
}
