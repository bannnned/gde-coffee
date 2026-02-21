import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { searchDrinks, type DrinkSuggestion } from "../../../../../api/drinks";
import { reportMetricEvent } from "../../../../../api/metrics";
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
  type ReviewSort,
} from "../../../../../api/reviews";
import { useAuth } from "../../../../../components/AuthGate";
import { extractApiErrorMessage } from "../../../../../utils/apiError";
import {
  DEFAULT_REVIEW_FORM_VALUES,
  DRINK_SUGGESTIONS_LIMIT,
  MAX_REVIEW_PHOTOS,
  MAX_REVIEW_POSITIONS,
  MAX_UPLOAD_CONCURRENCY,
  REVIEWS_PAGE_SIZE,
  buildReviewSummaryFromSections,
  makePhotoId,
  normalizeDrinkInput,
  parseReviewSummarySections,
  parseReviewPositions,
  parseTags,
  reviewFormSchema,
  runWithConcurrency,
  type FormPhoto,
  type ReviewFormValues,
} from "./reviewForm";

type UseReviewsSectionControllerParams = {
  cafeId: string;
  opened: boolean;
  journeyID?: string;
};

export type ReviewQualityInsight = {
  score: number;
  checklist: Array<{
    label: string;
    ok: boolean;
  }>;
  suggestions: string[];
};

function extractErrorMessage(error: unknown, fallback: string): string {
  return extractApiErrorMessage(error, fallback);
}

type GeoPoint = {
  lat: number;
  lng: number;
};

type ActiveCheckIn = {
  id: string;
  status: string;
  distanceMeters: number;
  canVerifyAfter: string;
  minDwellSeconds: number;
};

function secondsToHuman(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 сек";
  const minutes = Math.floor(seconds / 60);
  const leftSeconds = seconds % 60;
  if (minutes <= 0) return `${leftSeconds} сек`;
  if (leftSeconds <= 0) return `${minutes} мин`;
  return `${minutes} мин ${leftSeconds} сек`;
}

function readCanVerifyInSeconds(canVerifyAfterISO: string): number {
  const timestamp = new Date(canVerifyAfterISO).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const diffMs = timestamp - Date.now();
  return diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;
}

function requestCurrentPosition(): Promise<GeoPoint> {
  if (!("geolocation" in navigator)) {
    return Promise.reject(new Error("Геолокация недоступна в этом браузере."));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(error?.message || "Не удалось получить геопозицию."));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30_000,
      },
    );
  });
}

async function waitUntilReviewPhotoReady(photoID: string): Promise<{
  objectKey: string;
  fileURL: string;
}> {
  const timeoutMs = 45_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await getReviewPhotoStatus(photoID);
    const nextStatus = (status.status ?? "").toLowerCase();
    if (nextStatus === "ready" && status.file_url && status.object_key) {
      return {
        objectKey: status.object_key,
        fileURL: status.file_url,
      };
    }
    if (nextStatus === "failed") {
      throw new Error(status.error || "Не удалось обработать фото. Загрузите его снова.");
    }
    const retryAfter = Number(status.retry_after_ms);
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1200;
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }

  throw new Error("Обработка фото заняла слишком много времени. Попробуйте снова.");
}

function buildQualityInsight(review: CafeReview | undefined): ReviewQualityInsight | null {
  if (!review) return null;

  const summaryLength = review.summary.trim().length;
  const hasDrink = review.drink_id.trim().length > 0;
  const hasTags = review.taste_tags.length > 0;
  const hasPhoto = review.photos.length > 0;
  const hasVisitVerification = Boolean(review.visit_verified);
  const noValidAbuseReports = review.confirmed_reports <= 0;

  const suggestions: string[] = [];
  if (!hasPhoto) {
    suggestions.push("добавьте фото");
  }
  if (summaryLength < 100) {
    suggestions.push("добавьте детали о вкусе");
  }
  if (!hasTags) {
    suggestions.push("добавьте вкусовые теги");
  }
  if (!hasVisitVerification) {
    suggestions.push("подтвердите визит");
  }
  if (!noValidAbuseReports) {
    suggestions.push("уточните текст после жалоб");
  }

  // Checklist mirrors public quality criteria so the score is explainable.
  return {
    score: review.quality_score,
    checklist: [
      { label: "Напиток выбран", ok: hasDrink },
      { label: "Есть теги", ok: hasTags },
      { label: "Текст с деталями", ok: summaryLength >= 100 },
      { label: "Есть фото", ok: hasPhoto },
      { label: "Визит подтвержден", ok: hasVisitVerification },
      { label: "Нет валидных жалоб", ok: noValidAbuseReports },
    ],
    suggestions,
  };
}

export function useReviewsSectionController({
  cafeId,
  opened,
  journeyID = "",
}: UseReviewsSectionControllerParams) {
  const { user, status, openAuthModal } = useAuth();
  const currentUserId = (user?.id ?? "").trim();
  const userRole = (user?.role ?? "").toLowerCase();
  const isAdmin = userRole === "admin";
  const canDeleteReviews = userRole === "admin" || userRole === "moderator";

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sort, setSort] = useState<ReviewSort>("new");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [positionOptions, setPositionOptions] = useState<Array<{ key: string; label: string }>>([]);

  const [reviews, setReviews] = useState<CafeReview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState("");

  const [drinkSuggestions, setDrinkSuggestions] = useState<DrinkSuggestion[]>([]);
  const [drinkSearchQuery, setDrinkSearchQuery] = useState("");
  const [drinksLoading, setDrinksLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [helpfulPendingReviewID, setHelpfulPendingReviewID] = useState<string>("");
  const [activeCheckIn, setActiveCheckIn] = useState<ActiveCheckIn | null>(null);
  const [checkInCoords, setCheckInCoords] = useState<GeoPoint | null>(null);
  const [checkInStarting, setCheckInStarting] = useState(false);
  const [verifyVisitPending, setVerifyVisitPending] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitHint, setSubmitHint] = useState<string | null>(null);
  const readReportedRef = useRef<Set<string>>(new Set());
  const normalizedJourneyID = journeyID.trim();

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

  const positionsInput = watch("positionsInput");
  const tagsInputValue = watch("tagsInput");
  const likedValue = watch("liked");
  const dislikedValue = watch("disliked");
  const summaryValue = watch("summary");
  const photos = watch("photos");

  const positionInputData = useMemo(() => {
    const unique = new Set<string>();
    const values: string[] = [];
    for (const item of drinkSuggestions) {
      const normalized = normalizeDrinkInput(item.name);
      if (!normalized || unique.has(normalized)) continue;
      unique.add(normalized);
      values.push(normalized);
    }
    return values;
  }, [drinkSuggestions]);

  const ownReview = useMemo(
    () => reviews.find((item) => item.user_id === currentUserId),
    [currentUserId, reviews],
  );
  const ownReviewQualityInsight = useMemo(() => buildQualityInsight(ownReview), [ownReview]);
  const draftQualitySuggestions = useMemo(() => {
    const suggestions: string[] = [];
    const reviewTextCombined = [likedValue, dislikedValue, summaryValue]
      .map((item) => item.trim())
      .filter(Boolean)
      .join(" ");
    if (photos.length === 0) {
      suggestions.push("добавьте фото");
    }
    if (reviewTextCombined.length < 100) {
      suggestions.push("добавьте детали о вкусе");
    }
    if (parseTags(tagsInputValue).length === 0) {
      suggestions.push("добавьте вкусовые теги");
    }
    if (parseReviewPositions(positionsInput).length < 2) {
      suggestions.push("добавьте еще позицию");
    }
    return suggestions;
  }, [dislikedValue, likedValue, photos.length, positionsInput, summaryValue, tagsInputValue]);

  const activePositionFilter = useMemo(
    () => (positionFilter === "all" ? undefined : positionFilter),
    [positionFilter],
  );

  useEffect(() => {
    readReportedRef.current = new Set();
  }, [cafeId, normalizedJourneyID]);

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const page = await listCafeReviews(cafeId, {
        sort,
        position: activePositionFilter,
        limit: REVIEWS_PAGE_SIZE,
      });
      setReviews(page.reviews);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
      setPositionOptions(
        page.positionOptions.map((item) => ({
          key: item.key,
          label: item.label || item.key,
        })),
      );
    } catch (error: unknown) {
      setLoadError(extractErrorMessage(error, "Не удалось загрузить отзывы."));
      setReviews([]);
      setHasMore(false);
      setNextCursor("");
    } finally {
      setIsLoading(false);
    }
  }, [activePositionFilter, cafeId, sort]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadError(null);
    try {
      const page = await listCafeReviews(cafeId, {
        sort,
        position: activePositionFilter,
        cursor: nextCursor,
        limit: REVIEWS_PAGE_SIZE,
      });
      setReviews((prev) => [...prev, ...page.reviews]);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (error: unknown) {
      setLoadError(extractErrorMessage(error, "Не удалось догрузить отзывы."));
    } finally {
      setIsLoadingMore(false);
    }
  }, [activePositionFilter, cafeId, hasMore, isLoadingMore, nextCursor, sort]);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setDrinksLoading(true);
      searchDrinks(drinkSearchQuery, DRINK_SUGGESTIONS_LIMIT)
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
  }, [drinkSearchQuery, opened]);

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

    const ownReviewPositions = ownReview.positions?.length
      ? ownReview.positions
          .map((item) => normalizeDrinkInput(item.drink_name || item.drink_id))
          .filter(Boolean)
      : [normalizeDrinkInput(ownReview.drink_name || ownReview.drink_id)];
    const summarySections = parseReviewSummarySections(ownReview.summary ?? "");

    reset({
      ratingValue: String(ownReview.rating) as ReviewFormValues["ratingValue"],
      positionsInput: ownReviewPositions.slice(0, MAX_REVIEW_POSITIONS),
      tagsInput: (ownReview.taste_tags ?? []).join(", "),
      liked: summarySections.liked,
      disliked: summarySections.disliked,
      summary: summarySections.summary,
      photos: (ownReview.photos ?? []).map((url) => ({
        id: makePhotoId(),
        url,
        objectKey: "",
      })),
    });
  }, [opened, ownReview, reset]);

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
          let fileURL = confirmed.file_url;
          let objectKey = confirmed.object_key;
          const status = (confirmed.status ?? "").toLowerCase();
          const photoID = (confirmed.photo_id ?? "").trim();

          if ((status === "pending" || status === "processing") && photoID) {
            const ready = await waitUntilReviewPhotoReady(photoID);
            fileURL = ready.fileURL;
            objectKey = ready.objectKey;
          }
          if (!fileURL || !objectKey) {
            throw new Error("Сервер не вернул данные обработанного фото.");
          }

          uploaded[index] = {
            id: makePhotoId(),
            url: fileURL,
            objectKey,
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
      } catch (error: unknown) {
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

    const rating = Number(values.ratingValue);
    const nextSummary = buildReviewSummaryFromSections({
      liked: values.liked,
      disliked: values.disliked,
      summary: values.summary,
    });
    const normalizedPositions = parseReviewPositions(values.positionsInput);
    const knownDrinkIDByName = new Map<string, string>();

    for (const item of drinkSuggestions) {
      const normalizedName = normalizeDrinkInput(item.name);
      if (normalizedName) {
        knownDrinkIDByName.set(normalizedName, item.id);
      }
    }
    for (const item of ownReview?.positions ?? []) {
      const normalizedName = normalizeDrinkInput(item.drink_name);
      if (normalizedName && item.drink_id) {
        knownDrinkIDByName.set(normalizedName, item.drink_id);
      }
    }

    const payloadPositions = normalizedPositions.map((positionName) => {
      const knownID = knownDrinkIDByName.get(positionName);
      if (knownID) {
        return { drink_id: knownID };
      }
      return { drink: positionName };
    });
    const firstPosition = payloadPositions[0];

    // Request includes legacy first-position fields for backward compatibility.
    const payload = {
      rating,
      positions: payloadPositions,
      ...(firstPosition?.drink_id
        ? { drink_id: firstPosition.drink_id }
        : { drink: firstPosition?.drink ?? "" }),
      taste_tags: parseTags(values.tagsInput),
      summary: nextSummary,
      photos: values.photos.map((item) => item.url),
    };

    let savedMessage = "";
    let savedReviewID = "";
    let createdNewReview = false;
    try {
      if (ownReview) {
        const updated = await updateReview(ownReview.id, payload);
        savedReviewID = updated.review_id;
        savedMessage = "Отзыв обновлен.";
      } else {
        const created = await createReview({
          cafe_id: cafeId,
          ...payload,
        });
        savedReviewID = created.review_id;
        createdNewReview = true;
        savedMessage = "Отзыв опубликован.";
      }
    } catch (error: unknown) {
      setSubmitError(extractErrorMessage(error, "Не удалось сохранить отзыв."));
      return;
    }

    if (createdNewReview && savedReviewID && normalizedJourneyID) {
      reportMetricEvent({
        event_type: "review_submit",
        journey_id: normalizedJourneyID,
        cafe_id: cafeId,
        review_id: savedReviewID,
        meta: {
          source: "reviews",
        },
      });
    }

    if (activeCheckIn && checkInCoords && savedReviewID) {
      try {
        const verify = await verifyReviewVisit(savedReviewID, {
          checkin_id: activeCheckIn.id,
          lat: checkInCoords.lat,
          lng: checkInCoords.lng,
        });
        setActiveCheckIn(null);
        if (verify.confidence !== "none") {
          savedMessage = `${savedMessage} Визит подтвержден (${verify.confidence}).`;
        }
      } catch (error: unknown) {
        const verifyMessage = extractErrorMessage(
          error,
          "Отзыв сохранен, но визит пока не подтвержден.",
        );
        savedMessage = `${savedMessage} ${verifyMessage}`;
      }
    }
    setSubmitHint(savedMessage);

    try {
      await loadFirstPage();
    } catch (error: unknown) {
      setLoadError(extractErrorMessage(error, "Отзыв сохранен, но не удалось обновить список."));
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

      const rawReason = window.prompt(
        "Укажите причину удаления: abuse или violation",
        "abuse",
      );
      const normalizedReason = (rawReason ?? "").trim().toLowerCase();
      if (normalizedReason !== "abuse" && normalizedReason !== "violation") {
        setSubmitError("Нужно указать причину удаления: abuse или violation.");
        return;
      }

      const rawDetails = window.prompt(
        "Комментарий модератора (необязательно)",
        "",
      );

      setSubmitError(null);
      setSubmitHint(null);
      try {
        await deleteReview(review.id, {
          reason: normalizedReason,
          details: (rawDetails ?? "").trim(),
        });
        setSubmitHint("Отзыв удален.");
        await loadFirstPage();
      } catch (error: unknown) {
        setSubmitError(extractErrorMessage(error, "Не удалось удалить отзыв."));
      }
    },
    [canDeleteReviews, loadFirstPage],
  );

  const markHelpful = useCallback(
    async (review: CafeReview) => {
      const reviewID = review.id.trim();
      if (!reviewID || helpfulPendingReviewID === reviewID) {
        return;
      }
      if (review.user_id === currentUserId) {
        return;
      }
      if (!currentUserId || status !== "authed") {
        openAuthModal("login");
        return;
      }

      setSubmitError(null);
      setSubmitHint(null);
      setHelpfulPendingReviewID(reviewID);
      try {
        const response = await addHelpfulVote(reviewID);
        if (response.already_exists) {
          setSubmitHint("Вы уже отметили этот отзыв как полезный.");
        } else {
          setSubmitHint("Спасибо, голос учтен.");
        }
        await loadFirstPage();
      } catch (error: unknown) {
        setSubmitError(extractErrorMessage(error, "Не удалось учесть голос полезности."));
      } finally {
        setHelpfulPendingReviewID("");
      }
    },
    [currentUserId, helpfulPendingReviewID, loadFirstPage, openAuthModal, status],
  );

  const startCheckIn = useCallback(async () => {
    if (!currentUserId || status !== "authed") {
      openAuthModal("login");
      return;
    }

    setSubmitError(null);
    setSubmitHint(null);
    setCheckInStarting(true);
    try {
      const point = await requestCurrentPosition();
      const checkIn = await startCafeCheckIn(cafeId, {
        lat: point.lat,
        lng: point.lng,
        source: "browser",
      });
      const next: ActiveCheckIn = {
        id: checkIn.checkin_id,
        status: checkIn.status,
        distanceMeters: Number(checkIn.distance_meters) || 0,
        canVerifyAfter: checkIn.can_verify_after,
        minDwellSeconds: Number(checkIn.min_dwell_seconds) || 0,
      };
      setActiveCheckIn(next);
      setCheckInCoords(point);
      if (normalizedJourneyID) {
        reportMetricEvent({
          event_type: "checkin_start",
          journey_id: normalizedJourneyID,
          cafe_id: cafeId,
          meta: {
            source: "reviews",
            distance_meters: next.distanceMeters,
          },
        });
      }

      const waitSeconds = readCanVerifyInSeconds(checkIn.can_verify_after);
      if (waitSeconds > 0) {
        setSubmitHint(
          `Check-in зафиксирован (${next.distanceMeters}м). Подождите ${secondsToHuman(waitSeconds)}, затем публикуйте отзыв.`,
        );
      } else {
        setSubmitHint(`Check-in зафиксирован (${next.distanceMeters}м). Можно подтверждать визит.`);
      }
    } catch (error: unknown) {
      setSubmitError(extractErrorMessage(error, "Не удалось начать check-in."));
    } finally {
      setCheckInStarting(false);
    }
  }, [cafeId, currentUserId, normalizedJourneyID, openAuthModal, status]);

  const reportReviewRead = useCallback(
    (review: CafeReview) => {
      const reviewID = review.id.trim();
      if (!reviewID || !normalizedJourneyID) return;

      const dedupeKey = `${normalizedJourneyID}:${reviewID}`;
      if (readReportedRef.current.has(dedupeKey)) return;
      readReportedRef.current.add(dedupeKey);

      reportMetricEvent({
        event_type: "review_read",
        journey_id: normalizedJourneyID,
        cafe_id: cafeId,
        review_id: reviewID,
        meta: {
          sort,
          position_filter: activePositionFilter || "all",
        },
      });
    },
    [activePositionFilter, cafeId, normalizedJourneyID, sort],
  );

  const verifyCurrentVisit = useCallback(async () => {
    if (!currentUserId || status !== "authed") {
      openAuthModal("login");
      return;
    }
    if (!ownReview || !activeCheckIn || !checkInCoords) {
      setSubmitError("Сначала начните check-in рядом с кофейней.");
      return;
    }

    setSubmitError(null);
    setSubmitHint(null);
    setVerifyVisitPending(true);
    try {
      const verify = await verifyReviewVisit(ownReview.id, {
        checkin_id: activeCheckIn.id,
        lat: checkInCoords.lat,
        lng: checkInCoords.lng,
      });
      setActiveCheckIn(null);
      setSubmitHint(`Визит подтвержден (${verify.confidence}).`);
      await loadFirstPage();
    } catch (error: unknown) {
      setSubmitError(extractErrorMessage(error, "Не удалось подтвердить визит."));
    } finally {
      setVerifyVisitPending(false);
    }
  }, [activeCheckIn, checkInCoords, currentUserId, loadFirstPage, openAuthModal, ownReview, status]);

  return {
    currentUserId,
    isAdmin,
    canDeleteReviews,
    sort,
    setSort,
    positionFilter,
    setPositionFilter,
    positionOptions,
    isLoading,
    isLoadingMore,
    loadError,
    reviews,
    hasMore,
    ownReview,
    ownReviewQualityInsight,
    draftQualitySuggestions,
    control,
    errors,
    isSubmitting,
    positionInputData,
    positionsInput,
    drinksLoading,
    setDrinkSearchQuery,
    photos,
    uploadingPhotos,
    activeCheckIn,
    checkInStarting,
    verifyVisitPending,
    submitError,
    submitHint,
    fileInputRef,
    onFormSubmit,
    onAppendFiles: (fileList: FileList | null) => {
      void appendFiles(fileList);
    },
    onRemovePhoto: handleRemovePhoto,
    onLoadMore: () => {
      void loadMore();
    },
    onReviewRead: (review: CafeReview) => {
      reportReviewRead(review);
    },
    onDeleteReview: (review: CafeReview) => {
      void deleteReviewByModerator(review);
    },
    helpfulPendingReviewID,
    onMarkHelpful: (review: CafeReview) => {
      void markHelpful(review);
    },
    onStartCheckIn: () => {
      void startCheckIn();
    },
    onVerifyCurrentVisit: () => {
      void verifyCurrentVisit();
    },
  };
}
