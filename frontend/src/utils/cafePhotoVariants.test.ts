import { describe, expect, it } from "vitest";

import {
  buildCafePhotoFormatSrcSet,
  buildCafePhotoPictureSources,
  buildCafePhotoSrcSet,
} from "./cafePhotoVariants";

describe("buildCafePhotoSrcSet", () => {
  it("returns undefined while variants are disabled", () => {
    const srcSet = buildCafePhotoSrcSet(
      "https://img.gde-kofe.ru/cafes/1/cafe/optimized/1700_hash.jpg",
      [640, 1024],
    );
    expect(srcSet).toBeUndefined();
  });

  it("returns undefined for 320 when variants are disabled", () => {
    const srcSet = buildCafePhotoSrcSet(
      "https://img.gde-kofe.ru/cafes/1/cafe/optimized/a.jpg?v=1",
      [320],
    );
    expect(srcSet).toBeUndefined();
  });

  it("returns undefined for non-optimized URLs", () => {
    const srcSet = buildCafePhotoSrcSet("https://img.gde-kofe.ru/cafes/1/cafe/a.jpg", [640]);
    expect(srcSet).toBeUndefined();
  });

  it("returns undefined for format srcset while variants are disabled", () => {
    const srcSet = buildCafePhotoFormatSrcSet(
      "https://img.gde-kofe.ru/cafes/1/cafe/optimized/1700_hash.jpg",
      [640, 1024],
      "avif",
    );
    expect(srcSet).toBeUndefined();
  });

  it("returns undefined for webp format srcset while variants are disabled", () => {
    const srcSet = buildCafePhotoFormatSrcSet(
      "https://img.gde-kofe.ru/cafes/1/cafe/optimized/1700_hash.jpg",
      [320, 640],
      "webp",
    );
    expect(srcSet).toBeUndefined();
  });

  it("builds picture sources", () => {
    const sources = buildCafePhotoPictureSources(
      "https://img.gde-kofe.ru/cafes/1/cafe/optimized/1700_hash.jpg",
      [640],
    );
    expect(sources).toEqual({
      fallbackSrcSet: undefined,
      webpSrcSet: undefined,
      avifSrcSet: undefined,
    });
  });
});
