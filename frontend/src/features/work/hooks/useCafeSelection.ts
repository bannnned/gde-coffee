import { useEffect, useMemo, useRef, useState } from "react";

import type { Cafe } from "../types";

type UseCafeSelectionParams = {
  cafes: Cafe[];
  onFocusLngLat?: (lngLat: [number, number]) => void;
};

export default function useCafeSelection({
  cafes,
  onFocusLngLat,
}: UseCafeSelectionParams) {
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!cafes.length) {
      setSelectedCafeId(null);
      return;
    }

    setSelectedCafeId((prev) => {
      if (prev && cafes.some((c) => c.id === prev)) return prev;
      return cafes[0].id;
    });
  }, [cafes]);

  const selectedCafe = useMemo(
    () => cafes.find((c) => c.id === selectedCafeId) ?? null,
    [cafes, selectedCafeId],
  );

  function selectCafe(id: string) {
    setSelectedCafeId(id);
    const c = cafes.find((x) => x.id === id);
    if (c && onFocusLngLat) onFocusLngLat([c.longitude, c.latitude]);

    requestAnimationFrame(() => {
      itemRefs.current[id]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  return { selectedCafeId, selectedCafe, selectCafe, itemRefs };
}
