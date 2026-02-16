import { z } from "zod";

export type FormPhoto = {
  id: string;
  url: string;
  objectKey: string;
};

export const MIN_SUMMARY_LENGTH = 60;
export const MAX_REVIEW_PHOTOS = 8;
export const MAX_UPLOAD_CONCURRENCY = 3;
export const REVIEWS_PAGE_SIZE = 20;
export const DRINK_SUGGESTIONS_LIMIT = 12;

const formPhotoSchema = z.object({
  id: z.string(),
  url: z.string().min(1),
  objectKey: z.string(),
});

export const reviewFormSchema = z
  .object({
    ratingValue: z.enum(["1", "2", "3", "4", "5"]),
    drinkId: z.string(),
    drinkQuery: z.string(),
    tagsInput: z.string(),
    summary: z.string(),
    photos: z.array(formPhotoSchema).max(MAX_REVIEW_PHOTOS),
  })
  .superRefine((value, ctx) => {
    // Cross-field rule: the user must either select a known drink ID
    // or provide a valid free-form drink name for unknown formats.
    const hasDrinkId = value.drinkId.trim().length > 0;
    const normalizedDrinkName = normalizeDrinkInput(value.drinkQuery);
    if (!hasDrinkId && normalizedDrinkName.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["drinkQuery"],
        message: "Укажите напиток: выберите из подсказок или введите новый.",
      });
    }

    if (value.summary.trim().length < MIN_SUMMARY_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["summary"],
        message: `Короткий вывод должен быть не короче ${MIN_SUMMARY_LENGTH} символов.`,
      });
    }
  });

export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

export const DEFAULT_REVIEW_FORM_VALUES: ReviewFormValues = {
  ratingValue: "5",
  drinkId: "",
  drinkQuery: "",
  tagsInput: "",
  summary: "",
  photos: [],
};

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;

  const runners = Array.from({ length: safeConcurrency }, async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) return;
      await worker(items[current], current);
    }
  });

  await Promise.all(runners);
}

export function makePhotoId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseTags(value: string): string[] {
  if (!value.trim()) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value.split(/[\n,]/g)) {
    const tag = raw.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 10) break;
  }
  return tags;
}

export function normalizeDrinkInput(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

export function formatReviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
