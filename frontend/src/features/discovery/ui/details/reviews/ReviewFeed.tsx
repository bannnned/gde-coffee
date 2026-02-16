import { Badge, Button, Group, Paper, Rating, Select, Skeleton, Stack, Text, Transition } from "@mantine/core";

import type { CafeReview, ReviewSort } from "../../../../../api/reviews";
import { formatReviewDate } from "./reviewForm";

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
  onDeleteReview,
  hasMore,
  onLoadMore,
}: ReviewFeedProps) {
  const filterSelectStyles = {
    label: {
      fontSize: 11,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: "var(--muted)",
      marginBottom: 4,
    },
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
    <>
      <Group grow align="flex-end" gap={8} wrap="nowrap">
        <Select
          size="xs"
          label="Сортировка"
          value={sort}
          data={sortSelectData}
          onChange={(value) => onSortChange((value as ReviewSort) || "new")}
          styles={filterSelectStyles}
          style={{ flex: 1 }}
        />
        <Select
          size="xs"
          label="Позиция"
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
          ) : (
            <Paper
              withBorder
              radius="md"
              p="sm"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Group justify="space-between" align="center">
                <Text size="xs" c="dimmed">
                  Обновляем отзывы...
                </Text>
                <Skeleton h={8} w={120} radius="xl" />
              </Group>
            </Paper>
          )}
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
                  canDeleteReviews={canDeleteReviews}
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
    </>
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
  canDeleteReviews: boolean;
  onDeleteReview: (review: CafeReview) => void;
};

function ReviewCard({
  review,
  isOwn,
  helpfulLoading,
  onMarkHelpful,
  canDeleteReviews,
  onDeleteReview,
}: ReviewCardProps) {
  const positionLabels =
    review.positions.length > 0
      ? review.positions.map((item) => item.drink_name || item.drink_id).filter(Boolean)
      : [review.drink_name || review.drink_id].filter(Boolean);

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
              {formatReviewDate(review.updated_at)}
            </Text>
          </Stack>
          <Rating value={review.rating} readOnly size="sm" />
        </Group>

        <Text
          size="sm"
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}
        >
          {review.summary}
        </Text>

        {review.photos.length > 0 && (
          <Group wrap="nowrap" gap={8} style={{ overflowX: "auto", paddingBottom: 2 }}>
            {review.photos.map((photoUrl, index) => (
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
        )}

        <Group gap={6} wrap="wrap">
          {positionLabels.map((name, index) => (
            <Badge key={`${review.id}:position:${index}`} variant="outline">
              {name}
            </Badge>
          ))}
          <Badge variant="outline">Полезно: {review.helpful_votes}</Badge>
          <Badge variant="outline">Качество: {review.quality_score}/100</Badge>
        </Group>
        <Text size="xs" c="dimmed">
          Качество учитывает напиток, теги, детали текста, фото, визит и жалобы.
        </Text>

        <Group justify="space-between" align="center">
          <Button
            size="xs"
            variant="light"
            onClick={() => onMarkHelpful(review)}
            loading={helpfulLoading}
            disabled={isOwn}
          >
            Полезно
          </Button>
        </Group>

        {review.taste_tags.length > 0 && (
          <Group gap={6} wrap="wrap">
            {review.taste_tags.map((tag) => (
              <Badge key={`${review.id}:${tag}`} size="xs" variant="light">
                {tag}
              </Badge>
            ))}
          </Group>
        )}

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
