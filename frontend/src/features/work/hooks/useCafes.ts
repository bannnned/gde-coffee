import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getCafes } from "../../../api/cafes";
import type { Amenity, SortBy } from "../types";

type UseCafesParams = {
  lat: number;
  lng: number;
  radiusM: number;
  sortBy: SortBy;
  amenities: Amenity[];
};

export default function useCafes({
  lat,
  lng,
  radiusM,
  sortBy,
  amenities,
}: UseCafesParams) {
  const normalizedAmenities = useMemo(
    () => [...amenities].sort(),
    [amenities],
  );

  const cafesQuery = useQuery({
    queryKey: ["cafes", { lat, lng, radiusM, sortBy, amenities: normalizedAmenities }],
    queryFn: ({ signal }) =>
      getCafes({
        lat,
        lng,
        radius_m: radiusM,
        sort: sortBy,
        amenities: normalizedAmenities,
        signal,
      }),
    staleTime: 15_000,
  });

  const cafes = cafesQuery.data ?? [];
  const [showFetchingBadge, setShowFetchingBadge] = useState(false);
  const fetchingDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cafesQuery.isFetching) {
      if (fetchingDelayRef.current == null) {
        fetchingDelayRef.current = setTimeout(() => {
          setShowFetchingBadge(true);
        }, 250);
      }
    } else {
      if (fetchingDelayRef.current != null) {
        clearTimeout(fetchingDelayRef.current);
        fetchingDelayRef.current = null;
      }
      setShowFetchingBadge(false);
    }

    return () => {
      if (fetchingDelayRef.current != null) {
        clearTimeout(fetchingDelayRef.current);
        fetchingDelayRef.current = null;
      }
    };
  }, [cafesQuery.isFetching]);

  return { cafes, cafesQuery, showFetchingBadge };
}
