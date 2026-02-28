import {
  IconAlertCircle,
  IconCoffee,
  IconMapPinOff,
} from "@tabler/icons-react";
import type { MutableRefObject } from "react";

import { Button as UIButton } from "../../../components/ui";
import useAppColorScheme from "../../../hooks/useAppColorScheme";
import type { Cafe } from "../types";
import { WORK_UI_TEXT } from "../constants";
import { formatDistance } from "../utils";

type EmptyState = "no-results" | "no-geo" | "error";

type CafeListProps = {
  cafes: Cafe[];
  isLoading: boolean;
  isError: boolean;
  emptyState: EmptyState;
  selectedCafeId: string | null;
  onSelectCafe: (id: string) => void;
  itemRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  onResetFilters: () => void;
  onRetry: () => void;
  onLocate: () => void;
};

export default function CafeList({
  cafes,
  isLoading,
  isError,
  emptyState,
  selectedCafeId,
  onSelectCafe,
  itemRefs,
  onResetFilters,
  onRetry,
  onLocate,
}: CafeListProps) {
  const { colorScheme: scheme } = useAppColorScheme();

  const emptyConfig =
    isError || emptyState === "error"
      ? {
          icon: IconAlertCircle,
          title: WORK_UI_TEXT.emptyErrorTitle,
          subtitle: WORK_UI_TEXT.emptyErrorSubtitle,
          actionLabel: WORK_UI_TEXT.retry,
          onAction: onRetry,
        }
      : emptyState === "no-geo"
        ? {
            icon: IconMapPinOff,
            title: WORK_UI_TEXT.emptyNoGeoTitle,
            subtitle: WORK_UI_TEXT.emptyNoGeoSubtitle,
            actionLabel: WORK_UI_TEXT.locate,
            onAction: onLocate,
          }
        : {
            icon: IconCoffee,
            title: WORK_UI_TEXT.emptyTitle,
            subtitle: WORK_UI_TEXT.emptySubtitle,
            actionLabel: WORK_UI_TEXT.resetFilters,
            onAction: onResetFilters,
          };

  const emptyCardStyles = {
    border:
      scheme === "dark"
        ? "1px solid rgba(255, 255, 240, 0.16)"
        : "1px solid rgba(26, 26, 26, 0.1)",
  } as const;

  const emptyIconStyles = {
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(69,126,115,0.45), rgba(69,126,115,0.28))"
        : "linear-gradient(135deg, rgba(69,126,115,0.28), rgba(69,126,115,0.18))",
    color: scheme === "dark" ? "rgba(255, 255, 240, 0.95)" : "#1A1A1A",
    boxShadow:
      scheme === "dark"
        ? "0 10px 20px rgba(0, 0, 0, 0.5)"
        : "0 10px 20px rgba(26, 26, 26, 0.14)",
  } as const;

  const EmptyIcon = emptyConfig.icon;

  if (isLoading) {
    return (
      <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted)" }}>
        {WORK_UI_TEXT.loading}
      </p>
    );
  }

  if (cafes.length === 0) {
    return (
      <div
        style={{
          ...emptyCardStyles,
          borderRadius: 16,
          padding: 14,
          background: "var(--surface)",
          display: "grid",
          gap: 6,
          justifyItems: "center",
          textAlign: "center",
        }}
      >
        <span
          style={{
            ...emptyIconStyles,
            width: 48,
            height: 48,
            borderRadius: 18,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <EmptyIcon size={22} />
        </span>
        <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700 }}>
          {emptyConfig.title}
        </p>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)" }}>
          {emptyConfig.subtitle}
        </p>
        <UIButton size="sm" variant="secondary" onClick={emptyConfig.onAction}>
          {emptyConfig.actionLabel}
        </UIButton>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {cafes.map((cafe) => {
        const isSelected = cafe.id === selectedCafeId;
        return (
          <button
            key={cafe.id}
            ref={(node) => {
              itemRefs.current[cafe.id] = node;
            }}
            type="button"
            onClick={() => onSelectCafe(cafe.id)}
            className="ui-focus-ring"
            style={{
              width: "100%",
              borderRadius: 12,
              border: `1px solid ${isSelected ? "var(--color-brand-accent)" : "var(--border)"}`,
              background: isSelected ? "var(--color-brand-accent-soft)" : "var(--surface)",
              color: "var(--text)",
              minHeight: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "8px 10px",
              textAlign: "left",
            }}
          >
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {cafe.name}{" "}
              <span style={{ opacity: 0.7 }}>
                - {formatDistance(cafe.distance_m)}
              </span>
            </span>
            <span style={{ opacity: 0.8, whiteSpace: "nowrap" }}>
              {WORK_UI_TEXT.workScorePrefix} {Math.round(cafe.work_score)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
