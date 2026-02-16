import { useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";

import { getCafePhotos } from "../../../../api/cafePhotos";
import type { Cafe } from "../../../../entities/cafe/model/types";

const AUTO_SLIDE_MS = 4000;

export function useCafeCardPhotos(cafe: Cafe) {
  const touchStartXRef = useRef<number | null>(null);
  const loadedPhotoURLsRef = useRef<Set<string>>(new Set());

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

  const [photoURLs, setPhotoURLs] = useState<string[]>(fallbackPhotoURLs);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [photoReady, setPhotoReady] = useState(true);

  const activePhotoURL = photoURLs[activePhotoIndex] ?? null;

  useEffect(() => {
    setPhotoURLs(fallbackPhotoURLs);
    setActivePhotoIndex(0);
  }, [cafe.id, fallbackPhotoURLs]);

  useEffect(() => {
    if (!cafe.id) return;
    let cancelled = false;

    getCafePhotos(cafe.id, "cafe")
      .then((list) => {
        if (cancelled) return;
        const fetched = list.map((photo) => photo.url).filter(Boolean);
        if (fetched.length === 0) return;

        const cover = cafe.cover_photo_url?.trim() || "";
        if (cover && !fetched.includes(cover)) {
          setPhotoURLs([cover, ...fetched]);
          return;
        }
        setPhotoURLs(fetched);
      })
      .catch(() => {
        // Keep fallback photos on error.
      });

    return () => {
      cancelled = true;
    };
  }, [cafe.id, cafe.cover_photo_url]);

  useEffect(() => {
    setActivePhotoIndex((prev) =>
      photoURLs.length === 0 ? 0 : Math.min(prev, photoURLs.length - 1),
    );
  }, [photoURLs.length]);

  useEffect(() => {
    if (!activePhotoURL) {
      setPhotoReady(true);
      return;
    }
    setPhotoReady(loadedPhotoURLsRef.current.has(activePhotoURL));
  }, [activePhotoURL]);

  useEffect(() => {
    if (photoURLs.length <= 1) return;
    const timer = window.setInterval(() => {
      setActivePhotoIndex((prev) => (prev + 1) % photoURLs.length);
    }, AUTO_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [photoURLs.length]);

  const stepPhoto = (direction: -1 | 1) => {
    if (photoURLs.length <= 1) return;
    setActivePhotoIndex((prev) => (prev + direction + photoURLs.length) % photoURLs.length);
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
    if (src) {
      loadedPhotoURLsRef.current.add(src);
    }
    setPhotoReady(true);
  };

  const handlePhotoError = () => {
    setPhotoReady(true);
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
