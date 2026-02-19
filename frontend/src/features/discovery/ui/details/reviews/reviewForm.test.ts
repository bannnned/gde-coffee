import { describe, expect, it } from "vitest";

import {
  MAX_REVIEW_PHOTOS,
  buildReviewSummaryFromSections,
  formatReviewDate,
  normalizeDrinkInput,
  parseReviewSummarySections,
  parseTags,
  reviewFormSchema,
  runWithConcurrency,
} from "./reviewForm";

describe("reviewFormSchema", () => {
  it("accepts form when at least one review block is filled", () => {
    const result = reviewFormSchema.safeParse({
      ratingValue: "5",
      positionsInput: ["espresso"],
      tagsInput: "berry, chocolate",
      liked: "Сбалансированная чашка без горечи.",
      disliked: "",
      summary: "",
      photos: [],
    });

    expect(result.success).toBe(true);
  });

  it("accepts form when free-form positions are provided", () => {
    const result = reviewFormSchema.safeParse({
      ratingValue: "4",
      positionsInput: ["  filter v60  ", "espresso tonic"],
      tagsInput: "",
      liked: "",
      disliked: "Долго ждали заказ.",
      summary: "",
      photos: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects form when positions are empty", () => {
    const result = reviewFormSchema.safeParse({
      ratingValue: "4",
      positionsInput: [],
      tagsInput: "",
      liked: "",
      disliked: "",
      summary: "Вернусь еще раз.",
      photos: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "positionsInput")).toBe(true);
    }
  });

  it("rejects when all three review blocks are empty", () => {
    const result = reviewFormSchema.safeParse({
      ratingValue: "3",
      positionsInput: ["americano"],
      tagsInput: "",
      liked: "",
      disliked: "",
      summary: "",
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
      liked: "Плотная текстура и сладкое послевкусие.",
      disliked: "",
      summary: "",
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

  it("parseReviewSummarySections and buildReviewSummaryFromSections work together", () => {
    const text = buildReviewSummaryFromSections({
      liked: "Быстрый сервис.",
      disliked: "",
      summary: "Лучше для короткой остановки.",
    });
    const parsed = parseReviewSummarySections(text);

    expect(parsed).toEqual({
      liked: "Быстрый сервис.",
      disliked: "",
      summary: "Лучше для короткой остановки.",
    });
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
