import { useMemo, useRef, useState } from "react";

import type { Cafe } from "../../../entities/cafe/model/types";

type UseCafeSelectionParams = {
  cafes: Cafe[];
  onFocusLngLat?: (lngLat: [number, number]) => void;
};

export default function useCafeSelection({
  cafes,
  onFocusLngLat,
}: UseCafeSelectionParams) {
  const [selectedCafeIdRaw, setSelectedCafeIdRaw] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const selectedCafeId = useMemo(() => {
    if (!cafes.length) return null;
    if (selectedCafeIdRaw && cafes.some((c) => c.id === selectedCafeIdRaw)) {
      return selectedCafeIdRaw;
    }
    return cafes[0].id;
  }, [cafes, selectedCafeIdRaw]);

  const selectedCafe = useMemo(
    () => cafes.find((c) => c.id === selectedCafeId) ?? null,
    [cafes, selectedCafeId],
  );

  function selectCafe(id: string) {
    setSelectedCafeIdRaw(id);
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
