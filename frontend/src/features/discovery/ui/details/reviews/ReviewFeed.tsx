import { Badge, Button, Group, Paper, SegmentedControl, Select, Stack, Text } from "@mantine/core";

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
  const positionFilterData = [
    { value: "all", label: "Все позиции" },
    ...positionOptions.map((item) => ({
      value: item.key,
      label: item.label,
    })),
  ];

  return (
    <>
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Text fw={600} size="sm">
          Отзывы
        </Text>
        <Group gap={8} wrap="wrap" justify="flex-end">
          <SegmentedControl
            value={sort}
            onChange={(value) => onSortChange(value as ReviewSort)}
            size="xs"
            data={[
              { label: "Новые", value: "new" },
              { label: "Полезные", value: "helpful" },
              { label: "С визитом", value: "verified" },
            ]}
          />
          <Select
            size="xs"
            value={positionFilter}
            data={positionFilterData}
            onChange={(value) => onPositionFilterChange(value || "all")}
            w={220}
          />
        </Group>
      </Group>

      {isLoading && (
        <Paper
          withBorder
          radius="md"
          p="md"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Text size="sm" c="dimmed">
            Загружаем отзывы...
          </Text>
        </Paper>
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

      {!isLoading &&
        !loadError &&
        reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            isOwn={review.user_id === currentUserId}
            helpfulLoading={helpfulPendingReviewID === review.id}
            onMarkHelpful={onMarkHelpful}
            canDeleteReviews={canDeleteReviews}
            onDeleteReview={onDeleteReview}
          />
        ))}

      {!isLoading && !loadError && hasMore && (
        <Button variant="light" onClick={onLoadMore} loading={isLoadingMore}>
          Показать еще
        </Button>
      )}
    </>
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
          <Badge color="yellow" variant="light">
            {review.rating}/5
          </Badge>
        </Group>

        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
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

        {canDeleteReviews && (
          <Group justify="flex-end">
            <Button size="xs" variant="subtle" color="red" onClick={() => onDeleteReview(review)}>
              Удалить отзыв
            </Button>
          </Group>
        )}

        {review.taste_tags.length > 0 && (
          <Group gap={6} wrap="wrap">
            {review.taste_tags.map((tag) => (
              <Badge key={`${review.id}:${tag}`} size="xs" variant="light">
                {tag}
              </Badge>
            ))}
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
