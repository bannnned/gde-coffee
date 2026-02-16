import { http } from "./http";
import { uploadByPresignedUrl } from "./presignedUpload";

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
  has_more?: boolean;
  next_cursor?: string;
};

export type ListCafeReviewsParams = {
  sort?: ReviewSort;
  cursor?: string;
  limit?: number;
};

export type ListCafeReviewsResult = {
  reviews: CafeReview[];
  hasMore: boolean;
  nextCursor: string;
};

export type ReviewPhotoPresignPayload = {
  contentType: string;
  sizeBytes: number;
};

export type ReviewPhotoPresignResponse = {
  upload_url: string;
  method: string;
  headers: Record<string, string>;
  object_key: string;
  file_url: string;
  expires_at: string;
};

export type ReviewPhotoConfirmResponse = {
  object_key: string;
  file_url: string;
  mime_type: string;
  size_bytes: number;
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
  params: ListCafeReviewsParams = {},
): Promise<ListCafeReviewsResult> {
  const sort = params.sort ?? "new";
  const res = await http.get<ListCafeReviewsResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/reviews`,
    {
      params: {
        sort,
        cursor: params.cursor,
        limit: params.limit,
      },
    },
  );

  if (!Array.isArray(res.data?.reviews)) {
    return {
      reviews: [],
      hasMore: false,
      nextCursor: "",
    };
  }
  return {
    reviews: res.data.reviews,
    hasMore: Boolean(res.data?.has_more),
    nextCursor: typeof res.data?.next_cursor === "string" ? res.data.next_cursor : "",
  };
}

export async function presignReviewPhotoUpload(
  payload: ReviewPhotoPresignPayload,
): Promise<ReviewPhotoPresignResponse> {
  const res = await http.post<ReviewPhotoPresignResponse>("/api/reviews/photos/presign", {
    content_type: payload.contentType,
    size_bytes: payload.sizeBytes,
  });
  return res.data;
}

export async function uploadReviewPhotoByPresignedUrl(
  uploadUrl: string,
  file: File,
  headers: Record<string, string>,
): Promise<void> {
  await uploadByPresignedUrl(uploadUrl, file, headers);
}

export async function confirmReviewPhotoUpload(
  objectKey: string,
): Promise<ReviewPhotoConfirmResponse> {
  const res = await http.post<ReviewPhotoConfirmResponse>("/api/reviews/photos/confirm", {
    object_key: objectKey,
  });
  return res.data;
}
