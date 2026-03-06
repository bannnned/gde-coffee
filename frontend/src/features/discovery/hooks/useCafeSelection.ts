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
  const [selectCafeActionToken, setSelectCafeActionToken] = useState(0);
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
    setSelectCafeActionToken((prev) => prev + 1);
    const c = cafes.find((x) => x.id === id);
    if (c && onFocusLngLat) onFocusLngLat([c.longitude, c.latitude]);

    requestAnimationFrame(() => {
      const node = itemRefs.current[id];
      if (!node) return;
      // Keep selection scroll strictly inside the bottom-sheet list and never scroll viewport.
      const scroller = node.closest<HTMLElement>('[data-sheet-scroll="true"]');
      if (!scroller) {
        node.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
        return;
      }

      const margin = 8;
      const currentTop = scroller.scrollTop;
      const viewportHeight = scroller.clientHeight;
      const itemTop = node.offsetTop;
      const itemBottom = itemTop + node.offsetHeight;
      const viewportTop = currentTop;
      const viewportBottom = currentTop + viewportHeight;

      let nextTop = currentTop;
      if (itemTop < viewportTop + margin) {
        nextTop = Math.max(0, itemTop - margin);
      } else if (itemBottom > viewportBottom - margin) {
        nextTop = Math.max(0, itemBottom - viewportHeight + margin);
      }

      if (Math.abs(nextTop - currentTop) >= 1) {
        scroller.scrollTo({
          top: nextTop,
          behavior: "smooth",
        });
      }
    });
  }

  return { selectedCafeId, selectedCafe, selectCafe, itemRefs, selectCafeActionToken };
}
