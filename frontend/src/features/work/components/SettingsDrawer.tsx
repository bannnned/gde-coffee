import { Button as UIButton } from "../../../components/ui";
import useAppColorScheme from "../../../hooks/useAppColorScheme";
import { AppModal } from "../../../ui/bridge";
import type { Amenity } from "../types";
import { AMENITY_LABELS, WORK_UI_TEXT } from "../constants";

type SettingsDrawerProps = {
  opened: boolean;
  onClose: () => void;
  radiusM: number;
  onRadiusChange: (value: number) => void;
  selectedAmenities: Amenity[];
  onChangeAmenities: (next: Amenity[]) => void;
};

const RADIUS_OPTIONS = [1000, 2500, 5000, 0] as const;

function formatRadiusLabel(value: number): string {
  if (value === 0) return WORK_UI_TEXT.radiusAll;
  if (value === 2500) return "2.5 км";
  return `${value / 1000} км`;
}

export default function SettingsDrawer({
  opened,
  onClose,
  radiusM,
  onRadiusChange,
  selectedAmenities,
  onChangeAmenities,
}: SettingsDrawerProps) {
  const { colorScheme: scheme } = useAppColorScheme();

  const chipBaseStyles = {
    border: `1px solid ${
      scheme === "dark"
        ? "rgba(255, 255, 240, 0.18)"
        : "rgba(26, 26, 26, 0.12)"
    }`,
    backdropFilter: "blur(18px) saturate(180%)",
    WebkitBackdropFilter: "blur(18px) saturate(180%)",
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(26,26,26,0.7), rgba(26,26,26,0.5))"
        : "linear-gradient(135deg, rgba(255,255,240,0.92), rgba(255,255,240,0.68))",
    boxShadow:
      scheme === "dark"
        ? "0 6px 18px rgba(0, 0, 0, 0.5)"
        : "0 6px 16px rgba(26, 26, 26, 0.14)",
    color: scheme === "dark" ? "rgba(255,255,240,0.95)" : "#1A1A1A",
  } as const;

  const chipActiveStyles = {
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(69,126,115,0.45), rgba(69,126,115,0.3))"
        : "linear-gradient(135deg, rgba(69,126,115,0.35), rgba(69,126,115,0.2))",
    borderColor:
      scheme === "dark" ? "rgba(69,126,115,0.55)" : "rgba(69,126,115,0.45)",
    boxShadow:
      scheme === "dark"
        ? "0 8px 20px rgba(69, 126, 115, 0.35)"
        : "0 8px 18px rgba(69, 126, 115, 0.25)",
  } as const;

  return (
    <AppModal
      open={opened}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={<span style={{ fontWeight: 700 }}>{WORK_UI_TEXT.settingsAria}</span>}
      implementation="radix"
      presentation="sheet"
      contentClassName="w-full"
      bodyClassName="px-4 pb-5 pt-3"
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 600, color: "var(--text)" }}>
            {WORK_UI_TEXT.filtersTitle}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(Object.keys(AMENITY_LABELS) as Amenity[]).map((amenity) => {
              const isChecked = selectedAmenities.includes(amenity);
              return (
                <button
                  key={amenity}
                  type="button"
                  className="ui-focus-ring"
                  onClick={() => {
                    if (isChecked) {
                      onChangeAmenities(selectedAmenities.filter((value) => value !== amenity));
                    } else {
                      onChangeAmenities([...selectedAmenities, amenity]);
                    }
                  }}
                  style={{
                    ...chipBaseStyles,
                    ...(isChecked ? chipActiveStyles : null),
                    borderRadius: 999,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "6px 10px",
                  }}
                >
                  {AMENITY_LABELS[amenity]}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 600, color: "var(--text)" }}>
            {WORK_UI_TEXT.radiusTitle}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {RADIUS_OPTIONS.map((value) => {
              const isActive = radiusM === value;
              return (
                <UIButton
                  key={value}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "secondary"}
                  onClick={() => onRadiusChange(value)}
                  style={{
                    ...(isActive ? chipActiveStyles : chipBaseStyles),
                    borderRadius: 12,
                  }}
                >
                  {formatRadiusLabel(value)}
                </UIButton>
              );
            })}
          </div>
        </div>
      </div>
    </AppModal>
  );
}
