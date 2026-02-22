import { useEffect, useRef, useState } from "react";

import { getCafePhotos } from "../../../../../api/cafePhotos";
import {
  getCafeRatingDiagnostics,
  getCafeRatingSnapshot,
  type CafeRatingDiagnostics,
  type CafeRatingSnapshot,
} from "../../../../../api/reviews";
import type { Cafe, CafePhoto, CafePhotoKind } from "../../../../../entities/cafe/model/types";
import { extractApiErrorMessage } from "../../../../../utils/apiError";

type UseCafeDetailsDataParams = {
  opened: boolean;
  cafe: Cafe | null;
  canViewAdminDiagnostics: boolean;
  photosRefreshToken: number;
  ratingRefreshToken: number;
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
  photosRefreshToken,
  ratingRefreshToken,
}: UseCafeDetailsDataParams) {
  const lastPhotosRefreshTokenRef = useRef(0);
  const [cafePhotos, setCafePhotos] = useState<CafePhoto[]>(
    filterPhotosByKind(cafe?.photos, "cafe"),
  );
  const [menuPhotos, setMenuPhotos] = useState<CafePhoto[]>(
    filterPhotosByKind(cafe?.photos, "menu"),
  );
  const [ratingSnapshotByCafeId, setRatingSnapshotByCafeId] = useState<
    Record<string, CafeRatingSnapshot | null>
  >({});
  const [ratingErrorByCafeId, setRatingErrorByCafeId] = useState<Record<string, string | null>>(
    {},
  );
  const [ratingDiagnosticsByCafeId, setRatingDiagnosticsByCafeId] = useState<
    Record<string, CafeRatingDiagnostics | null>
  >({});
  const [ratingDiagnosticsErrorByCafeId, setRatingDiagnosticsErrorByCafeId] = useState<
    Record<string, string | null>
  >({});

  useEffect(() => {
    if (!opened || !cafe?.id) return;

    const shouldForceRefresh = photosRefreshToken > lastPhotosRefreshTokenRef.current;
    if (shouldForceRefresh) {
      lastPhotosRefreshTokenRef.current = photosRefreshToken;
    }

    let cancelled = false;
    Promise.all([
      getCafePhotos(cafe.id, "cafe", { force: shouldForceRefresh }),
      getCafePhotos(cafe.id, "menu", { force: shouldForceRefresh }),
    ])
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
  }, [cafe?.id, opened, photosRefreshToken]);

  useEffect(() => {
    if (!opened || !cafe?.id) return;

    let cancelled = false;
    getCafeRatingSnapshot(cafe.id)
      .then((snapshot) => {
        if (cancelled) return;
        setRatingSnapshotByCafeId((prev) => ({
          ...prev,
          [cafe.id]: snapshot,
        }));
        setRatingErrorByCafeId((prev) => ({
          ...prev,
          [cafe.id]: null,
        }));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = extractApiErrorMessage(error, "Не удалось загрузить рейтинг.");
        setRatingErrorByCafeId((prev) => ({
          ...prev,
          [cafe.id]: message,
        }));
        setRatingSnapshotByCafeId((prev) => ({
          ...prev,
          [cafe.id]: null,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [cafe?.id, opened, ratingRefreshToken]);

  useEffect(() => {
    if (!opened || !cafe?.id || !canViewAdminDiagnostics) return;

    let cancelled = false;
    getCafeRatingDiagnostics(cafe.id)
      .then((diagnostics) => {
        if (cancelled) return;
        setRatingDiagnosticsByCafeId((prev) => ({
          ...prev,
          [cafe.id]: diagnostics,
        }));
        setRatingDiagnosticsErrorByCafeId((prev) => ({
          ...prev,
          [cafe.id]: null,
        }));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = extractApiErrorMessage(error, "Не удалось загрузить диагностику рейтинга.");
        setRatingDiagnosticsErrorByCafeId((prev) => ({
          ...prev,
          [cafe.id]: message,
        }));
        setRatingDiagnosticsByCafeId((prev) => ({
          ...prev,
          [cafe.id]: null,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [cafe?.id, canViewAdminDiagnostics, opened, ratingRefreshToken]);

  const ratingSnapshot = cafe?.id ? (ratingSnapshotByCafeId[cafe.id] ?? null) : null;
  const ratingError = cafe?.id ? (ratingErrorByCafeId[cafe.id] ?? null) : null;
  const hasRatingSnapshot = cafe?.id
    ? Object.prototype.hasOwnProperty.call(ratingSnapshotByCafeId, cafe.id)
    : false;
  const hasRatingError = cafe?.id
    ? Object.prototype.hasOwnProperty.call(ratingErrorByCafeId, cafe.id)
    : false;
  const ratingLoading = Boolean(opened && cafe?.id && !hasRatingSnapshot && !hasRatingError);

  const ratingDiagnostics = cafe?.id ? (ratingDiagnosticsByCafeId[cafe.id] ?? null) : null;
  const ratingDiagnosticsError = cafe?.id
    ? (ratingDiagnosticsErrorByCafeId[cafe.id] ?? null)
    : null;
  const hasRatingDiagnostics = cafe?.id
    ? Object.prototype.hasOwnProperty.call(ratingDiagnosticsByCafeId, cafe.id)
    : false;
  const hasRatingDiagnosticsError = cafe?.id
    ? Object.prototype.hasOwnProperty.call(ratingDiagnosticsErrorByCafeId, cafe.id)
    : false;
  const ratingDiagnosticsLoading = Boolean(
    opened &&
      cafe?.id &&
      canViewAdminDiagnostics &&
      !hasRatingDiagnostics &&
      !hasRatingDiagnosticsError,
  );

  return {
    cafePhotos: opened && cafe?.id ? cafePhotos : filterPhotosByKind(cafe?.photos, "cafe"),
    menuPhotos: opened && cafe?.id ? menuPhotos : filterPhotosByKind(cafe?.photos, "menu"),
    ratingSnapshot: opened && cafe?.id ? ratingSnapshot : null,
    ratingLoading: opened && cafe?.id ? ratingLoading : false,
    ratingError: opened && cafe?.id ? ratingError : null,
    ratingDiagnostics:
      opened && cafe?.id && canViewAdminDiagnostics ? ratingDiagnostics : null,
    ratingDiagnosticsLoading:
      opened && cafe?.id && canViewAdminDiagnostics ? ratingDiagnosticsLoading : false,
    ratingDiagnosticsError:
      opened && cafe?.id && canViewAdminDiagnostics ? ratingDiagnosticsError : null,
  };
}
