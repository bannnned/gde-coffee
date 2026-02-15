import { Button, Stack, Text } from "@mantine/core";
import type { MutableRefObject } from "react";

import type { Cafe } from "../types";
import { WORK_UI_TEXT } from "../constants";
import { formatDistance } from "../utils";

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
    return <Text size="sm">{WORK_UI_TEXT.loading}</Text>;
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
