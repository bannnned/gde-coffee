import { useEffect, useState } from "react";

import { getCafePhotos } from "../../../../../api/cafePhotos";
import {
  getCafeRatingDiagnostics,
  getCafeRatingSnapshot,
  type CafeRatingDiagnostics,
  type CafeRatingSnapshot,
} from "../../../../../api/reviews";
import type { Cafe, CafePhoto, CafePhotoKind } from "../../../../../entities/cafe/model/types";

type UseCafeDetailsDataParams = {
  opened: boolean;
  cafe: Cafe | null;
  canViewAdminDiagnostics: boolean;
};

export function filterPhotosByKind(
  photos: CafePhoto[] | undefined,
  kind: CafePhotoKind,
): CafePhoto[] {
  if (!Array.isArray(photos) || photos.length === 0) return [];
  return photos.filter((photo) => photo.kind === kind);
}

export function useCafeDetailsData({
  opened,
  cafe,
  canViewAdminDiagnostics,
}: UseCafeDetailsDataParams) {
  const [cafePhotos, setCafePhotos] = useState<CafePhoto[]>(
    filterPhotosByKind(cafe?.photos, "cafe"),
  );
  const [menuPhotos, setMenuPhotos] = useState<CafePhoto[]>(
    filterPhotosByKind(cafe?.photos, "menu"),
  );
  const [ratingSnapshot, setRatingSnapshot] = useState<CafeRatingSnapshot | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingDiagnostics, setRatingDiagnostics] = useState<CafeRatingDiagnostics | null>(null);
  const [ratingDiagnosticsLoading, setRatingDiagnosticsLoading] = useState(false);
  const [ratingDiagnosticsError, setRatingDiagnosticsError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened || !cafe?.id) {
      setCafePhotos(filterPhotosByKind(cafe?.photos, "cafe"));
      setMenuPhotos(filterPhotosByKind(cafe?.photos, "menu"));
      return;
    }

    let cancelled = false;
    setCafePhotos(filterPhotosByKind(cafe.photos, "cafe"));
    setMenuPhotos(filterPhotosByKind(cafe.photos, "menu"));
    Promise.all([getCafePhotos(cafe.id, "cafe"), getCafePhotos(cafe.id, "menu")])
      .then(([nextCafePhotos, nextMenuPhotos]) => {
        if (cancelled) return;
        setCafePhotos(nextCafePhotos);
        setMenuPhotos(nextMenuPhotos);
      })
      .catch(() => {
        if (cancelled) return;
        setCafePhotos(filterPhotosByKind(cafe.photos, "cafe"));
        setMenuPhotos(filterPhotosByKind(cafe.photos, "menu"));
      });

    return () => {
      cancelled = true;
    };
  }, [cafe?.id, cafe?.photos, opened]);

  useEffect(() => {
    if (!opened || !cafe?.id) {
      setRatingSnapshot(null);
      setRatingLoading(false);
      setRatingError(null);
      return;
    }

    let cancelled = false;
    setRatingLoading(true);
    setRatingError(null);
    getCafeRatingSnapshot(cafe.id)
      .then((snapshot) => {
        if (cancelled) return;
        setRatingSnapshot(snapshot);
      })
      .catch((error: any) => {
        if (cancelled) return;
        const message =
          error?.normalized?.message ??
          error?.response?.data?.message ??
          error?.message ??
          "Не удалось загрузить рейтинг.";
        setRatingError(message);
        setRatingSnapshot(null);
      })
      .finally(() => {
        if (cancelled) return;
        setRatingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cafe?.id, opened]);

  useEffect(() => {
    if (!opened || !cafe?.id || !canViewAdminDiagnostics) {
      setRatingDiagnostics(null);
      setRatingDiagnosticsLoading(false);
      setRatingDiagnosticsError(null);
      return;
    }

    let cancelled = false;
    setRatingDiagnosticsLoading(true);
    setRatingDiagnosticsError(null);
    getCafeRatingDiagnostics(cafe.id)
      .then((diagnostics) => {
        if (cancelled) return;
        setRatingDiagnostics(diagnostics);
      })
      .catch((error: any) => {
        if (cancelled) return;
        const message =
          error?.normalized?.message ??
          error?.response?.data?.message ??
          error?.message ??
          "Не удалось загрузить диагностику рейтинга.";
        setRatingDiagnosticsError(message);
        setRatingDiagnostics(null);
      })
      .finally(() => {
        if (cancelled) return;
        setRatingDiagnosticsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cafe?.id, canViewAdminDiagnostics, opened]);

  return {
    cafePhotos,
    menuPhotos,
    ratingSnapshot,
    ratingLoading,
    ratingError,
    ratingDiagnostics,
    ratingDiagnosticsLoading,
    ratingDiagnosticsError,
  };
}
