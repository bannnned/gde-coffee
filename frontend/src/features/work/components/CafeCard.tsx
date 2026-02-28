import { Button as UIButton } from "../../../components/ui";
import useAppColorScheme from "../../../hooks/useAppColorScheme";
import type { Cafe } from "../types";
import { AMENITY_LABELS, WORK_UI_TEXT } from "../constants";
import { formatDistance } from "../utils";

type CafeCardProps = {
  cafe: Cafe;
  onOpen2gis: (cafe: Cafe) => void;
  onOpenYandex: (cafe: Cafe) => void;
};

export default function CafeCard({
  cafe,
  onOpen2gis,
  onOpenYandex,
}: CafeCardProps) {
  const { colorScheme: scheme } = useAppColorScheme();

  const cardStyles = {
    zIndex: 1,
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(26,26,26,0.78), rgba(26,26,26,0.6))"
        : "linear-gradient(135deg, rgba(255,255,240,0.94), rgba(255,255,240,0.72))",
    border:
      scheme === "dark"
        ? "1px solid rgba(255, 255, 240, 0.16)"
        : "1px solid rgba(26, 26, 26, 0.1)",
    boxShadow:
      scheme === "dark"
        ? "0 18px 40px rgba(0, 0, 0, 0.6), 0 8px 20px rgba(0, 0, 0, 0.45)"
        : "0 18px 40px rgba(26, 26, 26, 0.14), 0 8px 18px rgba(26, 26, 26, 0.12)",
    backdropFilter: "blur(18px) saturate(160%)",
    WebkitBackdropFilter: "blur(18px) saturate(160%)",
    borderRadius: 16,
    padding: 10,
  } as const;

  const badgeStyles = {
    background:
      scheme === "dark"
        ? "rgba(255, 255, 240, 0.08)"
        : "rgba(255, 255, 240, 0.7)",
    border:
      scheme === "dark"
        ? "1px solid rgba(255, 255, 240, 0.18)"
        : "1px solid rgba(26, 26, 26, 0.12)",
    color: scheme === "dark" ? "rgba(255, 255, 240, 0.95)" : "#1A1A1A",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  } as const;

  return (
    <div style={cardStyles}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "nowrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontWeight: 700,
              color: "var(--text)",
              fontSize: "1rem",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={cafe.name}
          >
            {cafe.name}
          </p>
          <p
            style={{
              margin: "2px 0 0",
              color: "var(--muted)",
              fontSize: "0.86rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={cafe.address}
          >
            {cafe.address}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "0.82rem", color: "var(--text)" }}>
            {formatDistance(cafe.distance_m)} · {WORK_UI_TEXT.workScorePrefix} {Math.round(cafe.work_score)}
          </p>
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 8,
              overflow: "hidden",
              maskImage: "linear-gradient(90deg, #000 85%, transparent)",
              WebkitMaskImage: "linear-gradient(90deg, #000 85%, transparent)",
            }}
          >
            {cafe.amenities.map((amenity) => (
              <span
                key={amenity}
                style={{
                  ...badgeStyles,
                  borderRadius: 999,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  padding: "3px 8px",
                  whiteSpace: "nowrap",
                }}
              >
                {AMENITY_LABELS[amenity] ?? amenity}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 6, minWidth: 130, flexShrink: 0 }}>
          <UIButton size="sm" onClick={() => onOpen2gis(cafe)}>
            {WORK_UI_TEXT.route2gis}
          </UIButton>
          <UIButton size="sm" variant="secondary" onClick={() => onOpenYandex(cafe)}>
            {WORK_UI_TEXT.routeYandex}
          </UIButton>
        </div>
      </div>
    </div>
  );
}
