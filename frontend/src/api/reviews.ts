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

export type CafeSemanticTag = {
  key: string;
  label: string;
  type: string;
  category: string;
  score: number;
  support_count: number;
  source: string;
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
  descriptive_tags: CafeSemanticTag[];
  specific_tags: CafeSemanticTag[];
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
  ai_summary: CafeAISummaryDiagnostics | null;
  descriptive_tags_source: string;
  warnings: string[];
  reviews: CafeRatingDiagnosticsReview[];
};

export type CafeAISummaryDiagnostics = {
  enabled: boolean;
  status: string;
  reason?: string;
  summary_short?: string;
  tags?: string[];
  used_reviews?: number;
  generated_at?: string;
  generated_reviews_count?: number;
  next_threshold_reviews?: number;
  last_generated_at?: string;
  stale_notice?: string;
  force?: boolean;
};

export type TriggerCafeAISummaryResponse = {
  cafe_id: string;
  trigger: string;
  descriptive_tags_source: string;
  ai_summary: CafeAISummaryDiagnostics | null;
  computed_at: string;
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
  specific_tags?: string[];
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

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): RawRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === "string");
}

function parseFormulaVersions(raw: RawRecord): { rating: string; quality: string } {
  const formulaVersions = asRecord(raw.formula_versions);
  return {
    rating: asString(formulaVersions.rating, "rating_v2"),
    quality: asString(formulaVersions.quality, "quality_v1"),
  };
}

function parseBestReview(rawValue: unknown): CafeRatingBestReview | null {
  if (!isRecord(rawValue)) return null;
  return {
    id: asString(rawValue.id),
    author_name: asString(rawValue.author_name, "Участник"),
    rating: asNumber(rawValue.rating),
    summary: asString(rawValue.summary),
    helpful_score: asNumber(rawValue.helpful_score),
    quality_score: asNumber(rawValue.quality_score),
    visit_verified: Boolean(rawValue.visit_verified),
    created_at: asString(rawValue.created_at),
  };
}

function parseCafeSemanticTag(rawValue: unknown): CafeSemanticTag | null {
  if (!isRecord(rawValue)) return null;
  const key = asString(rawValue.key).trim();
  const label = asString(rawValue.label).trim();
  if (!key || !label) return null;
  return {
    key,
    label,
    type: asString(rawValue.type, "specific"),
    category: asString(rawValue.category, "other"),
    score: asNumber(rawValue.score),
    support_count: asNumber(rawValue.support_count),
    source: asString(rawValue.source, "rules_v1"),
  };
}

function parseCafeSemanticTags(rawValue: unknown): CafeSemanticTag[] {
  return asArray(rawValue)
    .map(parseCafeSemanticTag)
    .filter((item): item is CafeSemanticTag => Boolean(item));
}

function parseDiagnosticsReview(rawValue: unknown): CafeRatingDiagnosticsReview {
  const raw = asRecord(rawValue);
  return {
    review_id: asString(raw.review_id),
    author_user_id: asString(raw.author_user_id),
    author_name: asString(raw.author_name, "Участник"),
    rating: asNumber(raw.rating),
    helpful_score: asNumber(raw.helpful_score),
    quality_score: asNumber(raw.quality_score),
    author_reputation: asNumber(raw.author_reputation),
    author_rep_norm: asNumber(raw.author_rep_norm),
    visit_verified: Boolean(raw.visit_verified),
    visit_confidence: asString(raw.visit_confidence, "none"),
    confirmed_reports: asNumber(raw.confirmed_reports),
    fraud_suspicion: Boolean(raw.fraud_suspicion),
    summary_length: asNumber(raw.summary_length),
    summary_excerpt: asString(raw.summary_excerpt),
    tags_count: asNumber(raw.tags_count),
    photo_count: asNumber(raw.photo_count),
    drink_selected: Boolean(raw.drink_selected),
    created_at: asString(raw.created_at),
  };
}

function parseAISummaryDiagnostics(rawValue: unknown): CafeAISummaryDiagnostics | null {
  const raw = asRecord(rawValue);
  if (Object.keys(raw).length === 0) return null;
  return {
    enabled: Boolean(raw.enabled),
    status: asString(raw.status, "unknown"),
    reason: asString(raw.reason),
    summary_short: asString(raw.summary_short),
    tags: asStringArray(raw.tags),
    used_reviews: asNumber(raw.used_reviews),
    generated_at: asString(raw.generated_at),
    generated_reviews_count: asNumber(raw.generated_reviews_count),
    next_threshold_reviews: asNumber(raw.next_threshold_reviews),
    last_generated_at: asString(raw.last_generated_at),
    stale_notice: asString(raw.stale_notice),
    force: Boolean(raw.force),
  };
}

function parseDLQEvent(rawValue: unknown): ReviewsDLQEvent {
  const raw = asRecord(rawValue);
  const payloadRaw = asRecord(raw.payload);
  return {
    id: asNumber(raw.id),
    inbox_event_id: asNumber(raw.inbox_event_id),
    outbox_event_id: asNumber(raw.outbox_event_id),
    consumer: asString(raw.consumer),
    event_type: asString(raw.event_type),
    aggregate_id: asString(raw.aggregate_id),
    payload: payloadRaw,
    attempts: asNumber(raw.attempts),
    last_error: asString(raw.last_error),
    failed_at: asString(raw.failed_at),
    resolved_at: asString(raw.resolved_at),
  };
}

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
  const reviews = res.data.reviews.map((review) => {
    const specificTags = Array.isArray((review as { specific_tags?: unknown }).specific_tags)
      ? ((review as { specific_tags?: unknown[] }).specific_tags ?? []).filter(
          (item): item is string => typeof item === "string",
        )
      : Array.isArray(review.taste_tags)
        ? review.taste_tags
        : [];
    return {
      ...review,
      positions: Array.isArray(review.positions) ? review.positions : [],
      taste_tags: Array.isArray(review.taste_tags) ? review.taste_tags : [],
      specific_tags: specificTags,
      quality_formula:
        typeof review.quality_formula === "string" ? review.quality_formula : "quality_v1",
    };
  });
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
  const res = await http.get<unknown>(`/api/cafes/${encodeURIComponent(cafeId)}/rating`);
  const raw = asRecord(res.data);
  return {
    api_contract_version: asString(raw.api_contract_version, "reviews_api_v1"),
    formula_versions: parseFormulaVersions(raw),
    cafe_id: asString(raw.cafe_id, cafeId),
    formula_version: asString(raw.formula_version, "rating_v2"),
    rating: asNumber(raw.rating),
    reviews_count: asNumber(raw.reviews_count),
    verified_reviews_count: asNumber(raw.verified_reviews_count),
    verified_share: asNumber(raw.verified_share),
    fraud_risk: asNumber(raw.fraud_risk),
    best_review: parseBestReview(raw.best_review),
    descriptive_tags: parseCafeSemanticTags(raw.descriptive_tags),
    specific_tags: parseCafeSemanticTags(raw.specific_tags),
    components: asRecord(raw.components),
    computed_at: asString(raw.computed_at),
  };
}

export async function getCafeRatingDiagnostics(
  cafeId: string,
): Promise<CafeRatingDiagnostics> {
  const res = await http.get<unknown>(
    `/api/admin/cafes/${encodeURIComponent(cafeId)}/rating-diagnostics`,
  );
  const raw = asRecord(res.data);
  const reviews = asArray(raw.reviews).map(parseDiagnosticsReview);

  return {
    api_contract_version: asString(raw.api_contract_version, "reviews_api_v1"),
    formula_versions: parseFormulaVersions(raw),
    cafe_id: asString(raw.cafe_id, cafeId),
    formula_version: asString(raw.formula_version, "rating_v2"),
    computed_at: asString(raw.computed_at),
    snapshot_rating: asNumber(raw.snapshot_rating),
    derived_rating: asNumber(raw.derived_rating),
    rating_delta: asNumber(raw.rating_delta),
    is_consistent: Boolean(raw.is_consistent),
    reviews_count: asNumber(raw.reviews_count),
    verified_reviews_count: asNumber(raw.verified_reviews_count),
    verified_share: asNumber(raw.verified_share),
    fraud_risk: asNumber(raw.fraud_risk),
    components: asRecord(raw.components),
    best_review: parseBestReview(raw.best_review),
    ai_summary: parseAISummaryDiagnostics(raw.ai_summary),
    descriptive_tags_source: asString(raw.descriptive_tags_source, "rules_v1"),
    warnings: asStringArray(raw.warnings),
    reviews,
  };
}

export async function triggerCafeAISummary(
  cafeId: string,
): Promise<TriggerCafeAISummaryResponse> {
  const res = await http.post<unknown>(
    `/api/admin/cafes/${encodeURIComponent(cafeId)}/rating-ai-summarize`,
  );
  const raw = asRecord(res.data);
  return {
    cafe_id: asString(raw.cafe_id, cafeId),
    trigger: asString(raw.trigger, "admin_manual"),
    descriptive_tags_source: asString(raw.descriptive_tags_source, "rules_v1"),
    ai_summary: parseAISummaryDiagnostics(raw.ai_summary),
    computed_at: asString(raw.computed_at),
  };
}

export async function getReviewsVersioningStatus(): Promise<ReviewsVersioningStatus> {
  const res = await http.get<unknown>("/api/admin/reviews/versioning");
  const raw = asRecord(res.data);
  const formulaRequests = asRecord(raw.formula_requests);
  const formulaFallbacks = asRecord(raw.formula_fallbacks);
  const featureFlags = asRecord(raw.feature_flags);

  return {
    api_contract_version: asString(raw.api_contract_version, "reviews_api_v1"),
    formula_versions: parseFormulaVersions(raw),
    formula_requests: {
      rating: asString(formulaRequests.rating, "rating_v2"),
      quality: asString(formulaRequests.quality, "quality_v1"),
    },
    formula_fallbacks: {
      rating: asBoolean(formulaFallbacks.rating),
      quality: asBoolean(formulaFallbacks.quality),
    },
    feature_flags: {
      rating_v3_enabled: asBoolean(featureFlags.rating_v3_enabled),
      quality_v2_enabled: asBoolean(featureFlags.quality_v2_enabled),
    },
  };
}

export async function listReviewsDLQ(params: {
  status?: ReviewsDLQStatus;
  limit?: number;
  offset?: number;
} = {}): Promise<ListReviewsDLQResponse> {
  const res = await http.get<unknown>("/api/admin/reviews/dlq", {
    params: {
      status: params.status ?? "open",
      limit: params.limit,
      offset: params.offset,
    },
  });
  const raw = asRecord(res.data);
  const events = asArray(raw.events).map(parseDLQEvent);
  const statusRaw = asString(raw.status, "open");
  const status: ReviewsDLQStatus =
    statusRaw === "resolved" || statusRaw === "all" ? statusRaw : "open";
  return {
    status,
    limit: asNumber(raw.limit, params.limit ?? 30),
    offset: asNumber(raw.offset, params.offset ?? 0),
    events,
  };
}

export async function replayReviewsDLQEvent(
  dlqEventID: number,
): Promise<ReplayReviewsDLQResponse> {
  const res = await http.post<unknown>(
    `/api/admin/reviews/dlq/${encodeURIComponent(String(dlqEventID))}/replay`,
  );
  const raw = asRecord(res.data);
  return {
    dlq_event_id: asNumber(raw.dlq_event_id),
    inbox_event_id: asNumber(raw.inbox_event_id),
    outbox_event_id: asNumber(raw.outbox_event_id),
    consumer: asString(raw.consumer),
    event_type: asString(raw.event_type),
    was_resolved: asBoolean(raw.was_resolved),
    replayed_at: asString(raw.replayed_at),
  };
}

export async function replayAllOpenReviewsDLQ(
  limit?: number,
): Promise<ReplayOpenReviewsDLQResponse> {
  const res = await http.post<unknown>("/api/admin/reviews/dlq/replay-open", null, {
    params: {
      limit,
    },
  });
  const raw = asRecord(res.data);
  return {
    limit: asNumber(raw.limit),
    processed: asNumber(raw.processed),
    replayed: asNumber(raw.replayed),
    failed: asNumber(raw.failed),
    errors: asStringArray(raw.errors),
  };
}

export async function resolveOpenReviewsDLQWithoutReplay(
  limit?: number,
): Promise<ResolveOpenReviewsDLQResponse> {
  const res = await http.post<unknown>("/api/admin/reviews/dlq/resolve-open", null, {
    params: {
      limit,
    },
  });
  const raw = asRecord(res.data);
  return {
    limit: asNumber(raw.limit),
    resolved: asNumber(raw.resolved),
  };
}
