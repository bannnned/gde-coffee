import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getCafes } from "../../../api/cafes";
import type { Amenity } from "../types";

// Map moves can fire rapidly; debounce before hitting the API.
const QUERY_DEBOUNCE_MS = 400;
// React Query cache window for identical params.
const CAFES_CACHE_STALE_MS = 20_000;
const CAFES_CACHE_GC_MS = 30_000;

type UseCafesParams = {
  lat: number;
  lng: number;
  radiusM: number;
  amenities: Amenity[];
};

type CafesQueryParams = {
  lat: number;
  lng: number;
  radiusM: number;
  amenities: Amenity[];
  amenitiesKey: string;
};

function buildCafesKey({
  lat,
  lng,
  radiusM,
  amenitiesKey,
}: Pick<CafesQueryParams, "lat" | "lng" | "radiusM" | "amenitiesKey">) {
  return `${lat}|${lng}|${radiusM}|${amenitiesKey}`;
}

function linkAbortSignal(signal: AbortSignal, controller: AbortController) {
  if (signal.aborted) {
    controller.abort();
    return;
  }

  signal.addEventListener("abort", () => controller.abort(), { once: true });
}

export default function useCafes({
  lat,
  lng,
  radiusM,
  amenities,
}: UseCafesParams) {
  // Stable ordering so query key doesn't change for the same set.
  const normalizedAmenities = useMemo(
    () => [...amenities].sort(),
    [amenities],
  );
  const amenitiesKey = useMemo(
    () => normalizedAmenities.join(","),
    [normalizedAmenities],
  );

  // Debounced params drive the query key & actual request.
  const [debouncedParams, setDebouncedParams] = useState<CafesQueryParams>(() => ({
    lat,
    lng,
    radiusM,
    amenities: normalizedAmenities,
    amenitiesKey,
  }));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Explicitly cancel the previous in-flight request when a new one starts.
  const abortRef = useRef<AbortController | null>(null);

  const currentKey = useMemo(
    () =>
      buildCafesKey({
        lat,
        lng,
        radiusM,
        amenitiesKey,
      }),
    [lat, lng, radiusM, amenitiesKey],
  );
  const debouncedKey = useMemo(
    () =>
      buildCafesKey({
        lat: debouncedParams.lat,
        lng: debouncedParams.lng,
        radiusM: debouncedParams.radiusM,
        amenitiesKey: debouncedParams.amenitiesKey,
      }),
    [
      debouncedParams.lat,
      debouncedParams.lng,
      debouncedParams.radiusM,
      debouncedParams.amenitiesKey,
    ],
  );

  useEffect(() => {
    // Only schedule a debounce when the params actually changed.
    if (currentKey === debouncedKey) return;

    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedParams({
        lat,
        lng,
        radiusM,
        amenities: normalizedAmenities,
        amenitiesKey,
      });
    }, QUERY_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [
    currentKey,
    debouncedKey,
    lat,
    lng,
    radiusM,
    normalizedAmenities,
    amenitiesKey,
  ]);

  useEffect(() => {
    // Cleanup timers/requests on unmount.
    return () => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (abortRef.current != null) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  const cafesQuery = useQuery({
    queryKey: [
      "cafes",
      {
        lat: debouncedParams.lat,
        lng: debouncedParams.lng,
        radiusM: debouncedParams.radiusM,
        amenities: debouncedParams.amenitiesKey,
      },
    ],
    queryFn: async ({ signal }) => {
      // Abort any prior request so only the latest result wins.
      if (abortRef.current != null) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;
      // Tie React Query cancellation to our controller.
      linkAbortSignal(signal, controller);

      try {
        return await getCafes({
          lat: debouncedParams.lat,
          lng: debouncedParams.lng,
          radius_m: debouncedParams.radiusM,
          amenities: debouncedParams.amenities,
          signal: controller.signal,
        });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    staleTime: CAFES_CACHE_STALE_MS,
    gcTime: CAFES_CACHE_GC_MS,
    placeholderData: (previous) => previous,
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
