import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { IconPhotoPlus, IconTrash, IconUpload } from "@tabler/icons-react";

import { useAuth } from "../../../../components/AuthGate";
import {
  confirmReviewPhotoUpload,
  createReview,
  listCafeReviews,
  presignReviewPhotoUpload,
  updateReview,
  uploadReviewPhotoByPresignedUrl,
  type CafeReview,
  type ReviewSort,
} from "../../../../api/reviews";
import { searchDrinks, type DrinkSuggestion } from "../../../../api/drinks";

type ReviewsSectionProps = {
  cafeId: string;
  opened: boolean;
};

type FormPhoto = {
  id: string;
  url: string;
  objectKey: string;
};

const MIN_SUMMARY_LENGTH = 60;
const MAX_REVIEW_PHOTOS = 8;
const MAX_UPLOAD_CONCURRENCY = 3;
const REVIEWS_PAGE_SIZE = 20;
const DRINK_SUGGESTIONS_LIMIT = 12;

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;

  const runners = Array.from({ length: safeConcurrency }, async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) return;
      await worker(items[current], current);
    }
  });

  await Promise.all(runners);
}

function makePhotoId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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

function normalizeDrinkInput(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sort, setSort] = useState<ReviewSort>("new");
  const [reviews, setReviews] = useState<CafeReview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState("");

  const [ratingValue, setRatingValue] = useState("5");
  const [drinkId, setDrinkId] = useState("");
  const [drinkQuery, setDrinkQuery] = useState("");
  const [drinkSuggestions, setDrinkSuggestions] = useState<DrinkSuggestion[]>([]);
  const [drinksLoading, setDrinksLoading] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [summary, setSummary] = useState("");
  const [photos, setPhotos] = useState<FormPhoto[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitHint, setSubmitHint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tags = useMemo(() => parseTags(tagsInput), [tagsInput]);
  const summaryLength = summary.trim().length;
  const drinkSelectData = useMemo(
    () =>
      drinkSuggestions.map((item) => ({
        value: item.id,
        label: item.name,
      })),
    [drinkSuggestions],
  );

  const ownReview = useMemo(
    () => reviews.find((item) => item.user_id === currentUserId),
    [currentUserId, reviews],
  );

  const loadFirstPage = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const page = await listCafeReviews(cafeId, { sort, limit: REVIEWS_PAGE_SIZE });
      setReviews(page.reviews);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (error: any) {
      const message =
        error?.normalized?.message ??
        error?.response?.data?.message ??
        error?.message ??
        "Не удалось загрузить отзывы.";
      setLoadError(message);
      setReviews([]);
      setHasMore(false);
      setNextCursor("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!hasMore || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadError(null);
    try {
      const page = await listCafeReviews(cafeId, {
        sort,
        cursor: nextCursor,
        limit: REVIEWS_PAGE_SIZE,
      });
      setReviews((prev) => [...prev, ...page.reviews]);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (error: any) {
      const message =
        error?.normalized?.message ??
        error?.response?.data?.message ??
        error?.message ??
        "Не удалось догрузить отзывы.";
      setLoadError(message);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setDrinksLoading(true);
      searchDrinks(drinkQuery, DRINK_SUGGESTIONS_LIMIT)
        .then((items) => {
          if (cancelled) return;
          setDrinkSuggestions(items);
        })
        .catch(() => {
          if (cancelled) return;
          setDrinkSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) {
            setDrinksLoading(false);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [drinkQuery, opened]);

  useEffect(() => {
    if (!opened) return;
    void loadFirstPage();
  }, [cafeId, opened, sort]);

  useEffect(() => {
    if (!opened) return;
    if (!ownReview) {
      setRatingValue("5");
      setDrinkId("");
      setDrinkQuery("");
      setTagsInput("");
      setSummary("");
      setPhotos([]);
      return;
    }

    setRatingValue(String(ownReview.rating));
    setDrinkId(ownReview.drink_id ?? "");
    setDrinkQuery((ownReview.drink_name ?? ownReview.drink_id ?? "").trim());
    setTagsInput((ownReview.taste_tags ?? []).join(", "));
    setSummary(ownReview.summary ?? "");
    setPhotos(
      (ownReview.photos ?? []).map((url) => ({
        id: makePhotoId(),
        url,
        objectKey: "",
      })),
    );
    if ((ownReview.drink_id ?? "").trim() !== "") {
      setDrinkSuggestions((prev) => {
        if (prev.some((item) => item.id === ownReview.drink_id)) {
          return prev;
        }
        return [
          {
            id: ownReview.drink_id,
            name: (ownReview.drink_name ?? ownReview.drink_id).trim(),
          },
          ...prev,
        ];
      });
    }
  }, [opened, ownReview?.id]);

  const appendFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || uploadingPhotos) return;
    const imageFiles = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setSubmitError("Поддерживаются только изображения.");
      return;
    }

    const availableSlots = Math.max(0, MAX_REVIEW_PHOTOS - photos.length);
    if (availableSlots <= 0) {
      setSubmitError("Можно добавить не больше 8 фото к отзыву.");
      return;
    }
    const files = imageFiles.slice(0, availableSlots);

    setUploadingPhotos(true);
    setSubmitError(null);
    try {
      const uploaded = new Array<FormPhoto>(files.length);
      await runWithConcurrency(files, MAX_UPLOAD_CONCURRENCY, async (file, index) => {
        const presigned = await presignReviewPhotoUpload({
          contentType: file.type,
          sizeBytes: file.size,
        });
        await uploadReviewPhotoByPresignedUrl(
          presigned.upload_url,
          file,
          presigned.headers ?? {},
        );
        const confirmed = await confirmReviewPhotoUpload(presigned.object_key);
        uploaded[index] = {
          id: makePhotoId(),
          url: confirmed.file_url,
          objectKey: confirmed.object_key,
        };
      });

      setPhotos((prev) => [...prev, ...uploaded.filter(Boolean)].slice(0, MAX_REVIEW_PHOTOS));
      if (imageFiles.length > files.length) {
        setSubmitHint("Часть файлов пропущена: достигнут лимит 8 фото.");
      }
    } catch (error: any) {
      const message =
        error?.normalized?.message ??
        error?.response?.data?.message ??
        error?.message ??
        "Не удалось загрузить фото отзыва.";
      setSubmitError(message);
    } finally {
      setUploadingPhotos(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDropUpload = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void appendFiles(event.dataTransfer?.files ?? null);
  };

  const handleDragOverUpload = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleSubmit = async () => {
    if (!currentUserId || status !== "authed") {
      openAuthModal("login");
      return;
    }

    setSubmitError(null);
    setSubmitHint(null);

    const nextDrinkId = drinkId.trim().toLowerCase();
    const nextDrinkName = normalizeDrinkInput(drinkQuery);
    const nextSummary = summary.trim();
    const rating = Number(ratingValue);

    if (!nextDrinkId && !nextDrinkName) {
      setSubmitError("Укажите напиток: выберите из подсказок или введите новый.");
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
      const payload = {
        rating,
        ...(nextDrinkId ? { drink_id: nextDrinkId } : { drink: nextDrinkName }),
        taste_tags: tags,
        summary: nextSummary,
        photos: photos.map((item) => item.url),
      };
      if (ownReview) {
        await updateReview(ownReview.id, payload);
        setSubmitHint("Отзыв обновлен.");
      } else {
        await createReview({
          cafe_id: cafeId,
          ...payload,
        });
        setSubmitHint("Отзыв опубликован.");
      }
      await loadFirstPage();
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

          <Select
            label="Напиток"
            placeholder="Начните вводить название напитка"
            searchable
            required
            value={drinkId || null}
            data={drinkSelectData}
            searchValue={drinkQuery}
            onSearchChange={(value) => {
              setDrinkQuery(value);
              const selected = drinkSuggestions.find((item) => item.id === drinkId);
              if (!selected || selected.name !== value) {
                setDrinkId("");
              }
            }}
            onChange={(value, option) => {
              setDrinkId((value ?? "").trim());
              setDrinkQuery((option?.label ?? "").trim());
            }}
            nothingFoundMessage={drinksLoading ? "Ищем..." : "Ничего не найдено"}
            description="Можно выбрать из справочника или ввести новый формат вручную"
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

          <Paper
            withBorder
            p="sm"
            radius="md"
            onDrop={handleDropUpload}
            onDragOver={handleDragOverUpload}
            style={{
              border: "1px dashed var(--border)",
              background: "var(--surface)",
            }}
          >
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={600}>
                  Фото отзыва
                </Text>
                <Badge variant="light">{photos.length}/8</Badge>
              </Group>
              <Group grow>
                <Button
                  leftSection={<IconPhotoPlus size={16} />}
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploadingPhotos}
                >
                  Выбрать фото
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconUpload size={16} />}
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploadingPhotos}
                >
                  Drag and drop
                </Button>
              </Group>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(event) => void appendFiles(event.currentTarget.files)}
              />
            </Stack>
          </Paper>

          {photos.length > 0 && (
            <Group wrap="nowrap" gap={8} style={{ overflowX: "auto", paddingBottom: 2 }}>
              {photos.map((photo) => (
                <Paper
                  key={photo.id}
                  withBorder
                  radius="sm"
                  style={{
                    width: 96,
                    minWidth: 96,
                    height: 72,
                    overflow: "hidden",
                    position: "relative",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <img
                    src={photo.url}
                    alt="Фото отзыва"
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <ActionIcon
                    size="sm"
                    color="red"
                    variant="filled"
                    aria-label="Удалить фото"
                    style={{ position: "absolute", top: 4, right: 4 }}
                    onClick={() => setPhotos((prev) => prev.filter((item) => item.id !== photo.id))}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                </Paper>
              ))}
            </Group>
          )}

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

          <Button onClick={handleSubmit} loading={isSubmitting || uploadingPhotos}>
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
                  <Badge variant="outline">{review.drink_name || review.drink_id}</Badge>
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

      {!isLoading && !loadError && hasMore && (
        <Button variant="light" onClick={() => void handleLoadMore()} loading={isLoadingMore}>
          Показать еще
        </Button>
      )}
    </Stack>
  );
}
