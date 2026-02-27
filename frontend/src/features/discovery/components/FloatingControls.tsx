import { DISCOVERY_ICONS, DISCOVERY_UI_TEXT } from "../constants";
import classes from "./FloatingControls.module.css";

type FloatingControlsProps = {
  onLocate: () => void;
  isLocating?: boolean;
  highlight?: boolean;
  hidden?: boolean;
};

export default function FloatingControls({
  onLocate,
  isLocating,
  highlight = false,
  hidden = false,
}: FloatingControlsProps) {
  const buttonClassName = [
    "glass-action",
    "glass-action--square",
    classes.button,
    highlight ? "glass-action--active" : "",
    highlight ? classes.attentionButton : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      style={{ position: "absolute" }}
      className={`floating-controls ${classes.wrapper} ${hidden ? classes.hidden : ""}`}
    >
      <button
        type="button"
        className={buttonClassName}
        aria-label={DISCOVERY_UI_TEXT.locateAria}
        aria-busy={isLocating ? "true" : undefined}
        onClick={onLocate}
        disabled={isLocating}
      >
        <DISCOVERY_ICONS.locate size={18} style={{ opacity: isLocating ? 0 : 1 }} />
        {isLocating ? <span className={classes.spinner} aria-hidden="true" /> : null}
      </button>
    </div>
  );
}
