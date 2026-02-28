import { Button as UIButton } from "../../../components/ui";
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
    <div
      style={{
        position: "absolute",
        right: 12,
        bottom: "calc(var(--sheet-height) + 12px)",
        zIndex: 8,
      }}
    >
      <UIButton
        type="button"
        size="icon"
        variant="ghost"
        className="glass-action glass-action--square"
        aria-label="Найти меня"
        onClick={onLocate}
        disabled={isLocating}
      >
        {isLocating ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <WORK_ICONS.locate size={18} />
        )}
      </UIButton>
    </div>
  );
}
