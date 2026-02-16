import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";

import { useAuth } from "../../../../components/AuthGate";
import {
  createReview,
  listCafeReviews,
  updateReview,
  type CafeReview,
  type ReviewSort,
} from "../../../../api/reviews";

type ReviewsSectionProps = {
  cafeId: string;
  opened: boolean;
};

const MIN_SUMMARY_LENGTH = 60;

function parseTags(value: string): string[] {
  if (!value.trim()) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value.split(/[\n,]/g)) {
    const tag = raw.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 10) break;
  }
  return tags;
}

function parsePhotoUrls(value: string): string[] {
  if (!value.trim()) return [];
  const seen = new Set<string>();
  const photos: string[] = [];
  for (const raw of value.split(/\n/g)) {
    const photoUrl = raw.trim();
    if (!photoUrl || seen.has(photoUrl)) continue;
    seen.add(photoUrl);
    photos.push(photoUrl);
    if (photos.length >= 8) break;
  }
  return photos;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ReviewsSection({ cafeId, opened }: ReviewsSectionProps) {
  const { user, status, openAuthModal } = useAuth();
  const currentUserId = (user?.id ?? "").trim();

  const [sort, setSort] = useState<ReviewSort>("new");
  const [reviews, setReviews] = useState<CafeReview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ratingValue, setRatingValue] = useState("5");
  const [drinkId, setDrinkId] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [summary, setSummary] = useState("");
  const [photosInput, setPhotosInput] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitHint, setSubmitHint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tags = useMemo(() => parseTags(tagsInput), [tagsInput]);
  const photos = useMemo(() => parsePhotoUrls(photosInput), [photosInput]);
  const summaryLength = summary.trim().length;

  const ownReview = useMemo(
    () => reviews.find((item) => item.user_id === currentUserId),
    [currentUserId, reviews],
  );

  const loadReviews = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const next = await listCafeReviews(cafeId, sort);
      setReviews(next);
    } catch (error: any) {
      const message =
        error?.normalized?.message ??
        error?.response?.data?.message ??
        error?.message ??
        "Не удалось загрузить отзывы.";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!opened) return;
    void loadReviews();
  }, [cafeId, opened, sort]);

  useEffect(() => {
    if (!opened) return;
    if (!ownReview) {
      setRatingValue("5");
      setDrinkId("");
      setTagsInput("");
      setSummary("");
      setPhotosInput("");
      return;
    }

    setRatingValue(String(ownReview.rating));
    setDrinkId(ownReview.drink_id ?? "");
    setTagsInput((ownReview.taste_tags ?? []).join(", "));
    setSummary(ownReview.summary ?? "");
    setPhotosInput((ownReview.photos ?? []).join("\n"));
  }, [opened, ownReview?.id]);

  const handleSubmit = async () => {
    if (!currentUserId || status !== "authed") {
      openAuthModal("login");
      return;
    }

    setSubmitError(null);
    setSubmitHint(null);

    const nextDrink = drinkId.trim();
    const nextSummary = summary.trim();
    const rating = Number(ratingValue);

    if (!nextDrink) {
      setSubmitError("Выберите или введите drink_id.");
      return;
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      setSubmitError("Оценка должна быть от 1 до 5.");
      return;
    }
    if (nextSummary.length < MIN_SUMMARY_LENGTH) {
      setSubmitError("Короткий вывод должен быть не короче 60 символов.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (ownReview) {
        await updateReview(ownReview.id, {
          rating,
          drink_id: nextDrink,
          taste_tags: tags,
          summary: nextSummary,
          photos,
        });
        setSubmitHint("Отзыв обновлен.");
      } else {
        await createReview({
          cafe_id: cafeId,
          rating,
          drink_id: nextDrink,
          taste_tags: tags,
          summary: nextSummary,
          photos,
        });
        setSubmitHint("Отзыв опубликован.");
      }
      await loadReviews();
    } catch (error: any) {
      const message =
        error?.normalized?.message ??
        error?.response?.data?.message ??
        error?.message ??
        "Не удалось сохранить отзыв.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack gap="sm">
      <Paper
        withBorder
        radius="md"
        p="md"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <Stack gap="xs">
          <Text fw={600} size="sm">
            {ownReview ? "Редактировать отзыв" : "Оставить отзыв"}
          </Text>

          <SegmentedControl
            fullWidth
            value={ratingValue}
            onChange={setRatingValue}
            data={[
              { label: "1", value: "1" },
              { label: "2", value: "2" },
              { label: "3", value: "3" },
              { label: "4", value: "4" },
              { label: "5", value: "5" },
            ]}
          />

          <TextInput
            label="drink_id"
            placeholder="например: cappuccino"
            value={drinkId}
            onChange={(event) => setDrinkId(event.currentTarget.value)}
            required
          />

          <TextInput
            label="Вкусовые теги"
            description="Через запятую, до 10"
            placeholder="кислинка, шоколад, орех"
            value={tagsInput}
            onChange={(event) => setTagsInput(event.currentTarget.value)}
          />

          <Textarea
            label="Короткий вывод"
            minRows={4}
            maxRows={8}
            value={summary}
            onChange={(event) => setSummary(event.currentTarget.value)}
            placeholder="Что именно пили, какие вкусовые ноты, стоит ли брать повторно"
            required
            styles={{ input: { whiteSpace: "pre-wrap" } }}
          />
          <Text size="xs" c={summaryLength >= MIN_SUMMARY_LENGTH ? "teal" : "dimmed"}>
            {summaryLength}/{MIN_SUMMARY_LENGTH}+ символов
          </Text>

          <Textarea
            label="Фото (URL)"
            description="По одному URL в строке, до 8 фото"
            minRows={3}
            maxRows={6}
            value={photosInput}
            onChange={(event) => setPhotosInput(event.currentTarget.value)}
            placeholder="https://..."
          />

          {submitError && (
            <Text size="sm" c="red">
              {submitError}
            </Text>
          )}
          {submitHint && (
            <Text size="sm" c="teal">
              {submitHint}
            </Text>
          )}

          <Button onClick={handleSubmit} loading={isSubmitting}>
            {ownReview ? "Сохранить изменения" : "Опубликовать отзыв"}
          </Button>
        </Stack>
      </Paper>

      <Group justify="space-between" align="center">
        <Text fw={600} size="sm">
          Отзывы
        </Text>
        <SegmentedControl
          value={sort}
          onChange={(value) => setSort(value as ReviewSort)}
          size="xs"
          data={[
            { label: "Новые", value: "new" },
            { label: "Полезные", value: "helpful" },
            { label: "С визитом", value: "verified" },
          ]}
        />
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
        reviews.map((review) => {
          const isOwn = review.user_id === currentUserId;
          return (
            <Paper
              key={review.id}
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
                      {formatDate(review.updated_at)}
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

                <Group gap={6}>
                  <Badge variant="outline">drink: {review.drink_id}</Badge>
                  <Badge variant="outline">Полезно: {review.helpful_votes}</Badge>
                  <Badge variant="outline">Качество: {review.quality_score}/100</Badge>
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
              </Stack>
            </Paper>
          );
        })}
    </Stack>
  );
}
