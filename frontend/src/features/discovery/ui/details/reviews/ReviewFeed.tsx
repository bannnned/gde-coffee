import { useMemo, useState } from "react";
import { Badge, Box, Button, Group, Loader, Modal, Paper, Rating, Select, Skeleton, Stack, Text, Transition } from "@mantine/core";
import { IconThumbUp } from "@tabler/icons-react";
import { motion } from "framer-motion";

import type { CafeReview, ReviewSort } from "../../../../../api/reviews";
import { formatReviewDate, parseReviewSummarySections } from "./reviewForm";

const COLLAPSED_TEXT_LENGTH_THRESHOLD = 220;
const COLLAPSED_PHOTO_PREVIEW_LIMIT = 3;
const REVIEW_LARGE_TOTAL_CONTENT_THRESHOLD = 260;

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
}: ReviewFeedProps) {
  const [expandedReviewID, setExpandedReviewID] = useState<string | null>(null);
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

  const positionFilterData = [
    { value: "all", label: "Все позиции" },
    ...positionOptions.map((item) => ({
      value: item.key,
      label: item.label,
    })),
  ];

  const sortSelectData = [
    { value: "new", label: "Новые" },
    { value: "helpful", label: "Полезные" },
    { value: "verified", label: "С визитом" },
  ];

  return (
    <Box style={{ position: "relative" }}>
      <Group grow align="flex-end" gap={8} wrap="nowrap">
        <Select
          size="xs"
          aria-label="Сортировка отзывов"
          placeholder="Сортировка"
          value={sort}
          data={sortSelectData}
          onChange={(value) => onSortChange((value as ReviewSort) || "new")}
          styles={filterSelectStyles}
          style={{ flex: 1 }}
        />
        <Select
          size="xs"
          aria-label="Фильтр по позиции"
          placeholder="Позиция"
          value={positionFilter}
          data={positionFilterData}
          onChange={(value) => onPositionFilterChange(value || "all")}
          styles={filterSelectStyles}
          style={{ flex: 1 }}
        />
      </Group>

      {isLoading && (
        <>
          {reviews.length === 0 ? (
            <>
              <ReviewCardSkeleton />
              <ReviewCardSkeleton />
              <ReviewCardSkeleton />
            </>
          ) : null}
        </>
      )}

      {loadError && (
        <Paper
          withBorder
          radius="md"
          p="md"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Text size="sm" c="red">
            {loadError}
          </Text>
        </Paper>
      )}

      {!isLoading && !loadError && reviews.length === 0 && (
        <Paper
          withBorder
          radius="md"
          p="md"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Text size="sm" c="dimmed">
            Пока нет отзывов. Станьте первым автором.
          </Text>
        </Paper>
      )}

      {!loadError &&
        reviews.map((review, index) => (
          <Transition key={review.id} mounted transition="fade" duration={220} timingFunction="ease">
            {(styles) => (
              <div style={{ ...styles, transitionDelay: `${Math.min(index, 6) * 24}ms` }}>
                <ReviewCard
                  review={review}
                  isOwn={review.user_id === currentUserId}
                  helpfulLoading={helpfulPendingReviewID === review.id}
                  onMarkHelpful={onMarkHelpful}
                  onOpenExpandedReview={(item) => setExpandedReviewID(item.id)}
                  canDeleteReviews={canDeleteReviews}
                  isAdmin={isAdmin}
                  onDeleteReview={onDeleteReview}
                />
              </div>
            )}
          </Transition>
        ))}

      {!isLoading && !loadError && hasMore && (
        <Button variant="light" onClick={onLoadMore} loading={isLoadingMore}>
          Показать еще
        </Button>
      )}

      <Transition mounted={isLoading && reviews.length > 0} transition="fade" duration={180} timingFunction="ease">
        {(styles) => (
          <Paper
            withBorder
            radius="xl"
            px={10}
            py={6}
            style={{
              ...styles,
              position: "absolute",
              left: "50%",
              bottom: 8,
              transform: "translateX(-50%)",
              border: "1px solid var(--glass-border)",
              background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
              boxShadow: "var(--glass-shadow)",
              backdropFilter: "blur(10px) saturate(130%)",
              WebkitBackdropFilter: "blur(10px) saturate(130%)",
              pointerEvents: "none",
              zIndex: 6,
            }}
          >
            <Loader size={14} type="dots" />
          </Paper>
        )}
      </Transition>

      <Modal
        opened={Boolean(expandedReview)}
        onClose={() => setExpandedReviewID(null)}
        title="Полный отзыв"
        size="lg"
        centered
        styles={{
          content: {
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--shadow)",
            backdropFilter: "blur(14px) saturate(145%)",
            WebkitBackdropFilter: "blur(14px) saturate(145%)",
          },
          header: {
            background: "transparent",
          },
        }}
      >
        {expandedReview && (
          <ReviewCard
            review={expandedReview}
            isOwn={expandedReview.user_id === currentUserId}
            helpfulLoading={helpfulPendingReviewID === expandedReview.id}
            onMarkHelpful={onMarkHelpful}
            canDeleteReviews={canDeleteReviews}
            isAdmin={isAdmin}
            onDeleteReview={onDeleteReview}
            forceExpanded
          />
        )}
      </Modal>
    </Box>
  );
}

function ReviewCardSkeleton() {
  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <Stack gap={10}>
        <Group justify="space-between" align="center">
          <Group gap={8} wrap="nowrap">
            <Skeleton h={14} w={90} radius="sm" />
            <Skeleton h={18} w={42} radius="xl" />
          </Group>
          <Skeleton h={14} w={90} radius="sm" />
        </Group>
        <Skeleton h={10} radius="sm" />
        <Skeleton h={10} w="92%" radius="sm" />
        <Skeleton h={10} w="76%" radius="sm" />
        <Group gap={6}>
          <Skeleton h={20} w={90} radius="xl" />
          <Skeleton h={20} w={80} radius="xl" />
          <Skeleton h={20} w={110} radius="xl" />
        </Group>
        <Group justify="space-between" align="center">
          <Skeleton h={28} w={86} radius="sm" />
        </Group>
      </Stack>
    </Paper>
  );
}

type ReviewCardProps = {
  review: CafeReview;
  isOwn: boolean;
  helpfulLoading: boolean;
  onMarkHelpful: (review: CafeReview) => void;
  onOpenExpandedReview?: (review: CafeReview) => void;
  canDeleteReviews: boolean;
  isAdmin: boolean;
  onDeleteReview: (review: CafeReview) => void;
  forceExpanded?: boolean;
};

function ReviewCard({
  review,
  isOwn,
  helpfulLoading,
  onMarkHelpful,
  onOpenExpandedReview,
  canDeleteReviews,
  isAdmin,
  onDeleteReview,
  forceExpanded = false,
}: ReviewCardProps) {
  const [textExpanded, setTextExpanded] = useState(false);
  const MotionBox = motion(Box);
  const reviewBody = parseReviewSummarySections(review.summary);
  const visitDateLabel = resolveVisitDate(review);
  const reviewSections = [
    { key: "liked", label: "Понравилось", value: reviewBody.liked.trim() },
    { key: "disliked", label: "Не понравилось", value: reviewBody.disliked.trim() },
    { key: "summary", label: "Короткий вывод", value: reviewBody.summary.trim() },
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

  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <Stack gap={8}>
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Group gap={6}>
              <Text fw={600} size="sm">
                {review.author_name || "Участник"}
              </Text>
              {review.author_badge && (
                <Badge size="xs" variant="light">
                  {review.author_badge}
                </Badge>
              )}
              {review.author_trusted && (
                <Badge color="blue" size="xs" variant="light">
                  Доверенный участник
                </Badge>
              )}
              {isOwn && <Badge size="xs">Вы</Badge>}
              {review.visit_verified && (
                <Badge color="teal" size="xs" variant="light">
                  Подтвержден визит
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              Дата визита: {visitDateLabel}
            </Text>
          </Stack>
          <Rating value={review.rating} readOnly size="sm" />
        </Group>

        {reviewSections.length > 0 && (
          <Stack gap={6}>
            {reviewSections.map((section) => (
              <Box key={`${review.id}:${section.key}`}>
                <Text
                  size="xs"
                  fw={700}
                  style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}
                  c="dimmed"
                >
                  {section.label}
                </Text>
                <Text
                  size="sm"
                  lineClamp={shouldClampText ? 3 : undefined}
                  style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                >
                  {section.value}
                </Text>
              </Box>
            ))}
            {canCollapseText && !textExpanded && (
              <Button
                variant="subtle"
                size="compact-xs"
                onClick={() => setTextExpanded(true)}
                style={{ alignSelf: "flex-start", paddingInline: 0 }}
              >
                Показать еще
              </Button>
            )}
          </Stack>
        )}

        {review.photos.length > 0 && (
          <Stack gap={6}>
            <Group wrap="nowrap" gap={8} style={{ overflowX: "auto", paddingBottom: 2 }}>
              {visiblePhotos.map((photoUrl, index) => (
                <Paper
                  key={`${review.id}:${index}`}
                  withBorder
                  radius="sm"
                  style={{
                    width: 96,
                    minWidth: 96,
                    height: 72,
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <img
                    src={photoUrl}
                    alt={`Фото отзыва ${index + 1}`}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </Paper>
              ))}
            </Group>
            {canOpenExpandedModal && (
              <Button
                variant="subtle"
                size="compact-xs"
                onClick={() => onOpenExpandedReview?.(review)}
                style={{ alignSelf: "flex-start", paddingInline: 0 }}
              >
                Смотреть все
              </Button>
            )}
          </Stack>
        )}

        {!forceExpanded && shouldCollapsePhotos && review.photos.length > visiblePhotos.length && (
          <Text size="xs" c="dimmed">
            Показано {visiblePhotos.length} из {review.photos.length} фото
          </Text>
        )}

        <Group gap={6} wrap="wrap">
          {positionLabels.map((name, index) => (
            <Badge
              key={`${review.id}:position:${index}`}
              size="xs"
              variant="outline"
              radius="sm"
              styles={{
                root: {
                  paddingInline: 6,
                  minHeight: 18,
                  fontSize: 10,
                  lineHeight: "14px",
                },
              }}
            >
              {name}
            </Badge>
          ))}
        </Group>
        {isAdmin && (
          <>
            <Group gap={6} wrap="wrap">
              <Badge variant="outline">Качество: {review.quality_score}/100</Badge>
            </Group>
            <Text size="xs" c="dimmed">
              Качество учитывает напиток, теги, детали текста, фото, визит и жалобы.
            </Text>
          </>
        )}

        <MotionBox
          whileTap={{ scale: isOwn || helpfulLoading ? 1 : 0.96 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          style={{ alignSelf: "flex-start" }}
        >
          <Button
            size="xs"
            variant="light"
            onClick={() => onMarkHelpful(review)}
            disabled={isOwn || helpfulLoading}
            styles={{
              root: {
                borderRadius: 999,
                border: "1px solid color-mix(in srgb, var(--color-brand-accent) 48%, var(--border))",
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 68%, var(--surface)), var(--surface))",
                boxShadow:
                  "0 8px 18px color-mix(in srgb, var(--color-brand-accent-soft) 52%, transparent)",
                color: "var(--text)",
                paddingInline: 12,
              },
              label: {
                paddingBlock: 1,
              },
            }}
          >
            <Group gap={6} wrap="nowrap">
              <Text component="span" size="xs" fw={600}>
                Полезно
              </Text>
              <IconThumbUp size={14} stroke={2} />
              <Box
                component="span"
                style={{
                  minWidth: 20,
                  height: 20,
                  paddingInline: 6,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1,
                  background:
                    "color-mix(in srgb, var(--color-brand-accent) 18%, var(--color-surface-card))",
                  border: "1px solid color-mix(in srgb, var(--color-brand-accent) 34%, var(--border))",
                }}
              >
                {helpfulLoading ? <Loader size={11} type="dots" /> : review.helpful_votes}
              </Box>
            </Group>
          </Button>
        </MotionBox>

        {canDeleteReviews && (
          <Group justify="flex-end">
            <Button size="xs" variant="subtle" color="red" onClick={() => onDeleteReview(review)}>
              Удалить отзыв
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
