/* @vitest-environment jsdom */

import type { FormEvent } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReviewsSectionController } from "./useReviewsSectionController";

vi.mock("../../../../../api/drinks", () => ({
  searchDrinks: vi.fn(),
}));

vi.mock("../../../../../api/reviews", () => ({
  addHelpfulVote: vi.fn(),
  listCafeReviews: vi.fn(),
  createReview: vi.fn(),
  updateReview: vi.fn(),
  deleteReview: vi.fn(),
  startCafeCheckIn: vi.fn(),
  verifyReviewVisit: vi.fn(),
  getReviewPhotoStatus: vi.fn(),
  presignReviewPhotoUpload: vi.fn(),
  uploadReviewPhotoByPresignedUrl: vi.fn(),
  confirmReviewPhotoUpload: vi.fn(),
}));

vi.mock("../../../../../components/AuthGate", () => ({
  useAuth: vi.fn(),
}));

import { searchDrinks } from "../../../../../api/drinks";
import {
  addHelpfulVote,
  confirmReviewPhotoUpload,
  createReview,
  deleteReview,
  getReviewPhotoStatus,
  listCafeReviews,
  presignReviewPhotoUpload,
  startCafeCheckIn,
  updateReview,
  uploadReviewPhotoByPresignedUrl,
  verifyReviewVisit,
  type CafeReview,
} from "../../../../../api/reviews";
import { useAuth } from "../../../../../components/AuthGate";

const mockSearchDrinks = vi.mocked(searchDrinks);
const mockAddHelpfulVote = vi.mocked(addHelpfulVote);
const mockListCafeReviews = vi.mocked(listCafeReviews);
const mockCreateReview = vi.mocked(createReview);
const mockUpdateReview = vi.mocked(updateReview);
const mockDeleteReview = vi.mocked(deleteReview);
const mockStartCafeCheckIn = vi.mocked(startCafeCheckIn);
const mockVerifyReviewVisit = vi.mocked(verifyReviewVisit);
const mockGetReviewPhotoStatus = vi.mocked(getReviewPhotoStatus);
const mockPresignReviewPhotoUpload = vi.mocked(presignReviewPhotoUpload);
const mockUploadReviewPhotoByPresignedUrl = vi.mocked(uploadReviewPhotoByPresignedUrl);
const mockConfirmReviewPhotoUpload = vi.mocked(confirmReviewPhotoUpload);
const mockUseAuth = vi.mocked(useAuth);
type AuthContextMock = ReturnType<typeof useAuth>;

function makeAuthContext(overrides: Partial<AuthContextMock> = {}): AuthContextMock {
  return {
    user: null,
    status: "authed",
    logout: vi.fn(async () => {}),
    refreshAuth: vi.fn(async () => {}),
    openAuthModal: vi.fn(),
    closeAuthModal: vi.fn(),
    isAuthModalOpen: false,
    ...overrides,
  };
}

function makeReview(overrides: Partial<CafeReview> = {}): CafeReview {
  return {
    id: "review-1",
    user_id: "user-1",
    author_name: "User",
    rating: 5,
    summary:
      "Очень стабильная чашка с чистой кислотностью, плотным телом и длинным сладким послевкусием без горечи.",
    drink_id: "espresso",
    drink_name: "эспрессо",
    positions: [{ position: 1, drink_id: "espresso", drink_name: "эспрессо" }],
    taste_tags: ["шоколад", "орех"],
    photos: [],
    photo_count: 0,
    helpful_votes: 3,
    helpful_score: 3,
    visit_confidence: "high",
    visit_verified: true,
    quality_score: 82,
    confirmed_reports: 0,
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-01T10:00:00Z",
    ...overrides,
  };
}

function fileListFrom(files: File[]): FileList {
  const fileList: Partial<FileList> = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
  };
  for (const [index, file] of files.entries()) {
    Object.defineProperty(fileList, index, {
      configurable: true,
      enumerable: true,
      value: file,
    });
  }
  return fileList as FileList;
}

describe("useReviewsSectionController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchDrinks.mockResolvedValue([]);
    mockListCafeReviews.mockResolvedValue({ reviews: [], hasMore: false, nextCursor: "", position: "", positionOptions: [] });
    mockAddHelpfulVote.mockResolvedValue({
      vote_id: "vote-1",
      review_id: "review-1",
      weight: 0.91,
      already_exists: false,
    });
    mockCreateReview.mockResolvedValue({
      review_id: "new-review",
      cafe_id: "cafe-1",
      event_type: "review.created",
      created: true,
      updated_at: "2026-01-01T10:00:00Z",
    });
    mockUpdateReview.mockResolvedValue({
      review_id: "review-1",
      cafe_id: "cafe-1",
      event_type: "review.updated",
      created: false,
      updated_at: "2026-01-01T10:00:00Z",
    });
    mockDeleteReview.mockResolvedValue({
      review_id: "review-1",
      cafe_id: "cafe-1",
      removed: true,
      event_type: "review.updated",
      updated_at: "2026-01-01T10:00:00Z",
    });
    mockPresignReviewPhotoUpload.mockResolvedValue({
      upload_url: "https://upload.example.com",
      method: "PUT",
      headers: {},
      object_key: "reviews/photo-1.jpg",
      file_url: "https://cdn.example.com/reviews/photo-1.jpg",
      expires_at: "2026-01-01T10:00:00Z",
    });
    mockUploadReviewPhotoByPresignedUrl.mockResolvedValue();
    mockConfirmReviewPhotoUpload.mockResolvedValue({
      photo_id: "photo-1",
      status: "ready",
      object_key: "reviews/photo-1.jpg",
      file_url: "https://cdn.example.com/reviews/photo-1.jpg",
      mime_type: "image/jpeg",
      size_bytes: 10,
    });
    mockGetReviewPhotoStatus.mockResolvedValue({
      photo_id: "photo-1",
      status: "ready",
      object_key: "reviews/photo-1.jpg",
      file_url: "https://cdn.example.com/reviews/photo-1.jpg",
      mime_type: "image/jpeg",
      size_bytes: 10,
    });
    mockStartCafeCheckIn.mockResolvedValue({
      checkin_id: "checkin-1",
      cafe_id: "cafe-1",
      status: "started",
      distance_meters: 42,
      min_dwell_seconds: 300,
      can_verify_after: "2026-01-01T10:05:00Z",
      cross_cafe_cooldown: 300,
    });
    mockVerifyReviewVisit.mockResolvedValue({
      verification_id: "visit-1",
      review_id: "review-1",
      confidence: "medium",
      checkin_id: "checkin-1",
      dwell_seconds: 360,
    });

    mockUseAuth.mockReturnValue(
      makeAuthContext({
        user: { id: "user-1", role: "moderator" },
        status: "authed",
        openAuthModal: vi.fn(),
      }),
    );

    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "prompt").mockImplementation((message: string | undefined) => {
      if ((message ?? "").toLowerCase().includes("причину удаления")) {
        return "abuse";
      }
      return "";
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads first page and appends next page by cursor", async () => {
    const firstPageReview = makeReview({ id: "review-1" });
    const secondPageReview = makeReview({ id: "review-2", user_id: "user-2" });

    mockListCafeReviews
      .mockResolvedValueOnce({
        reviews: [firstPageReview],
        hasMore: true,
        nextCursor: "cursor-1",
        position: "",
        positionOptions: [],
      })
      .mockResolvedValueOnce({
        reviews: [secondPageReview],
        hasMore: false,
        nextCursor: "",
        position: "",
        positionOptions: [],
      });

    const { result } = renderHook(() =>
      useReviewsSectionController({
        cafeId: "cafe-1",
        opened: true,
      }),
    );

    await waitFor(() => {
      expect(mockListCafeReviews).toHaveBeenCalledWith("cafe-1", {
        sort: "new",
        position: undefined,
        limit: 20,
      });
    });

    await waitFor(() => {
      expect(result.current.reviews).toHaveLength(1);
      expect(result.current.hasMore).toBe(true);
    });

    act(() => {
      result.current.onLoadMore();
    });

    await waitFor(() => {
      expect(mockListCafeReviews).toHaveBeenNthCalledWith(2, "cafe-1", {
        sort: "new",
        position: undefined,
        cursor: "cursor-1",
        limit: 20,
      });
      expect(result.current.reviews).toHaveLength(2);
      expect(result.current.hasMore).toBe(false);
    });
  });

  it("deduplicates position options by key", async () => {
    mockListCafeReviews.mockResolvedValueOnce({
      reviews: [],
      hasMore: false,
      nextCursor: "",
      position: "",
      positionOptions: [
        { key: "espresso", label: "Эспрессо", reviews_count: 12 },
        { key: "espresso", label: "espresso", reviews_count: 3 },
        { key: "latte", label: "Латте", reviews_count: 8 },
        { key: "", label: "Пусто", reviews_count: 1 },
      ],
    });

    const { result } = renderHook(() =>
      useReviewsSectionController({
        cafeId: "cafe-1",
        opened: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.positionOptions).toEqual([
        { key: "espresso", label: "Эспрессо" },
        { key: "latte", label: "Латте" },
      ]);
    });
  });

  it("submits update for own review and refreshes list", async () => {
    const ownReview = makeReview({ id: "review-own", user_id: "user-1" });

    mockListCafeReviews
      .mockResolvedValueOnce({ reviews: [ownReview], hasMore: false, nextCursor: "", position: "", positionOptions: [] })
      .mockResolvedValueOnce({ reviews: [ownReview], hasMore: false, nextCursor: "", position: "", positionOptions: [] });

    const { result } = renderHook(() =>
      useReviewsSectionController({
        cafeId: "cafe-1",
        opened: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.ownReview?.id).toBe("review-own");
    });

    const event = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
    act(() => {
      result.current.onFormSubmit(event);
    });

    await waitFor(() => {
      expect(mockUpdateReview).toHaveBeenCalledTimes(1);
      expect(mockUpdateReview).toHaveBeenCalledWith("review-own", {
        rating: 5,
        positions: [{ drink_id: "espresso" }],
        drink_id: "espresso",
        taste_tags: ["шоколад", "орех"],
        summary: `Понравилось: ${ownReview.summary}`,
        photos: [],
      });
    });

    await waitFor(() => {
      expect(result.current.submitHint).toBe("Отзыв обновлен.");
      expect(mockListCafeReviews).toHaveBeenCalledTimes(2);
    });
  });

  it("opens auth modal when user is not authed on submit", async () => {
    const openAuthModal = vi.fn();
    mockUseAuth.mockReturnValue(
      makeAuthContext({
        user: { id: "user-1", role: "user" },
        status: "unauth",
        openAuthModal,
      }),
    );

    const ownReview = makeReview({ id: "review-own", user_id: "user-1" });
    mockListCafeReviews.mockResolvedValue({ reviews: [ownReview], hasMore: false, nextCursor: "", position: "", positionOptions: [] });

    const { result } = renderHook(() =>
      useReviewsSectionController({
        cafeId: "cafe-1",
        opened: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.ownReview?.id).toBe("review-own");
    });

    const event = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
    act(() => {
      result.current.onFormSubmit(event);
    });

    await waitFor(() => {
      expect(openAuthModal).toHaveBeenCalledWith("login");
    });
    expect(mockUpdateReview).not.toHaveBeenCalled();
    expect(mockCreateReview).not.toHaveBeenCalled();
  });

  it("uploads image files through presign/upload/confirm pipeline", async () => {
    const { result } = renderHook(() =>
      useReviewsSectionController({
        cafeId: "cafe-1",
        opened: true,
      }),
    );

    await waitFor(() => {
      expect(mockListCafeReviews).toHaveBeenCalledTimes(1);
    });

    const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    const files = fileListFrom([file]);

    act(() => {
      result.current.onAppendFiles(files);
    });

    await waitFor(() => {
      expect(mockPresignReviewPhotoUpload).toHaveBeenCalledWith({
        contentType: "image/jpeg",
        sizeBytes: file.size,
      });
      expect(mockUploadReviewPhotoByPresignedUrl).toHaveBeenCalledTimes(1);
      expect(mockConfirmReviewPhotoUpload).toHaveBeenCalledWith("reviews/photo-1.jpg");
    });

    await waitFor(() => {
      expect(result.current.photos).toHaveLength(1);
      expect(result.current.photos[0]?.url).toBe("https://cdn.example.com/reviews/photo-1.jpg");
    });
  });

  it("polls photo status when confirm returns pending", async () => {
    mockConfirmReviewPhotoUpload.mockResolvedValueOnce({
      photo_id: "photo-2",
      status: "pending",
    });
    mockGetReviewPhotoStatus.mockResolvedValueOnce({
      photo_id: "photo-2",
      status: "ready",
      object_key: "reviews/photo-2.jpg",
      file_url: "https://cdn.example.com/reviews/photo-2.jpg",
      mime_type: "image/jpeg",
      size_bytes: 14,
    });

    const { result } = renderHook(() =>
      useReviewsSectionController({
        cafeId: "cafe-1",
        opened: true,
      }),
    );

    await waitFor(() => {
      expect(mockListCafeReviews).toHaveBeenCalledTimes(1);
    });

    const file = new File(["photo2"], "photo2.jpg", { type: "image/jpeg" });
    const files = fileListFrom([file]);

    act(() => {
      result.current.onAppendFiles(files);
    });

    await waitFor(() => {
      expect(mockGetReviewPhotoStatus).toHaveBeenCalledWith("photo-2");
    });
    await waitFor(() => {
      expect(result.current.photos.some((item) => item.url.includes("photo-2.jpg"))).toBe(true);
    });
  });

  it("deletes review only when user has moderation rights", async () => {
    mockUseAuth.mockReturnValue(
      makeAuthContext({
        user: { id: "user-1", role: "user" },
        status: "authed",
        openAuthModal: vi.fn(),
      }),
    );

    const { result } = renderHook(() =>
      useReviewsSectionController({
        cafeId: "cafe-1",
        opened: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.canDeleteReviews).toBe(false);
    });

    act(() => {
      result.current.onDeleteReview(makeReview({ id: "review-forbidden" }));
    });

    await waitFor(() => {
      expect(mockDeleteReview).not.toHaveBeenCalled();
    });
  });

  it("deletes review for moderator and refreshes list", async () => {
    const ownReview = makeReview({ id: "review-own", user_id: "user-1" });
    const targetReview = makeReview({ id: "review-to-delete", user_id: "user-2" });

    mockListCafeReviews
      .mockResolvedValueOnce({ reviews: [ownReview, targetReview], hasMore: false, nextCursor: "", position: "", positionOptions: [] })
      .mockResolvedValueOnce({ reviews: [ownReview], hasMore: false, nextCursor: "", position: "", positionOptions: [] });

    const { result } = renderHook(() =>
      useReviewsSectionController({
        cafeId: "cafe-1",
        opened: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.reviews).toHaveLength(2);
      expect(result.current.canDeleteReviews).toBe(true);
    });

    act(() => {
      result.current.onDeleteReview(targetReview);
    });

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(window.prompt).toHaveBeenCalled();
      expect(mockDeleteReview).toHaveBeenCalledWith("review-to-delete", {
        reason: "abuse",
        details: "",
      });
    });

    await waitFor(() => {
      expect(result.current.submitHint).toBe("Отзыв удален.");
      expect(mockListCafeReviews).toHaveBeenCalledTimes(2);
    });
  });

  it("marks review as helpful and refreshes list", async () => {
    const ownReview = makeReview({ id: "review-own", user_id: "user-1" });
    const otherReview = makeReview({ id: "review-helpful", user_id: "user-2" });

    mockListCafeReviews
      .mockResolvedValueOnce({ reviews: [ownReview, otherReview], hasMore: false, nextCursor: "", position: "", positionOptions: [] })
      .mockResolvedValueOnce({ reviews: [ownReview, otherReview], hasMore: false, nextCursor: "", position: "", positionOptions: [] });

    const { result } = renderHook(() =>
      useReviewsSectionController({
        cafeId: "cafe-1",
        opened: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.reviews).toHaveLength(2);
    });

    act(() => {
      result.current.onMarkHelpful(otherReview);
    });

    await waitFor(() => {
      expect(mockAddHelpfulVote).toHaveBeenCalledWith("review-helpful");
      expect(result.current.submitHint).toBe("Спасибо, голос учтен.");
      expect(mockListCafeReviews).toHaveBeenCalledTimes(2);
    });
  });

  it("opens auth modal when non-authed user marks review as helpful", async () => {
    const openAuthModal = vi.fn();
    mockUseAuth.mockReturnValue(
      makeAuthContext({
        user: { id: "user-1", role: "user" },
        status: "unauth",
        openAuthModal,
      }),
    );
    const otherReview = makeReview({ id: "review-helpful", user_id: "user-2" });
    mockListCafeReviews.mockResolvedValue({ reviews: [otherReview], hasMore: false, nextCursor: "", position: "", positionOptions: [] });

    const { result } = renderHook(() =>
      useReviewsSectionController({
        cafeId: "cafe-1",
        opened: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.reviews).toHaveLength(1);
    });

    act(() => {
      result.current.onMarkHelpful(otherReview);
    });

    await waitFor(() => {
      expect(openAuthModal).toHaveBeenCalledWith("login");
    });
    expect(mockAddHelpfulVote).not.toHaveBeenCalled();
  });
});
