import { IconMapPin } from "@tabler/icons-react";
import type { MutableRefObject } from "react";

import type { Cafe } from "../../../entities/cafe/model/types";
import { DISCOVERY_UI_TEXT } from "../constants";
import { formatDistance } from "../utils";
import classes from "./CafeList.module.css";

type CafeListProps = {
  cafes: Cafe[];
  isLoading: boolean;
  selectedCafeId: string | null;
  onSelectCafe: (id: string) => void;
  itemRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  showDistance?: boolean;
};

export default function CafeList({
  cafes,
  isLoading,
  selectedCafeId,
  onSelectCafe,
  itemRefs,
  showDistance = true,
}: CafeListProps) {
  const loadingSkeleton = [
    { name: "48%", meta: "16%" },
    { name: "62%", meta: "20%" },
    { name: "54%", meta: "14%" },
    { name: "68%", meta: "22%" },
    { name: "44%", meta: "18%" },
  ];

  if (isLoading) {
    return (
      <div
        className={classes.loadingList}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={DISCOVERY_UI_TEXT.loading}
      >
        {loadingSkeleton.map((item, idx) => (
          <div key={idx} className={classes.loadingItem}>
            <div className={classes.loadingShine} />
            <div className={classes.loadingContent}>
              <span className={classes.loadingLine} style={{ width: item.name }} />
              {showDistance && (
                <span
                  className={`${classes.loadingLine} ${classes.loadingDistance}`}
                  style={{ width: item.meta }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (cafes.length === 0) {
    return null;
  }

  return (
    <div className={classes.list}>
      {cafes.map((c) => {
        const isSelected = c.id === selectedCafeId;
        return (
          <button
            key={c.id}
            ref={(el) => {
              itemRefs.current[c.id] = el;
            }}
            className={`${classes.item} ui-focus-ring`}
            data-selected={isSelected ? "true" : "false"}
            type="button"
            onClick={() => onSelectCafe(c.id)}
            aria-pressed={isSelected}
            aria-current={isSelected ? "true" : undefined}
          >
            <div className={classes.itemInner}>
              <div className={classes.itemMain}>
                <p
                  className={classes.itemTitle}
                  title={c.name}
                  style={{
                    margin: 0,
                    fontWeight: isSelected ? 700 : 600,
                    fontSize: "0.875rem",
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 1,
                    overflow: "hidden",
                  }}
                >
                  {c.name}
                </p>
              </div>
              {showDistance && (
                <span className={classes.distancePill}>
                  <IconMapPin size={12} />
                  {formatDistance(c.distance_m)}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
