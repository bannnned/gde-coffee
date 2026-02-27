import type { CafeRatingSnapshot } from "../../../api/reviews";

export const PRELIMINARY_RATING_REVIEWS_THRESHOLD = 5;

type DisplayRatingResult = {
  value: number | null;
  isPreliminary: boolean;
};

function asFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function clampRating(value: number): number {
  return Math.max(1, Math.min(5, value));
}

export function resolveCafeDisplayRating(snapshot: CafeRatingSnapshot | null): DisplayRatingResult {
  if (!snapshot) {
    return { value: null, isPreliminary: false };
  }

  const reviewsCount = Number.isFinite(snapshot.reviews_count) ? snapshot.reviews_count : 0;
  const weighted = asFiniteNumber(snapshot.rating);
  const rawMean = asFiniteNumber(snapshot.components?.ratings_mean);

  if (reviewsCount > 0 && reviewsCount < PRELIMINARY_RATING_REVIEWS_THRESHOLD && rawMean !== null) {
    return {
      value: clampRating(rawMean),
      isPreliminary: true,
    };
  }

  if (weighted !== null) {
    return {
      value: clampRating(weighted),
      isPreliminary: false,
    };
  }

  if (rawMean !== null) {
    return {
      value: clampRating(rawMean),
      isPreliminary: reviewsCount > 0 && reviewsCount < PRELIMINARY_RATING_REVIEWS_THRESHOLD,
    };
  }

  return { value: null, isPreliminary: false };
}

