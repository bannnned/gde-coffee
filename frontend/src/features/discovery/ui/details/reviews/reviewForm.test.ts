import { describe, expect, it } from "vitest";

import {
  MAX_REVIEW_PHOTOS,
  MIN_SUMMARY_LENGTH,
  formatReviewDate,
  normalizeDrinkInput,
  parseTags,
  reviewFormSchema,
  runWithConcurrency,
} from "./reviewForm";

function makeSummary(length: number): string {
  return "x".repeat(length);
}

describe("reviewFormSchema", () => {
  it("accepts form when at least one position is provided", () => {
    const result = reviewFormSchema.safeParse({
      ratingValue: "5",
      positionsInput: ["espresso"],
      tagsInput: "berry, chocolate",
      summary: makeSummary(MIN_SUMMARY_LENGTH),
      photos: [],
    });

    expect(result.success).toBe(true);
  });

  it("accepts form when free-form positions are provided", () => {
    const result = reviewFormSchema.safeParse({
      ratingValue: "4",
      positionsInput: ["  filter v60  ", "espresso tonic"],
      tagsInput: "",
      summary: makeSummary(MIN_SUMMARY_LENGTH),
      photos: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects form when positions are empty", () => {
    const result = reviewFormSchema.safeParse({
      ratingValue: "4",
      positionsInput: [],
      tagsInput: "",
      summary: makeSummary(MIN_SUMMARY_LENGTH),
      photos: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "positionsInput")).toBe(true);
    }
  });

  it("rejects too short summary", () => {
    const result = reviewFormSchema.safeParse({
      ratingValue: "3",
      positionsInput: ["americano"],
      tagsInput: "",
      summary: makeSummary(MIN_SUMMARY_LENGTH - 1),
      photos: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "summary")).toBe(true);
    }
  });

  it("rejects more than allowed number of photos", () => {
    const photos = Array.from({ length: MAX_REVIEW_PHOTOS + 1 }, (_, idx) => ({
      id: `id-${idx}`,
      url: `https://example.com/${idx}.jpg`,
      objectKey: `key-${idx}`,
    }));
    const result = reviewFormSchema.safeParse({
      ratingValue: "5",
      positionsInput: ["flat-white"],
      tagsInput: "",
      summary: makeSummary(MIN_SUMMARY_LENGTH),
      photos,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "photos")).toBe(true);
    }
  });
});

describe("reviewForm utils", () => {
  it("parseTags normalizes to lowercase, removes duplicates and limits to 10", () => {
    const parsed = parseTags(
      " Chocolate, berry, chocolate, citrus, caramel, floral, nutty, sweet, tea, juicy, clean, extra",
    );

    expect(parsed).toEqual([
      "chocolate",
      "berry",
      "citrus",
      "caramel",
      "floral",
      "nutty",
      "sweet",
      "tea",
      "juicy",
      "clean",
    ]);
  });

  it("normalizeDrinkInput lowercases and compresses whitespace", () => {
    expect(normalizeDrinkInput("   V60   FILTER   ")).toBe("v60 filter");
  });

  it("formatReviewDate returns original value for invalid date", () => {
    expect(formatReviewDate("not-a-date")).toBe("not-a-date");
  });

  it("runWithConcurrency processes each item exactly once", async () => {
    const processed: number[] = [];
    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      processed.push(item);
      await Promise.resolve();
    });

    expect(processed.slice().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });
});
