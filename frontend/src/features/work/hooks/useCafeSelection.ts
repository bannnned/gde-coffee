import useDiscoveryCafeSelection from "../../discovery/hooks/useCafeSelection";

import type { Cafe } from "../types";

type UseCafeSelectionParams = {
  cafes: Cafe[];
  onFocusLngLat: (focus: [number, number] | null) => void;
};

export default function useCafeSelection({
  cafes,
  onFocusLngLat,
}: UseCafeSelectionParams) {
  return useDiscoveryCafeSelection({ cafes, onFocusLngLat });
}
