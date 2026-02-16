import { http } from "./http";
import { uploadByPresignedUrl } from "./presignedUpload";

export type ReviewSort = "new" | "helpful" | "verified";

export type ReviewPosition = {
  position: number;
  drink_id: string;
  drink_name: string;
};

export type ReviewPositionOption = {
  key: string;
  label: string;
  reviews_count: number;
};

export type CafeReview = {
  id: string;
  user_id: string;
  author_name: string;
  rating: number;
  summary: string;
  drink_id: string;
  drink_name: string;
  positions: ReviewPosition[];
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

export type ReviewWritePosition = {
  drink_id?: string;
  drink?: string;
};

export type ReviewWritePayload = {
  rating: number;
  drink_id?: string;
  drink?: string;
  positions?: ReviewWritePosition[];
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
  position?: string;
  position_options?: ReviewPositionOption[];
};

export type ListCafeReviewsParams = {
  sort?: ReviewSort;
  cursor?: string;
  limit?: number;
  position?: string;
};

export type ListCafeReviewsResult = {
  reviews: CafeReview[];
  hasMore: boolean;
  nextCursor: string;
  position: string;
  positionOptions: ReviewPositionOption[];
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
  photo_id?: string;
  status?: "pending" | "processing" | "ready" | "failed";
  object_key?: string;
  file_url?: string;
  mime_type?: string;
  size_bytes?: number;
  retry_after_ms?: number;
  error?: string;
};

export type ReviewDeleteResponse = {
  review_id: string;
  cafe_id: string;
  event_type?: string;
  removed: boolean;
  updated_at?: string;
};

export type HelpfulVoteResponse = {
  vote_id: string;
  review_id: string;
  weight: number;
  already_exists: boolean;
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

export async function deleteReview(
  reviewId: string,
): Promise<ReviewDeleteResponse> {
  const res = await http.delete<ReviewDeleteResponse>(
    `/api/reviews/${encodeURIComponent(reviewId)}`,
  );
  return res.data;
}

export async function addHelpfulVote(
  reviewId: string,
  idempotencyKey: string = makeIdempotencyKey(),
): Promise<HelpfulVoteResponse> {
  const res = await http.post<HelpfulVoteResponse>(
    `/api/reviews/${encodeURIComponent(reviewId)}/helpful`,
    {},
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
        position: params.position,
      },
    },
  );

  if (!Array.isArray(res.data?.reviews)) {
    return {
      reviews: [],
      hasMore: false,
      nextCursor: "",
      position: "",
      positionOptions: [],
    };
  }
  const reviews = res.data.reviews.map((review) => ({
    ...review,
    positions: Array.isArray(review.positions) ? review.positions : [],
  }));
  return {
    reviews,
    hasMore: Boolean(res.data?.has_more),
    nextCursor: typeof res.data?.next_cursor === "string" ? res.data.next_cursor : "",
    position: typeof res.data?.position === "string" ? res.data.position : "",
    positionOptions: Array.isArray(res.data?.position_options) ? res.data.position_options : [],
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

export async function getReviewPhotoStatus(
  photoID: string,
): Promise<ReviewPhotoConfirmResponse> {
  const res = await http.get<ReviewPhotoConfirmResponse>(
    `/api/reviews/photos/${encodeURIComponent(photoID)}/status`,
  );
  return res.data;
}
