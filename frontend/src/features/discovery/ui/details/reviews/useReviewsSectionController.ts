import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { type ComboboxItem } from "@mantine/core";

import { searchDrinks, type DrinkSuggestion } from "../../../../../api/drinks";
import {
  confirmReviewPhotoUpload,
  createReview,
  deleteReview,
  listCafeReviews,
  presignReviewPhotoUpload,
  updateReview,
  uploadReviewPhotoByPresignedUrl,
  type CafeReview,
  type ReviewSort,
} from "../../../../../api/reviews";
import { useAuth } from "../../../../../components/AuthGate";
import {
  DEFAULT_REVIEW_FORM_VALUES,
  DRINK_SUGGESTIONS_LIMIT,
  MAX_REVIEW_PHOTOS,
  MAX_UPLOAD_CONCURRENCY,
  REVIEWS_PAGE_SIZE,
  makePhotoId,
  normalizeDrinkInput,
  parseTags,
  reviewFormSchema,
  runWithConcurrency,
  type FormPhoto,
  type ReviewFormValues,
} from "./reviewForm";

type UseReviewsSectionControllerParams = {
  cafeId: string;
  opened: boolean;
};

function extractErrorMessage(error: any, fallback: string): string {
  return error?.normalized?.message ?? error?.response?.data?.message ?? error?.message ?? fallback;
}

export function useReviewsSectionController({
  cafeId,
  opened,
}: UseReviewsSectionControllerParams) {
  const { user, status, openAuthModal } = useAuth();
  const currentUserId = (user?.id ?? "").trim();
  const userRole = (user?.role ?? "").toLowerCase();
  const canDeleteReviews = userRole === "admin" || userRole === "moderator";

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sort, setSort] = useState<ReviewSort>("new");
  const [reviews, setReviews] = useState<CafeReview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState("");

  const [drinkSuggestions, setDrinkSuggestions] = useState<DrinkSuggestion[]>([]);
  const [drinksLoading, setDrinksLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitHint, setSubmitHint] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: DEFAULT_REVIEW_FORM_VALUES,
  });

  const drinkIdValue = watch("drinkId");
  const drinkQueryValue = watch("drinkQuery");
  const summaryValue = watch("summary");
  const photos = watch("photos");

  const summaryLength = summaryValue.length;
  const summaryTrimmedLength = summaryValue.trim().length;

  const drinkSelectData = useMemo<ComboboxItem[]>(
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

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const page = await listCafeReviews(cafeId, { sort, limit: REVIEWS_PAGE_SIZE });
      setReviews(page.reviews);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (error: any) {
      setLoadError(extractErrorMessage(error, "Не удалось загрузить отзывы."));
      setReviews([]);
      setHasMore(false);
      setNextCursor("");
    } finally {
      setIsLoading(false);
    }
  }, [cafeId, sort]);

  const loadMore = useCallback(async () => {
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
      setLoadError(extractErrorMessage(error, "Не удалось догрузить отзывы."));
    } finally {
      setIsLoadingMore(false);
    }
  }, [cafeId, hasMore, isLoadingMore, nextCursor, sort]);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setDrinksLoading(true);
      searchDrinks(drinkQueryValue, DRINK_SUGGESTIONS_LIMIT)
        .then((items) => {
          if (!cancelled) {
            setDrinkSuggestions(items);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDrinkSuggestions([]);
          }
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
  }, [drinkQueryValue, opened]);

  useEffect(() => {
    if (!opened) return;
    void loadFirstPage();
  }, [loadFirstPage, opened]);

  useEffect(() => {
    if (!opened) return;
    if (!ownReview) {
      reset(DEFAULT_REVIEW_FORM_VALUES);
      return;
    }

    reset({
      ratingValue: String(ownReview.rating) as ReviewFormValues["ratingValue"],
      drinkId: ownReview.drink_id ?? "",
      drinkQuery: (ownReview.drink_name ?? ownReview.drink_id ?? "").trim(),
      tagsInput: (ownReview.taste_tags ?? []).join(", "),
      summary: ownReview.summary ?? "",
      photos: (ownReview.photos ?? []).map((url) => ({
        id: makePhotoId(),
        url,
        objectKey: "",
      })),
    });

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
  }, [opened, ownReview, reset]);

  const handleDrinkSearchChange = useCallback(
    (value: string) => {
      setValue("drinkQuery", value, { shouldDirty: true, shouldValidate: true });
      const selected = drinkSuggestions.find((item) => item.id === drinkIdValue);
      if (!selected || selected.name !== value) {
        setValue("drinkId", "", { shouldDirty: true, shouldValidate: true });
      }
      if (value.trim()) {
        clearErrors("drinkQuery");
      }
    },
    [clearErrors, drinkIdValue, drinkSuggestions, setValue],
  );

  const handleDrinkChange = useCallback(
    (value: string | null, option: ComboboxItem | null) => {
      setValue("drinkId", (value ?? "").trim(), { shouldDirty: true, shouldValidate: true });
      setValue("drinkQuery", (option?.label ?? "").trim(), {
        shouldDirty: true,
        shouldValidate: true,
      });
      clearErrors("drinkQuery");
    },
    [clearErrors, setValue],
  );

  const appendFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0 || uploadingPhotos) return;
      const currentPhotos = getValues("photos");
      const imageFiles = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length === 0) {
        setSubmitError("Поддерживаются только изображения.");
        return;
      }

      const availableSlots = Math.max(0, MAX_REVIEW_PHOTOS - currentPhotos.length);
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
          await uploadReviewPhotoByPresignedUrl(presigned.upload_url, file, presigned.headers ?? {});
          const confirmed = await confirmReviewPhotoUpload(presigned.object_key);
          uploaded[index] = {
            id: makePhotoId(),
            url: confirmed.file_url,
            objectKey: confirmed.object_key,
          };
        });

        setValue("photos", [...currentPhotos, ...uploaded.filter(Boolean)].slice(0, MAX_REVIEW_PHOTOS), {
          shouldDirty: true,
          shouldValidate: true,
        });
        clearErrors("photos");

        if (imageFiles.length > files.length) {
          setSubmitHint("Часть файлов пропущена: достигнут лимит 8 фото.");
        }
      } catch (error: any) {
        setSubmitError(extractErrorMessage(error, "Не удалось загрузить фото отзыва."));
      } finally {
        setUploadingPhotos(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [clearErrors, getValues, setValue, uploadingPhotos],
  );

  const handleRemovePhoto = useCallback(
    (photoId: string) => {
      setValue(
        "photos",
        photos.filter((item) => item.id !== photoId),
        { shouldDirty: true, shouldValidate: true },
      );
    },
    [photos, setValue],
  );

  const handleReviewSubmit = handleSubmit(async (values) => {
    if (!currentUserId || status !== "authed") {
      openAuthModal("login");
      return;
    }

    setSubmitError(null);
    setSubmitHint(null);

    const nextDrinkId = values.drinkId.trim().toLowerCase();
    const nextDrinkName = normalizeDrinkInput(values.drinkQuery);
    const nextSummary = values.summary.trim();
    const rating = Number(values.ratingValue);

    // Keep payload normalized: either canonical drink_id or free-form drink for unknown formats.
    const payload = {
      rating,
      ...(nextDrinkId ? { drink_id: nextDrinkId } : { drink: nextDrinkName }),
      taste_tags: parseTags(values.tagsInput),
      summary: nextSummary,
      photos: values.photos.map((item) => item.url),
    };

    try {
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
      setSubmitError(extractErrorMessage(error, "Не удалось сохранить отзыв."));
    }
  });

  const onFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleReviewSubmit();
    },
    [handleReviewSubmit],
  );

  const deleteReviewByModerator = useCallback(
    async (review: CafeReview) => {
      if (!canDeleteReviews) return;
      const ok = window.confirm("Удалить этот отзыв?");
      if (!ok) return;

      setSubmitError(null);
      setSubmitHint(null);
      try {
        await deleteReview(review.id);
        setSubmitHint("Отзыв удален.");
        await loadFirstPage();
      } catch (error: any) {
        setSubmitError(extractErrorMessage(error, "Не удалось удалить отзыв."));
      }
    },
    [canDeleteReviews, loadFirstPage],
  );

  return {
    currentUserId,
    canDeleteReviews,
    sort,
    setSort,
    isLoading,
    isLoadingMore,
    loadError,
    reviews,
    hasMore,
    ownReview,
    control,
    errors,
    isSubmitting,
    drinkSelectData,
    drinkIdValue,
    drinkQueryValue,
    drinksLoading,
    summaryLength,
    summaryTrimmedLength,
    photos,
    uploadingPhotos,
    submitError,
    submitHint,
    fileInputRef,
    onFormSubmit,
    onDrinkSearchChange: handleDrinkSearchChange,
    onDrinkChange: handleDrinkChange,
    onAppendFiles: (fileList: FileList | null) => {
      void appendFiles(fileList);
    },
    onRemovePhoto: handleRemovePhoto,
    onLoadMore: () => {
      void loadMore();
    },
    onDeleteReview: (review: CafeReview) => {
      void deleteReviewByModerator(review);
    },
  };
}
