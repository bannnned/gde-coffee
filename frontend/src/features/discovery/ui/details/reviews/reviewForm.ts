import { z } from "zod";

export type FormPhoto = {
  id: string;
  url: string;
  objectKey: string;
};

export const MAX_REVIEW_PHOTOS = 8;
export const MAX_REVIEW_POSITIONS = 8;
export const MAX_UPLOAD_CONCURRENCY = 3;
export const REVIEWS_PAGE_SIZE = 20;
export const DRINK_SUGGESTIONS_LIMIT = 12;

export type ReviewSummarySections = {
  liked: string;
  improve: string;
};

const formPhotoSchema = z.object({
  id: z.string(),
  url: z.string().min(1),
  objectKey: z.string(),
});

export const reviewFormSchema = z
  .object({
    ratingValue: z.enum(["1", "2", "3", "4", "5"]),
    positionsInput: z.array(z.string()).max(MAX_REVIEW_POSITIONS),
    tagsInput: z.string(),
    liked: z.string(),
    improve: z.string(),
    photos: z.array(formPhotoSchema).max(MAX_REVIEW_PHOTOS),
  })
  .superRefine((value, ctx) => {
    const positions = parseReviewPositions(value.positionsInput);
    if (positions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["positionsInput"],
        message: "Добавьте хотя бы один напиток.",
      });
    }

    if (value.liked.trim().length === 0 && value.improve.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["improve"],
        message: "Заполните хотя бы одно поле: понравилось или что улучшить.",
      });
    }
  });

export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

export const DEFAULT_REVIEW_FORM_VALUES: ReviewFormValues = {
  ratingValue: "5",
  positionsInput: [],
  tagsInput: "",
  liked: "",
  improve: "",
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

export function parseReviewPositions(values: string[]): string[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  const seen = new Set<string>();
  const parsed: string[] = [];
  for (const value of values) {
    const normalized = normalizeDrinkInput(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    parsed.push(normalized);
    if (parsed.length >= MAX_REVIEW_POSITIONS) break;
  }
  return parsed;
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

function stripSectionPrefix(value: string): string {
  return value
    .replace(/^(что\s*понравил[ао]с[ья]|понравилось|плюсы?|liked)\s*[:-]?\s*/i, "")
    .replace(/^(что\s*улучшить|что\s*можно\s*улучшить|улучшить|could\s*improve|improve)\s*[:-]?\s*/i, "")
    .replace(/^(что\s*не\s*понравил[ао]с[ья]|не\s*понравилось|минусы?|disliked)\s*[:-]?\s*/i, "")
    .replace(/^(короткий\s*вывод|вывод|для\s*кого\s*место|кому\s*подойдет|summary)\s*[:-]?\s*/i, "")
    .trim();
}

export function parseReviewSummarySections(summaryRaw: string): ReviewSummarySections {
  const normalized = summaryRaw.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return {
      liked: "",
      improve: "",
    };
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: Record<keyof ReviewSummarySections, string[]> = {
    liked: [],
    improve: [],
  };
  const legacySummary: string[] = [];
  let activeSection: keyof ReviewSummarySections | "legacySummary" | null = null;

  for (const line of lines) {
    if (/^(что\s*понравил[ао]с[ья]|понравилось|плюсы?|liked)/i.test(line)) {
      activeSection = "liked";
      const clean = stripSectionPrefix(line);
      if (clean) sections.liked.push(clean);
      continue;
    }
    if (
      /^(что\s*улучшить|что\s*можно\s*улучшить|улучшить|could\s*improve|improve|что\s*не\s*понравил[ао]с[ья]|не\s*понравилось|минусы?|disliked)/i.test(
        line,
      )
    ) {
      activeSection = "improve";
      const clean = stripSectionPrefix(line);
      if (clean) sections.improve.push(clean);
      continue;
    }
    if (/^(короткий\s*вывод|вывод|для\s*кого\s*место|кому\s*подойдет|summary)/i.test(line)) {
      activeSection = "legacySummary";
      const clean = stripSectionPrefix(line);
      if (clean) legacySummary.push(clean);
      continue;
    }
    if (activeSection) {
      if (activeSection === "legacySummary") {
        legacySummary.push(line);
      } else {
        sections[activeSection].push(line);
      }
    }
  }

  const hasLabeledSections = sections.liked.length > 0 || sections.improve.length > 0 || legacySummary.length > 0;
  if (hasLabeledSections) {
    const improve = sections.improve.join(" ").trim();
    const legacy = legacySummary.join(" ").trim();
    return {
      liked: sections.liked.join(" ").trim(),
      improve: improve || legacy,
    };
  }

  return {
    liked: lines[0] ?? "",
    improve: lines.slice(1).join(" ").trim(),
  };
}

export function buildReviewSummaryFromSections(sections: ReviewSummarySections): string {
  const liked = sections.liked.trim();
  const improve = sections.improve.trim();

  const lines: string[] = [];
  if (liked) lines.push(`Понравилось: ${liked}`);
  if (improve) lines.push(`Что улучшить: ${improve}`);
  return lines.join("\n");
}
