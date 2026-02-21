import { useMemo } from "react";

import type {
  CafeRatingDiagnostics,
  CafeRatingSnapshot,
} from "../../../../../api/reviews";
import type { Cafe, CafePhoto, CafePhotoKind } from "../../../../../entities/cafe/model/types";

type UseCafeDetailsComputedParams = {
  cafe: Cafe | null;
  cafePhotos: CafePhoto[];
  menuPhotos: CafePhoto[];
  aboutActiveIndex: number;
  menuActiveIndex: number;
  viewerKind: CafePhotoKind;
  viewerIndex: number;
  ratingSnapshot: CafeRatingSnapshot | null;
  ratingDiagnostics: CafeRatingDiagnostics | null;
};

export function useCafeDetailsComputed({
  cafe,
  cafePhotos,
  menuPhotos,
  aboutActiveIndex,
  menuActiveIndex,
  viewerKind,
  viewerIndex,
  ratingSnapshot,
  ratingDiagnostics,
}: UseCafeDetailsComputedParams) {
  const coverPhotoUrl =
    cafe?.cover_photo_url ??
    cafePhotos.find((photo) => photo.is_cover)?.url ??
    cafePhotos[0]?.url;

  const aboutPhotoItems = useMemo(() => {
    if (cafePhotos.length > 0) return cafePhotos;
    if (!coverPhotoUrl) return [];
    return [
      {
        id: "__cover__",
        url: coverPhotoUrl,
        kind: "cafe" as const,
        is_cover: true,
        position: 1,
      },
    ];
  }, [cafePhotos, coverPhotoUrl]);

  const menuPhotoItems = menuPhotos;
  const aboutMainPhoto = aboutPhotoItems[aboutActiveIndex] ?? null;
  const menuMainPhoto = menuPhotoItems[menuActiveIndex] ?? null;
  const viewerPhotos = viewerKind === "menu" ? menuPhotoItems : aboutPhotoItems;
  const viewerPhoto = viewerPhotos[viewerIndex] ?? null;

  const ratingLabel = ratingSnapshot ? ratingSnapshot.rating.toFixed(2) : "—";
  const ratingReviews = ratingSnapshot?.reviews_count ?? 0;
  const verifiedSharePercent = Math.round((ratingSnapshot?.verified_share ?? 0) * 100);
  const bestReview = ratingSnapshot?.best_review ?? null;
  const specificTags = Array.from(
    new Set((ratingSnapshot?.specific_tags ?? []).map((tag) => tag.label).filter(Boolean)),
  );

  const diagnosticsComponents = ratingDiagnostics?.components ?? {};
  const diagnosticsTrust = Number(diagnosticsComponents.trust) || 0;
  const diagnosticsBase = Number(diagnosticsComponents.bayesian_base) || 0;
  const diagnosticsTopReviews = ratingDiagnostics?.reviews.slice(0, 3) ?? [];

  return {
    aboutPhotoItems,
    menuPhotoItems,
    aboutMainPhoto,
    menuMainPhoto,
    viewerPhotos,
    viewerPhoto,
    ratingLabel,
    ratingReviews,
    verifiedSharePercent,
    bestReview,
    specificTags,
    diagnosticsTrust,
    diagnosticsBase,
    diagnosticsTopReviews,
  };
}
