import { Button, Stack } from "@mantine/core";
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
  if (isLoading) {
    return (
      <Stack
        gap="xs"
        className={classes.loadingList}
        role="status"
        aria-live="polite"
        aria-label={DISCOVERY_UI_TEXT.loading}
      >
        {[
          { name: "48%", meta: "16%" },
          { name: "62%", meta: "20%" },
          { name: "54%", meta: "14%" },
          { name: "68%", meta: "22%" },
          { name: "44%", meta: "18%" },
        ].map((item, idx) => (
          <div key={idx} className={classes.loadingItem}>
            <div className={classes.loadingShine} />
            <div className={classes.loadingContent}>
              <span className={classes.loadingLine} style={{ width: item.name }} />
              <span className={classes.loadingLine} style={{ width: item.meta }} />
            </div>
          </div>
        ))}
      </Stack>
    );
  }

  if (cafes.length === 0) {
    return null;
  }

  return (
    <Stack gap="xs">
      {cafes.map((c) => (
        <Button
          key={c.id}
          ref={(el) => {
            itemRefs.current[c.id] = el;
          }}
          onClick={() => onSelectCafe(c.id)}
          variant={c.id === selectedCafeId ? "filled" : "default"}
          size="sm"
          fullWidth
          radius={22}
          styles={{
            root: {
              justifyContent: "flex-start",
            },
            inner: {
              justifyContent: "flex-start",
            },
            label: {
              width: "100%",
              textAlign: "left",
            },
          }}
        >
          <span>
            {c.name}
            {showDistance && (
              <>
                {" "}
                <span style={{ opacity: 0.7 }}>
                  — {formatDistance(c.distance_m)}
                </span>
              </>
            )}
          </span>
        </Button>
      ))}
    </Stack>
  );
}
