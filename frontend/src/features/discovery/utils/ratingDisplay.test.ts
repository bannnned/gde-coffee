import { describe, expect, it } from "vitest";

import { resolveCafeDisplayRating } from "./ratingDisplay";

describe("resolveCafeDisplayRating", () => {
  it("returns null rating when there are no reviews", () => {
    const result = resolveCafeDisplayRating({
      api_contract_version: "v1",
      formula_versions: {
        rating: "rating_v1",
        quality: "quality_v1",
      },
      cafe_id: "cafe-1",
      formula_version: "rating_v1",
      rating: 1,
      reviews_count: 0,
      verified_reviews_count: 0,
      verified_share: 0,
      fraud_risk: 0,
      best_review: null,
      descriptive_tags: [],
      specific_tags: [],
      ai_summary: null,
      components: {},
      computed_at: new Date().toISOString(),
    });

    expect(result).toEqual({
      value: null,
      isPreliminary: false,
    });
  });
});
