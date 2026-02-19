import { useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";

import { getCafePhotos } from "../../../../api/cafePhotos";
import type { Cafe } from "../../../../entities/cafe/model/types";

const AUTO_SLIDE_MS = 4000;

export function useCafeCardPhotos(cafe: Cafe) {
  const touchStartXRef = useRef<number | null>(null);
  const [loadedPhotoURLs, setLoadedPhotoURLs] = useState<Record<string, true>>({});

  const fallbackPhotoURLs = useMemo(() => {
    const direct = (cafe.photos ?? [])
      .filter((photo) => photo.kind === "cafe")
      .map((photo) => photo.url)
      .filter(Boolean);
    const cover = cafe.cover_photo_url?.trim() || "";

    if (cover && !direct.includes(cover)) {
      return [cover, ...direct];
    }
    return cover ? (direct.length > 0 ? direct : [cover]) : direct;
  }, [cafe.cover_photo_url, cafe.photos]);

  const [fetchedPhotoURLsByCafeId, setFetchedPhotoURLsByCafeId] = useState<
    Record<string, string[]>
  >({});
  const [activePhotoState, setActivePhotoState] = useState<{
    cafeId: string;
    index: number;
  }>({
    cafeId: cafe.id,
    index: 0,
  });
  const hasFetchedPhotosForCafe = Object.prototype.hasOwnProperty.call(
    fetchedPhotoURLsByCafeId,
    cafe.id,
  );
  const photoURLs = useMemo(() => {
    const fetched = fetchedPhotoURLsByCafeId[cafe.id];
    if (Array.isArray(fetched) && fetched.length > 0) {
      return fetched;
    }
    return fallbackPhotoURLs;
  }, [cafe.id, fallbackPhotoURLs, fetchedPhotoURLsByCafeId]);
  const activePhotoIndex = useMemo(() => {
    const baseIndex = activePhotoState.cafeId === cafe.id ? activePhotoState.index : 0;
    if (photoURLs.length === 0) return 0;
    return Math.min(baseIndex, photoURLs.length - 1);
  }, [activePhotoState.cafeId, activePhotoState.index, cafe.id, photoURLs.length]);

  const activePhotoURL = photoURLs[activePhotoIndex] ?? null;
  const photoReady = !activePhotoURL || Boolean(loadedPhotoURLs[activePhotoURL]);

  useEffect(() => {
    if (!cafe.id || fallbackPhotoURLs.length > 0 || hasFetchedPhotosForCafe) return;
    let cancelled = false;

    getCafePhotos(cafe.id, "cafe")
      .then((list) => {
        if (cancelled) return;
        const fetched = list.map((photo) => photo.url).filter(Boolean);
        if (fetched.length === 0) return;

        const cover = cafe.cover_photo_url?.trim() || "";
        if (cover && !fetched.includes(cover)) {
          setFetchedPhotoURLsByCafeId((prev) => {
            if (Object.prototype.hasOwnProperty.call(prev, cafe.id)) return prev;
            return {
              ...prev,
              [cafe.id]: [cover, ...fetched],
            };
          });
          return;
        }
        setFetchedPhotoURLsByCafeId((prev) => {
          if (Object.prototype.hasOwnProperty.call(prev, cafe.id)) return prev;
          return {
            ...prev,
            [cafe.id]: fetched,
          };
        });
      })
      .catch(() => {
        // Keep fallback photos on error.
      });

    return () => {
      cancelled = true;
    };
  }, [cafe.id, cafe.cover_photo_url, fallbackPhotoURLs.length, hasFetchedPhotosForCafe]);

  useEffect(() => {
    if (photoURLs.length <= 1) return;
    const timer = window.setInterval(() => {
      setActivePhotoState((prev) => {
        const prevIndex = prev.cafeId === cafe.id ? prev.index : 0;
        return {
          cafeId: cafe.id,
          index: (prevIndex + 1) % photoURLs.length,
        };
      });
    }, AUTO_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [cafe.id, photoURLs.length]);

  const stepPhoto = (direction: -1 | 1) => {
    if (photoURLs.length <= 1) return;
    setActivePhotoState((prev) => {
      const prevIndex = prev.cafeId === cafe.id ? prev.index : 0;
      return {
        cafeId: cafe.id,
        index: (prevIndex + direction + photoURLs.length) % photoURLs.length,
      };
    });
  };

  const handlePhotoTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handlePhotoTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    if (startX == null || endX == null || photoURLs.length <= 1) return;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 40) return;
    if (deltaX < 0) stepPhoto(1);
    if (deltaX > 0) stepPhoto(-1);
  };

  const handlePhotoLoad = (src: string) => {
    if (!src) return;
    setLoadedPhotoURLs((prev) => {
      if (prev[src]) return prev;
      return {
        ...prev,
        [src]: true,
      };
    });
  };

  const handlePhotoError = () => {
    if (!activePhotoURL) return;
    setLoadedPhotoURLs((prev) => {
      if (prev[activePhotoURL]) return prev;
      return {
        ...prev,
        [activePhotoURL]: true,
      };
    });
  };

  return {
    photoURLs,
    activePhotoIndex,
    activePhotoURL,
    photoReady,
    handlePhotoTouchStart,
    handlePhotoTouchEnd,
    handlePhotoLoad,
    handlePhotoError,
  };
}
