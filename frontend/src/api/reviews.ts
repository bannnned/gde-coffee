import { http } from "./http";

export type ReviewSort = "new" | "helpful" | "verified";

export type CafeReview = {
  id: string;
  user_id: string;
  author_name: string;
  rating: number;
  summary: string;
  drink_id: string;
  taste_tags: string[];
  photos: string[];
  photo_count: number;
  helpful_votes: number;
  helpful_score: number;
  visit_confidence: string;
  visit_verified: boolean;
  quality_score: number;
  confirmed_reports: number;
  created_at: string;
  updated_at: string;
};

export type ReviewWritePayload = {
  rating: number;
  drink_id: string;
  taste_tags?: string[];
  summary: string;
  photos?: string[];
};

export type CreateReviewPayload = ReviewWritePayload & {
  cafe_id: string;
};

export type UpdateReviewPayload = Partial<ReviewWritePayload>;

export type ReviewMutationResponse = {
  review_id: string;
  cafe_id: string;
  event_type: string;
  created: boolean;
  updated_at: string;
};

type ListCafeReviewsResponse = {
  reviews?: CafeReview[];
};

function makeIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function createReview(
  payload: CreateReviewPayload,
  idempotencyKey: string = makeIdempotencyKey(),
): Promise<ReviewMutationResponse> {
  const res = await http.post<ReviewMutationResponse>("/api/reviews", payload, {
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
  return res.data;
}

export async function updateReview(
  reviewId: string,
  payload: UpdateReviewPayload,
  idempotencyKey: string = makeIdempotencyKey(),
): Promise<ReviewMutationResponse> {
  const res = await http.patch<ReviewMutationResponse>(
    `/api/reviews/${encodeURIComponent(reviewId)}`,
    payload,
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
  return res.data;
}

export async function listCafeReviews(
  cafeId: string,
  sort: ReviewSort = "new",
): Promise<CafeReview[]> {
  const res = await http.get<ListCafeReviewsResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/reviews`,
    {
      params: {
        sort,
      },
    },
  );

  if (!Array.isArray(res.data?.reviews)) {
    return [];
  }
  return res.data.reviews;
}
