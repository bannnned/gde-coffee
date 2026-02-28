import { useLayoutEffect, useMemo, useRef, useState } from "react";

import logoUrl from "../../../assets/logo.png";
import { Button as UIButton } from "../../../components/ui";
import useAppColorScheme from "../../../hooks/useAppColorScheme";
import { ColorSchemeToggle } from "../../../components/ColorSchemeToggle";
import type { Amenity } from "../types";
import { AMENITY_LABELS, WORK_ICONS, WORK_UI_TEXT } from "../constants";
import classes from "./FiltersBar.module.css";
import { useLayoutMetrics } from "../layout/LayoutMetricsContext";

type FiltersBarProps = {
  selectedAmenities: Amenity[];
  onChangeAmenities: (next: Amenity[]) => void;
  onOpenSettings: () => void;
  showFetchingBadge: boolean;
};

const CHIP_GAP_PX = 4;

export default function FiltersBar({
  selectedAmenities,
  onChangeAmenities,
  onOpenSettings,
  showFetchingBadge,
}: FiltersBarProps) {
  const { colorScheme: scheme } = useAppColorScheme();
  const chipsScrollerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const chipMeasureRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const allAmenities = useMemo(
    () => Object.keys(AMENITY_LABELS) as Amenity[],
    [],
  );
  const [visibleAmenities, setVisibleAmenities] =
    useState<Amenity[]>(allAmenities);
  const selectedKey = useMemo(
    () => selectedAmenities.slice().sort().join(","),
    [selectedAmenities],
  );
  const { setFiltersBarHeight } = useLayoutMetrics();

  const amenityChipLabelBaseStyles = {
    boxSizing: "border-box" as const,
    minWidth: 72,
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    fontWeight: 500,
    fontSize: 12,
    lineHeight: 1,
    letterSpacing: 0,
    transform: "none",
    paddingInline: 10,
    paddingBlock: 6,
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
    outline: "none",
    borderRadius: 999,
    color: scheme === "dark" ? "rgba(255,255,240,0.95)" : "#1A1A1A",
  };

  const amenityChipLabelCheckedStyles = {
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
    transform: "none",
  } as const;

  useLayoutEffect(() => {
    const container = chipsScrollerRef.current;
    if (!container) return;
    let raf = 0;

    const update = () => {
      const available = container.clientWidth;
      if (available <= 0) return;
      let used = 0;
      const next: Amenity[] = [];

      for (const amenity of allAmenities) {
        const node = chipMeasureRefs.current[amenity];
        if (!node) continue;
        const width = node.offsetWidth;
        const nextUsed = next.length === 0 ? width : used + CHIP_GAP_PX + width;

        if (nextUsed <= available) {
          next.push(amenity);
          used = nextUsed;
        } else {
          break;
        }
      }

      setVisibleAmenities((prev) => {
        if (
          prev.length === next.length &&
          prev.every((value, idx) => value === next[idx])
        ) {
          return prev;
        }
        return next;
      });
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(update);
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [allAmenities, selectedKey, scheme]);

  useLayoutEffect(() => {
    const node = headerRef.current;
    if (!node) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      setFiltersBarHeight(rect.bottom);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      setFiltersBarHeight(0);
    };
  }, [setFiltersBarHeight]);

  return (
    <div
      className={classes.root}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        padding: "calc(var(--safe-top) + 12px) 12px 12px",
      }}
      data-ui="filters-bar"
    >
      <div
        className={classes.header}
        data-ui="filters-bar-header"
        ref={headerRef}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <div className={classes.logo}>
          <img src={logoUrl} alt="" className={classes.logoMark} />
          <span>{WORK_UI_TEXT.title}</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <UIButton
            type="button"
            variant="ghost"
            size="icon"
            className="glass-action glass-action--square"
            aria-label={WORK_UI_TEXT.settingsAria}
            onClick={onOpenSettings}
          >
            <WORK_ICONS.settings size={18} />
          </UIButton>

          <ColorSchemeToggle />
        </div>
      </div>

      <div className={classes.chipsRow} style={{ marginTop: 8, gap: 8 }}>
        <div
          className={classes.chipsScroller}
          ref={chipsScrollerRef}
          style={{ display: "flex", justifyContent: "center", gap: 4 }}
        >
          {visibleAmenities.map((amenity) => {
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
                  ...amenityChipLabelBaseStyles,
                  ...(isChecked ? amenityChipLabelCheckedStyles : null),
                }}
              >
                {AMENITY_LABELS[amenity]}
              </button>
            );
          })}
        </div>

        {showFetchingBadge ? (
          <span
            className={classes.fetchBadge}
            style={{
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: "0.75rem",
              color: "#fff",
              backdropFilter: "blur(8px)",
              background: "rgba(0,0,0,0.65)",
            }}
          >
            {WORK_UI_TEXT.fetching}
          </span>
        ) : null}
      </div>

      <div className={classes.chipsMeasure} aria-hidden="true">
        {allAmenities.map((amenity) => {
          const isChecked = selectedAmenities.includes(amenity);
          return (
            <span
              key={amenity}
              ref={(node) => {
                chipMeasureRefs.current[amenity] = node;
              }}
              className={classes.chipMeasureItem}
            >
              <span
                style={{
                  ...amenityChipLabelBaseStyles,
                  ...(isChecked ? amenityChipLabelCheckedStyles : null),
                }}
              >
                {AMENITY_LABELS[amenity]}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
