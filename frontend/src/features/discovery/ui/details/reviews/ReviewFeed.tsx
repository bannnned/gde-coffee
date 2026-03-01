import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconStarFilled, IconThumbUp } from "@tabler/icons-react";

import { Badge, Button } from "../../../../../components/ui";
import { AppModal, AppSelect } from "../../../../../ui/bridge";
import PhotoLightboxModal, {
  type PhotoLightboxItem,
} from "../../../../../components/PhotoLightboxModal";
import type { CafeReview, ReviewSort } from "../../../../../api/reviews";
import { formatReviewDate, parseReviewSummarySections } from "./reviewForm";

const COLLAPSED_TEXT_LENGTH_THRESHOLD = 220;
const COLLAPSED_PHOTO_PREVIEW_LIMIT = 3;
const REVIEW_LARGE_TOTAL_CONTENT_THRESHOLD = 260;
const REVIEWS_STALE_DAYS = 14;

function resolveVisitDate(review: CafeReview): string {
  const withVisitDate = review as CafeReview & {
    visit_date?: string;
    visit_verified_at?: string;
  };
  const sourceDate =
    withVisitDate.visit_date ||
    withVisitDate.visit_verified_at ||
    (review.visit_verified ? review.updated_at : review.created_at);
  return formatReviewDate(sourceDate);
}

function buildReviewPhotos(review: CafeReview): PhotoLightboxItem[] {
  return review.photos.map((url, index) => ({
    id: `${review.id}:photo:${index + 1}`,
    url,
    alt: `Фото отзыва ${index + 1}`,
  }));
}

type ReviewFeedProps = {
  sort: ReviewSort;
  onSortChange: (value: ReviewSort) => void;
  positionFilter: string;
  onPositionFilterChange: (value: string) => void;
  positionOptions: Array<{ key: string; label: string }>;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadError: string | null;
  reviews: CafeReview[];
  currentUserId: string;
  helpfulPendingReviewID: string;
  onMarkHelpful: (review: CafeReview) => void;
  canDeleteReviews: boolean;
  isAdmin: boolean;
  onDeleteReview: (review: CafeReview) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  onReviewRead: (review: CafeReview) => void;
  focusReviewID?: string | null;
  onFocusReviewApplied?: () => void;
};

export function ReviewFeed({
  sort,
  onSortChange,
  positionFilter,
  onPositionFilterChange,
  positionOptions,
  isLoading,
  isLoadingMore,
  loadError,
  reviews,
  currentUserId,
  helpfulPendingReviewID,
  onMarkHelpful,
  canDeleteReviews,
  isAdmin,
  onDeleteReview,
  hasMore,
  onLoadMore,
  onReviewRead,
  focusReviewID = null,
  onFocusReviewApplied,
}: ReviewFeedProps) {
  const [expandedReviewID, setExpandedReviewID] = useState<string | null>(null);
  const [highlightedReviewID, setHighlightedReviewID] = useState<string | null>(null);
  const [photoViewerState, setPhotoViewerState] = useState<{
    title: string;
    photos: PhotoLightboxItem[];
    index: number;
  } | null>(null);
  const reviewCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const setReviewCardRef = useCallback(
    (reviewID: string) => (node: HTMLDivElement | null) => {
      reviewCardRefs.current[reviewID] = node;
    },
    [],
  );

  const expandedReview = useMemo(
    () => reviews.find((item) => item.id === expandedReviewID) ?? null,
    [expandedReviewID, reviews],
  );

  const filterSelectStyles = {
    input: {
      borderRadius: 14,
      border: "1px solid var(--glass-border)",
      background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
      boxShadow: "var(--glass-shadow)",
      backdropFilter: "blur(10px) saturate(130%)",
      WebkitBackdropFilter: "blur(10px) saturate(130%)",
      minHeight: 38,
      fontWeight: 600,
    },
    dropdown: {
      borderRadius: 14,
      border: "1px solid var(--glass-border)",
      background: "var(--color-surface-card)",
      backdropFilter: "none",
      WebkitBackdropFilter: "none",
    },
    option: {
      background: "var(--color-surface-card)",
      color: "var(--text)",
    },
    options: {
      background: "var(--color-surface-card)",
    },
  } as const;

  const positionFilterData = useMemo(() => {
    const seen = new Set<string>(["all"]);
    const options = [{ value: "all", label: "Все позиции" }];
    for (const item of positionOptions) {
      const value = item.key.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      options.push({
        value,
        label: item.label || value,
      });
    }
    return options;
  }, [positionOptions]);

  const sortSelectData = [
    { value: "new", label: "Новые" },
    { value: "helpful", label: "Полезные" },
    { value: "verified", label: "С визитом" },
  ];
  const showReviewFilters = reviews.length > 0 || positionOptions.length > 0;

  const staleReviewsNotice = useMemo(() => {
    if (positionFilter !== "all") return "";
    if (reviews.length === 0) return "";
    let latestTimestamp = 0;
    for (const review of reviews) {
      const timestamp = new Date(review.created_at).getTime();
      if (!Number.isFinite(timestamp)) continue;
      if (timestamp > latestTimestamp) latestTimestamp = timestamp;
    }
    if (!latestTimestamp) return "";
    const staleAfterMs = REVIEWS_STALE_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - latestTimestamp < staleAfterMs) return "";
    return "Сюда давно не заходили. Исправьте это и оставьте свежий отзыв.";
  }, [positionFilter, reviews]);

  useEffect(() => {
    if (!focusReviewID) return;
    const targetReview = reviews.find((review) => review.id === focusReviewID);
    if (!targetReview) return;
    const targetNode = reviewCardRefs.current[focusReviewID];
    if (!targetNode) return;

    const frameID = window.requestAnimationFrame(() => {
      targetNode.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setHighlightedReviewID(focusReviewID);
      onFocusReviewApplied?.();
    });

    return () => {
      window.cancelAnimationFrame(frameID);
    };
  }, [focusReviewID, onFocusReviewApplied, reviews]);

  useEffect(() => {
    if (!highlightedReviewID) return;
    const timerID = window.setTimeout(() => {
      setHighlightedReviewID(null);
    }, 2200);
    return () => {
      window.clearTimeout(timerID);
    };
  }, [highlightedReviewID]);

  return (
    <div className="relative">
      {showReviewFilters ? (
        <div className="flex flex-nowrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <AppSelect
              implementation="radix"
              size="xs"
              className="review-filter-select"
              aria-label="Сортировка отзывов"
              placeholder="Сортировка"
              value={sort}
              data={sortSelectData}
              onChange={(value) => onSortChange((value as ReviewSort) || "new")}
              styles={filterSelectStyles}
            />
          </div>
          <div className="min-w-0 flex-1">
            <AppSelect
              implementation="radix"
              size="xs"
              className="review-filter-select"
              aria-label="Фильтр по позиции"
              placeholder="Позиция"
              value={positionFilter}
              data={positionFilterData}
              onChange={(value) => onPositionFilterChange(value || "all")}
              styles={filterSelectStyles}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-3">
        {isLoading && reviews.length === 0 ? (
          <>
            <ReviewCardSkeleton />
            <ReviewCardSkeleton />
            <ReviewCardSkeleton />
          </>
        ) : null}

        {loadError ? (
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm text-danger">{loadError}</p>
          </div>
        ) : null}

        {!isLoading && !loadError && reviews.length === 0 ? (
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm text-[var(--muted)]">Пока нет отзывов. Станьте первым автором.</p>
          </div>
        ) : null}

        {!isLoading && !loadError && staleReviewsNotice ? (
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-sm font-semibold text-[var(--color-status-warning)]">
              {staleReviewsNotice}
            </p>
          </div>
        ) : null}

        {!loadError
            ? reviews.map((review, index) => (
              <motion.div
                key={review.id}
                ref={setReviewCardRef(review.id)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index, 6) * 0.024 }}
              >
                <ReviewCard
                  review={review}
                  isHighlighted={review.id === highlightedReviewID}
                  isOwn={review.user_id === currentUserId}
                  helpfulLoading={helpfulPendingReviewID === review.id}
                  onMarkHelpful={onMarkHelpful}
                  onOpenExpandedReview={(item) => {
                    onReviewRead(item);
                    setExpandedReviewID(item.id);
                  }}
                  onReviewRead={onReviewRead}
                  canDeleteReviews={canDeleteReviews}
                  isAdmin={isAdmin}
                  onDeleteReview={onDeleteReview}
                  onOpenPhoto={(item, photoIndex) => {
                    const photos = buildReviewPhotos(item);
                    if (photos.length === 0) return;
                    const safeIndex = Math.max(0, Math.min(photoIndex, photos.length - 1));
                    setPhotoViewerState({
                      title: "Фото отзыва",
                      photos,
                      index: safeIndex,
                    });
                  }}
                />
              </motion.div>
            ))
          : null}

        {!isLoading && !loadError && hasMore ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="review-show-more-button"
          >
            {isLoadingMore ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Загружаем...
              </>
            ) : (
              "Показать еще"
            )}
          </Button>
        ) : null}
      </div>

      <AnimatePresence>
        {isLoading && reviews.length > 0 ? (
          <motion.div
            key="reviews-updating-indicator"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "absolute",
              left: "50%",
              bottom: 8,
              transform: "translateX(-50%)",
              pointerEvents: "none",
              zIndex: 6,
            }}
            className="rounded-full border border-[var(--glass-border)] bg-[linear-gradient(135deg,var(--glass-grad-1),var(--glass-grad-2))] px-3 py-1.5 shadow-[var(--glass-shadow)] backdrop-blur-[10px] backdrop-saturate-[130%]"
          >
            <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--text)] border-t-transparent" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AppModal
        open={Boolean(expandedReview)}
        onOpenChange={(next) => {
          if (!next) setExpandedReviewID(null);
        }}
        title="Полный отзыв"
        implementation="radix"
        presentation="dialog"
        contentClassName="w-[min(94vw,760px)] border border-glass-border bg-glass shadow-glass"
        bodyClassName="max-h-[80vh] overflow-auto p-4"
      >
        {expandedReview ? (
          <ReviewCard
            review={expandedReview}
            isOwn={expandedReview.user_id === currentUserId}
            helpfulLoading={helpfulPendingReviewID === expandedReview.id}
            onMarkHelpful={onMarkHelpful}
            onReviewRead={onReviewRead}
            canDeleteReviews={canDeleteReviews}
            isAdmin={isAdmin}
            onDeleteReview={onDeleteReview}
            onOpenPhoto={(item, photoIndex) => {
              const photos = buildReviewPhotos(item);
              if (photos.length === 0) return;
              const safeIndex = Math.max(0, Math.min(photoIndex, photos.length - 1));
              setPhotoViewerState({
                title: "Фото отзыва",
                photos,
                index: safeIndex,
              });
            }}
            forceExpanded
          />
        ) : null}
      </AppModal>

      <PhotoLightboxModal
        opened={Boolean(photoViewerState)}
        onClose={() => setPhotoViewerState(null)}
        title={photoViewerState?.title ?? "Фото"}
        photos={photoViewerState?.photos ?? []}
        index={photoViewerState?.index ?? 0}
        onIndexChange={(nextIndex) =>
          setPhotoViewerState((prev) => (prev ? { ...prev, index: nextIndex } : prev))
        }
      />
    </div>
  );
}

function ReviewCardSkeleton() {
  return (
    <div className="animate-pulse rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-24 rounded bg-[color:var(--color-surface-overlay-soft)]" />
            <div className="h-5 w-12 rounded-full bg-[color:var(--color-surface-overlay-soft)]" />
          </div>
          <div className="h-3.5 w-20 rounded bg-[color:var(--color-surface-overlay-soft)]" />
        </div>
        <div className="h-2.5 w-full rounded bg-[color:var(--color-surface-overlay-soft)]" />
        <div className="h-2.5 w-[92%] rounded bg-[color:var(--color-surface-overlay-soft)]" />
        <div className="h-2.5 w-[76%] rounded bg-[color:var(--color-surface-overlay-soft)]" />
        <div className="flex gap-2">
          <div className="h-5 w-20 rounded-full bg-[color:var(--color-surface-overlay-soft)]" />
          <div className="h-5 w-16 rounded-full bg-[color:var(--color-surface-overlay-soft)]" />
          <div className="h-5 w-24 rounded-full bg-[color:var(--color-surface-overlay-soft)]" />
        </div>
      </div>
    </div>
  );
}

type ReviewCardProps = {
  review: CafeReview;
  isHighlighted?: boolean;
  isOwn: boolean;
  helpfulLoading: boolean;
  onMarkHelpful: (review: CafeReview) => void;
  onOpenExpandedReview?: (review: CafeReview) => void;
  onReviewRead?: (review: CafeReview) => void;
  onOpenPhoto?: (review: CafeReview, photoIndex: number) => void;
  canDeleteReviews: boolean;
  isAdmin: boolean;
  onDeleteReview: (review: CafeReview) => void;
  forceExpanded?: boolean;
};

function ReviewCard({
  review,
  isHighlighted = false,
  isOwn,
  helpfulLoading,
  onMarkHelpful,
  onOpenExpandedReview,
  onReviewRead,
  onOpenPhoto,
  canDeleteReviews,
  isAdmin,
  onDeleteReview,
  forceExpanded = false,
}: ReviewCardProps) {
  const [textExpanded, setTextExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const hasTrackedReadRef = useRef(false);
  const reviewBody = parseReviewSummarySections(review.summary);
  const visitDateLabel = resolveVisitDate(review);
  const ratingValue = Number.isFinite(Number(review.rating)) ? Number(review.rating) : 0;
  const reviewSections = [
    { key: "liked", label: "Понравилось", value: reviewBody.liked.trim() },
    { key: "improve", label: "Что улучшить", value: reviewBody.improve.trim() },
  ].filter((section) => section.value.length > 0);
  const positionLabels =
    review.positions.length > 0
      ? review.positions.map((item) => item.drink_name || item.drink_id).filter(Boolean)
      : [review.drink_name || review.drink_id].filter(Boolean);
  const reviewTextLength = reviewSections.reduce((sum, section) => sum + section.value.length, 0);
  const hasLargeContent =
    reviewTextLength + review.photos.length * 40 >= REVIEW_LARGE_TOTAL_CONTENT_THRESHOLD;
  const canCollapseText = !forceExpanded && reviewTextLength >= COLLAPSED_TEXT_LENGTH_THRESHOLD;
  const shouldClampText = canCollapseText && !textExpanded;
  const shouldCollapsePhotos = !forceExpanded && hasLargeContent && review.photos.length > 0;
  const visiblePhotos = shouldCollapsePhotos
    ? review.photos.slice(0, COLLAPSED_PHOTO_PREVIEW_LIMIT)
    : review.photos;
  const canOpenExpandedModal =
    !forceExpanded && hasLargeContent && review.photos.length > 0 && Boolean(onOpenExpandedReview);

  useEffect(() => {
    if (forceExpanded || !onReviewRead || hasTrackedReadRef.current) return;
    const node = cardRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    let timerID: number | null = null;
    const markRead = () => {
      if (hasTrackedReadRef.current) return;
      hasTrackedReadRef.current = true;
      onReviewRead(review);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (timerID == null) {
            timerID = window.setTimeout(markRead, 3000);
          }
          return;
        }
        if (timerID != null) {
          window.clearTimeout(timerID);
          timerID = null;
        }
      },
      {
        threshold: [0, 0.6, 1],
      },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timerID != null) {
        window.clearTimeout(timerID);
      }
    };
  }, [forceExpanded, onReviewRead, review]);

  return (
    <div
      ref={cardRef}
      className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4"
      style={
        isHighlighted
          ? {
              borderColor:
                "color-mix(in srgb, var(--color-brand-accent) 58%, var(--border))",
              boxShadow:
                "0 0 0 2px color-mix(in srgb, var(--color-brand-accent) 28%, transparent), 0 14px 28px color-mix(in srgb, var(--color-brand-accent-soft) 30%, transparent)",
            }
          : undefined
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-[var(--text)]">
                {review.author_name || "Участник"}
              </p>
              {review.author_badge ? (
                <Badge variant="secondary" className="text-[10px]">
                  {review.author_badge}
                </Badge>
              ) : null}
              {review.author_trusted ? (
                <Badge variant="secondary" className="text-[10px]">
                  Доверенный участник
                </Badge>
              ) : null}
              {isOwn ? <Badge className="text-[10px]">Вы</Badge> : null}
              {review.visit_verified ? (
                <Badge variant="secondary" className="text-[10px]">
                  Подтвержден визит
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-[var(--muted)]">Дата визита: {visitDateLabel}</p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-1">
            <IconStarFilled size={13} className="text-[var(--color-brand-accent)]" />
            <span className="text-xs font-semibold text-[var(--text)]">
              {Number.isInteger(ratingValue) ? ratingValue : ratingValue.toFixed(1)}
            </span>
          </div>
        </div>

        {reviewSections.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {reviewSections.map((section) => (
              <div key={`${review.id}:${section.key}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--muted)]">
                  {section.label}
                </p>
                <p
                  className="text-sm text-[var(--text)]"
                  style={{
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    ...(shouldClampText
                      ? {
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                        }
                      : null),
                  }}
                >
                  {section.value}
                </p>
              </div>
            ))}
            {canCollapseText && !textExpanded ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTextExpanded(true)}
                className="review-show-more-button h-6 w-fit px-0 text-xs font-semibold text-[var(--cafe-hero-emphasis-color)] hover:bg-transparent"
              >
                Показать еще
              </Button>
            ) : null}
          </div>
        ) : null}

        {review.photos.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <div className="horizontal-scroll-modern flex flex-nowrap gap-2 overflow-x-auto pb-[2px]">
              {visiblePhotos.map((photoUrl, index) => (
                <button
                  key={`${review.id}:${index}`}
                  type="button"
                  onClick={() => onOpenPhoto?.(review, index)}
                  className="overflow-hidden rounded-sm border border-[var(--border)] bg-[var(--surface)] ui-interactive"
                  style={{
                    width: 96,
                    minWidth: 96,
                    height: 72,
                    cursor: onOpenPhoto ? "pointer" : "default",
                  }}
                >
                  <img
                    src={photoUrl}
                    alt={`Фото отзыва ${index + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
            {canOpenExpandedModal ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenExpandedReview?.(review)}
                className="h-6 w-fit px-0 text-xs font-semibold text-[var(--cafe-hero-emphasis-color)] hover:bg-transparent"
              >
                Смотреть все
              </Button>
            ) : null}
          </div>
        ) : null}

        {!forceExpanded && shouldCollapsePhotos && review.photos.length > visiblePhotos.length ? (
          <p className="text-xs text-[var(--muted)]">
            Показано {visiblePhotos.length} из {review.photos.length} фото
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {positionLabels.map((name, index) => (
            <Badge
              key={`${review.id}:position:${index}`}
              variant="outline"
              className="min-h-[18px] px-1.5 text-[10px] leading-[14px]"
            >
              {name}
            </Badge>
          ))}
        </div>

        {isAdmin ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">Качество: {Number(review.quality_score) || 0}/100</Badge>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Качество учитывает напиток, теги, детали текста, фото, визит и жалобы.
            </p>
          </>
        ) : null}

        <motion.div
          whileTap={{ scale: isOwn || helpfulLoading ? 1 : 0.96 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          style={{ alignSelf: "flex-start" }}
        >
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onMarkHelpful(review)}
            disabled={isOwn || helpfulLoading}
            className="rounded-full px-3"
            style={{
              border: "1px solid color-mix(in srgb, var(--color-brand-accent) 48%, var(--border))",
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 68%, var(--surface)), var(--surface))",
              boxShadow:
                "0 8px 18px color-mix(in srgb, var(--color-brand-accent-soft) 52%, transparent)",
              color: "var(--text)",
            }}
          >
            <span className="text-xs font-semibold">Полезно</span>
            <IconThumbUp size={14} stroke={2} />
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[11px] font-bold leading-none"
              style={{
                background:
                  "color-mix(in srgb, var(--color-brand-accent) 18%, var(--color-surface-card))",
                borderColor:
                  "color-mix(in srgb, var(--color-brand-accent) 34%, var(--border))",
              }}
            >
              {helpfulLoading ? (
                <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                review.helpful_votes
              )}
            </span>
          </Button>
        </motion.div>

        {canDeleteReviews ? (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-danger hover:bg-[color:color-mix(in_srgb,var(--color-status-error)_12%,transparent)]"
              onClick={() => onDeleteReview(review)}
            >
              Удалить отзыв
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
