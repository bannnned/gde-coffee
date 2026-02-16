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

export type CafeRatingBestReview = {
  id: string;
  author_name: string;
  rating: number;
  summary: string;
  helpful_score: number;
  quality_score: number;
  visit_verified: boolean;
  created_at: string;
};

export type CafeRatingSnapshot = {
  api_contract_version: string;
  formula_versions: {
    rating: string;
    quality: string;
  };
  cafe_id: string;
  formula_version: string;
  rating: number;
  reviews_count: number;
  verified_reviews_count: number;
  verified_share: number;
  fraud_risk: number;
  best_review: CafeRatingBestReview | null;
  components: Record<string, unknown>;
  computed_at: string;
};

export type CafeRatingDiagnosticsReview = {
  review_id: string;
  author_user_id: string;
  author_name: string;
  rating: number;
  helpful_score: number;
  quality_score: number;
  author_reputation: number;
  author_rep_norm: number;
  visit_verified: boolean;
  visit_confidence: string;
  confirmed_reports: number;
  fraud_suspicion: boolean;
  summary_length: number;
  summary_excerpt: string;
  tags_count: number;
  photo_count: number;
  drink_selected: boolean;
  created_at: string;
};

export type CafeRatingDiagnostics = {
  api_contract_version: string;
  formula_versions: {
    rating: string;
    quality: string;
  };
  cafe_id: string;
  formula_version: string;
  computed_at: string;
  snapshot_rating: number;
  derived_rating: number;
  rating_delta: number;
  is_consistent: boolean;
  reviews_count: number;
  verified_reviews_count: number;
  verified_share: number;
  fraud_risk: number;
  components: Record<string, unknown>;
  best_review: CafeRatingBestReview | null;
  warnings: string[];
  reviews: CafeRatingDiagnosticsReview[];
};

export type ReviewsVersioningStatus = {
  api_contract_version: string;
  formula_versions: {
    rating: string;
    quality: string;
  };
  formula_requests: {
    rating: string;
    quality: string;
  };
  formula_fallbacks: {
    rating: boolean;
    quality: boolean;
  };
  feature_flags: {
    rating_v3_enabled: boolean;
    quality_v2_enabled: boolean;
  };
};

export type ReviewsDLQStatus = "open" | "resolved" | "all";

export type ReviewsDLQEvent = {
  id: number;
  inbox_event_id: number;
  outbox_event_id: number;
  consumer: string;
  event_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  attempts: number;
  last_error: string;
  failed_at: string;
  resolved_at: string;
};

export type ListReviewsDLQResponse = {
  status: ReviewsDLQStatus;
  limit: number;
  offset: number;
  events: ReviewsDLQEvent[];
};

export type ReplayReviewsDLQResponse = {
  dlq_event_id: number;
  inbox_event_id: number;
  outbox_event_id: number;
  consumer: string;
  event_type: string;
  was_resolved: boolean;
  replayed_at: string;
};

export type ReplayOpenReviewsDLQResponse = {
  limit: number;
  processed: number;
  replayed: number;
  failed: number;
  errors: string[];
};

export type ResolveOpenReviewsDLQResponse = {
  limit: number;
  resolved: number;
};

export type CafeReview = {
  id: string;
  user_id: string;
  author_name: string;
  author_badge?: string;
  author_trusted?: boolean;
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
  quality_formula: string;
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
  api_contract_version?: string;
  formula_versions?: {
    rating?: string;
    quality?: string;
  };
  review_id: string;
  cafe_id: string;
  event_type: string;
  created: boolean;
  updated_at: string;
};

type ListCafeReviewsResponse = {
  api_contract_version?: string;
  formula_versions?: {
    rating?: string;
    quality?: string;
  };
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
  apiContractVersion: string;
  formulaVersions: {
    rating: string;
    quality: string;
  };
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
  removal_reason?: "abuse" | "violation";
  updated_at?: string;
};

export type ReviewDeletePayload = {
  reason: "abuse" | "violation";
  details?: string;
};

export type HelpfulVoteResponse = {
  vote_id: string;
  review_id: string;
  weight: number;
  already_exists: boolean;
};

export type StartCafeCheckInPayload = {
  lat: number;
  lng: number;
  source?: string;
};

export type StartCafeCheckInResponse = {
  checkin_id: string;
  cafe_id: string;
  status: "started" | "verified" | "expired" | "rejected";
  distance_meters: number;
  min_dwell_seconds: number;
  can_verify_after: string;
  cross_cafe_cooldown?: number;
};

export type VerifyVisitPayload = {
  checkin_id?: string;
  lat?: number;
  lng?: number;
};

export type VerifyVisitResponse = {
  verification_id: string;
  review_id: string;
  confidence: "none" | "low" | "medium" | "high";
  checkin_id?: string;
  dwell_seconds?: number;
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
  payload: ReviewDeletePayload,
): Promise<ReviewDeleteResponse> {
  const res = await http.delete<ReviewDeleteResponse>(
    `/api/reviews/${encodeURIComponent(reviewId)}`,
    {
      data: payload,
    },
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

export async function startCafeCheckIn(
  cafeId: string,
  payload: StartCafeCheckInPayload,
  idempotencyKey: string = makeIdempotencyKey(),
): Promise<StartCafeCheckInResponse> {
  const res = await http.post<StartCafeCheckInResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/check-in/start`,
    payload,
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
  return res.data;
}

export async function verifyReviewVisit(
  reviewId: string,
  payload: VerifyVisitPayload,
  idempotencyKey: string = makeIdempotencyKey(),
): Promise<VerifyVisitResponse> {
  const res = await http.post<VerifyVisitResponse>(
    `/api/reviews/${encodeURIComponent(reviewId)}/visit/verify`,
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
        position: params.position,
      },
    },
  );

  if (!Array.isArray(res.data?.reviews)) {
    return {
      apiContractVersion:
        typeof res.data?.api_contract_version === "string"
          ? res.data.api_contract_version
          : "reviews_api_v1",
      formulaVersions: {
        rating:
          typeof res.data?.formula_versions?.rating === "string"
            ? res.data.formula_versions.rating
            : "rating_v2",
        quality:
          typeof res.data?.formula_versions?.quality === "string"
            ? res.data.formula_versions.quality
            : "quality_v1",
      },
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
    quality_formula:
      typeof review.quality_formula === "string" ? review.quality_formula : "quality_v1",
  }));
  return {
    apiContractVersion:
      typeof res.data?.api_contract_version === "string"
        ? res.data.api_contract_version
        : "reviews_api_v1",
    formulaVersions: {
      rating:
        typeof res.data?.formula_versions?.rating === "string"
          ? res.data.formula_versions.rating
          : "rating_v2",
      quality:
        typeof res.data?.formula_versions?.quality === "string"
          ? res.data.formula_versions.quality
          : "quality_v1",
    },
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

export async function getCafeRatingSnapshot(
  cafeId: string,
): Promise<CafeRatingSnapshot> {
  const res = await http.get(`/api/cafes/${encodeURIComponent(cafeId)}/rating`);
  const raw = res.data ?? {};
  const bestRaw = raw?.best_review ?? null;
  const bestReview =
    bestRaw && typeof bestRaw === "object"
      ? {
          id: typeof bestRaw.id === "string" ? bestRaw.id : "",
          author_name: typeof bestRaw.author_name === "string" ? bestRaw.author_name : "Участник",
          rating: Number(bestRaw.rating) || 0,
          summary: typeof bestRaw.summary === "string" ? bestRaw.summary : "",
          helpful_score: Number(bestRaw.helpful_score) || 0,
          quality_score: Number(bestRaw.quality_score) || 0,
          visit_verified: Boolean(bestRaw.visit_verified),
          created_at: typeof bestRaw.created_at === "string" ? bestRaw.created_at : "",
        }
      : null;

  return {
    api_contract_version:
      typeof raw?.api_contract_version === "string"
        ? raw.api_contract_version
        : "reviews_api_v1",
    formula_versions: {
      rating:
        typeof raw?.formula_versions?.rating === "string"
          ? raw.formula_versions.rating
          : "rating_v2",
      quality:
        typeof raw?.formula_versions?.quality === "string"
          ? raw.formula_versions.quality
          : "quality_v1",
    },
    cafe_id: typeof raw?.cafe_id === "string" ? raw.cafe_id : cafeId,
    formula_version:
      typeof raw?.formula_version === "string" ? raw.formula_version : "rating_v2",
    rating: Number(raw?.rating) || 0,
    reviews_count: Number(raw?.reviews_count) || 0,
    verified_reviews_count: Number(raw?.verified_reviews_count) || 0,
    verified_share: Number(raw?.verified_share) || 0,
    fraud_risk: Number(raw?.fraud_risk) || 0,
    best_review: bestReview,
    components:
      raw?.components && typeof raw.components === "object" && !Array.isArray(raw.components)
        ? raw.components
        : {},
    computed_at: typeof raw?.computed_at === "string" ? raw.computed_at : "",
  };
}

export async function getCafeRatingDiagnostics(
  cafeId: string,
): Promise<CafeRatingDiagnostics> {
  const res = await http.get(`/api/admin/cafes/${encodeURIComponent(cafeId)}/rating-diagnostics`);
  const raw = res.data ?? {};
  const bestRaw = raw?.best_review ?? null;
  const bestReview =
    bestRaw && typeof bestRaw === "object"
      ? {
          id: typeof bestRaw.id === "string" ? bestRaw.id : "",
          author_name: typeof bestRaw.author_name === "string" ? bestRaw.author_name : "Участник",
          rating: Number(bestRaw.rating) || 0,
          summary: typeof bestRaw.summary === "string" ? bestRaw.summary : "",
          helpful_score: Number(bestRaw.helpful_score) || 0,
          quality_score: Number(bestRaw.quality_score) || 0,
          visit_verified: Boolean(bestRaw.visit_verified),
          created_at: typeof bestRaw.created_at === "string" ? bestRaw.created_at : "",
        }
      : null;

  const reviews = Array.isArray(raw?.reviews)
    ? raw.reviews.map((item: any) => ({
        review_id: typeof item?.review_id === "string" ? item.review_id : "",
        author_user_id: typeof item?.author_user_id === "string" ? item.author_user_id : "",
        author_name: typeof item?.author_name === "string" ? item.author_name : "Участник",
        rating: Number(item?.rating) || 0,
        helpful_score: Number(item?.helpful_score) || 0,
        quality_score: Number(item?.quality_score) || 0,
        author_reputation: Number(item?.author_reputation) || 0,
        author_rep_norm: Number(item?.author_rep_norm) || 0,
        visit_verified: Boolean(item?.visit_verified),
        visit_confidence: typeof item?.visit_confidence === "string" ? item.visit_confidence : "none",
        confirmed_reports: Number(item?.confirmed_reports) || 0,
        fraud_suspicion: Boolean(item?.fraud_suspicion),
        summary_length: Number(item?.summary_length) || 0,
        summary_excerpt: typeof item?.summary_excerpt === "string" ? item.summary_excerpt : "",
        tags_count: Number(item?.tags_count) || 0,
        photo_count: Number(item?.photo_count) || 0,
        drink_selected: Boolean(item?.drink_selected),
        created_at: typeof item?.created_at === "string" ? item.created_at : "",
      }))
    : [];

  return {
    api_contract_version:
      typeof raw?.api_contract_version === "string"
        ? raw.api_contract_version
        : "reviews_api_v1",
    formula_versions: {
      rating:
        typeof raw?.formula_versions?.rating === "string"
          ? raw.formula_versions.rating
          : "rating_v2",
      quality:
        typeof raw?.formula_versions?.quality === "string"
          ? raw.formula_versions.quality
          : "quality_v1",
    },
    cafe_id: typeof raw?.cafe_id === "string" ? raw.cafe_id : cafeId,
    formula_version:
      typeof raw?.formula_version === "string" ? raw.formula_version : "rating_v2",
    computed_at: typeof raw?.computed_at === "string" ? raw.computed_at : "",
    snapshot_rating: Number(raw?.snapshot_rating) || 0,
    derived_rating: Number(raw?.derived_rating) || 0,
    rating_delta: Number(raw?.rating_delta) || 0,
    is_consistent: Boolean(raw?.is_consistent),
    reviews_count: Number(raw?.reviews_count) || 0,
    verified_reviews_count: Number(raw?.verified_reviews_count) || 0,
    verified_share: Number(raw?.verified_share) || 0,
    fraud_risk: Number(raw?.fraud_risk) || 0,
    components:
      raw?.components && typeof raw.components === "object" && !Array.isArray(raw.components)
        ? raw.components
        : {},
    best_review: bestReview,
    warnings: Array.isArray(raw?.warnings)
      ? raw.warnings.filter((item: unknown): item is string => typeof item === "string")
      : [],
    reviews,
  };
}

export async function getReviewsVersioningStatus(): Promise<ReviewsVersioningStatus> {
  const res = await http.get("/api/admin/reviews/versioning");
  const raw = res.data ?? {};

  return {
    api_contract_version:
      typeof raw?.api_contract_version === "string"
        ? raw.api_contract_version
        : "reviews_api_v1",
    formula_versions: {
      rating:
        typeof raw?.formula_versions?.rating === "string"
          ? raw.formula_versions.rating
          : "rating_v2",
      quality:
        typeof raw?.formula_versions?.quality === "string"
          ? raw.formula_versions.quality
          : "quality_v1",
    },
    formula_requests: {
      rating:
        typeof raw?.formula_requests?.rating === "string"
          ? raw.formula_requests.rating
          : "rating_v2",
      quality:
        typeof raw?.formula_requests?.quality === "string"
          ? raw.formula_requests.quality
          : "quality_v1",
    },
    formula_fallbacks: {
      rating: Boolean(raw?.formula_fallbacks?.rating),
      quality: Boolean(raw?.formula_fallbacks?.quality),
    },
    feature_flags: {
      rating_v3_enabled: Boolean(raw?.feature_flags?.rating_v3_enabled),
      quality_v2_enabled: Boolean(raw?.feature_flags?.quality_v2_enabled),
    },
  };
}

export async function listReviewsDLQ(params: {
  status?: ReviewsDLQStatus;
  limit?: number;
  offset?: number;
} = {}): Promise<ListReviewsDLQResponse> {
  const res = await http.get("/api/admin/reviews/dlq", {
    params: {
      status: params.status ?? "open",
      limit: params.limit,
      offset: params.offset,
    },
  });
  const raw = res.data ?? {};
  const rawEvents = Array.isArray(raw?.events) ? raw.events : [];
  const events = rawEvents.map((item: any): ReviewsDLQEvent => ({
    id: Number(item?.id) || 0,
    inbox_event_id: Number(item?.inbox_event_id) || 0,
    outbox_event_id: Number(item?.outbox_event_id) || 0,
    consumer: typeof item?.consumer === "string" ? item.consumer : "",
    event_type: typeof item?.event_type === "string" ? item.event_type : "",
    aggregate_id: typeof item?.aggregate_id === "string" ? item.aggregate_id : "",
    payload:
      item?.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
        ? item.payload
        : {},
    attempts: Number(item?.attempts) || 0,
    last_error: typeof item?.last_error === "string" ? item.last_error : "",
    failed_at: typeof item?.failed_at === "string" ? item.failed_at : "",
    resolved_at: typeof item?.resolved_at === "string" ? item.resolved_at : "",
  }));

  const statusRaw = typeof raw?.status === "string" ? raw.status : "open";
  const status: ReviewsDLQStatus =
    statusRaw === "resolved" || statusRaw === "all" ? statusRaw : "open";
  return {
    status,
    limit: Number(raw?.limit) || params.limit || 30,
    offset: Number(raw?.offset) || params.offset || 0,
    events,
  };
}

export async function replayReviewsDLQEvent(
  dlqEventID: number,
): Promise<ReplayReviewsDLQResponse> {
  const res = await http.post(`/api/admin/reviews/dlq/${encodeURIComponent(String(dlqEventID))}/replay`);
  const raw = res.data ?? {};
  return {
    dlq_event_id: Number(raw?.dlq_event_id) || 0,
    inbox_event_id: Number(raw?.inbox_event_id) || 0,
    outbox_event_id: Number(raw?.outbox_event_id) || 0,
    consumer: typeof raw?.consumer === "string" ? raw.consumer : "",
    event_type: typeof raw?.event_type === "string" ? raw.event_type : "",
    was_resolved: Boolean(raw?.was_resolved),
    replayed_at: typeof raw?.replayed_at === "string" ? raw.replayed_at : "",
  };
}

export async function replayAllOpenReviewsDLQ(
  limit?: number,
): Promise<ReplayOpenReviewsDLQResponse> {
  const res = await http.post("/api/admin/reviews/dlq/replay-open", null, {
    params: {
      limit,
    },
  });
  const raw = res.data ?? {};
  return {
    limit: Number(raw?.limit) || 0,
    processed: Number(raw?.processed) || 0,
    replayed: Number(raw?.replayed) || 0,
    failed: Number(raw?.failed) || 0,
    errors: Array.isArray(raw?.errors)
      ? raw.errors.filter((item: unknown): item is string => typeof item === "string")
      : [],
  };
}

export async function resolveOpenReviewsDLQWithoutReplay(
  limit?: number,
): Promise<ResolveOpenReviewsDLQResponse> {
  const res = await http.post("/api/admin/reviews/dlq/resolve-open", null, {
    params: {
      limit,
    },
  });
  const raw = res.data ?? {};
  return {
    limit: Number(raw?.limit) || 0,
    resolved: Number(raw?.resolved) || 0,
  };
}
