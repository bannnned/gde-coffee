import { describe, expect, it } from "vitest";

import { buildCafePhotoSrcSet } from "./cafePhotoVariants";

describe("buildCafePhotoSrcSet", () => {
  it("builds srcset for optimized URLs", () => {
    const srcSet = buildCafePhotoSrcSet(
      "https://img.gde-kofe.ru/cafes/1/cafe/optimized/1700_hash.jpg",
      [640, 1024],
    );
    expect(srcSet).toBe(
      "https://img.gde-kofe.ru/cafes/1/cafe/optimized/1700_hash_w640.jpg 640w, https://img.gde-kofe.ru/cafes/1/cafe/optimized/1700_hash_w1024.jpg 1024w",
    );
  });

  it("keeps query params for variants", () => {
    const srcSet = buildCafePhotoSrcSet(
      "https://img.gde-kofe.ru/cafes/1/cafe/optimized/a.jpg?v=1",
      [320],
    );
    expect(srcSet).toBe("https://img.gde-kofe.ru/cafes/1/cafe/optimized/a_w320.jpg?v=1 320w");
  });

  it("returns undefined for non-optimized URLs", () => {
    const srcSet = buildCafePhotoSrcSet("https://img.gde-kofe.ru/cafes/1/cafe/a.jpg", [640]);
    expect(srcSet).toBeUndefined();
  });
});
