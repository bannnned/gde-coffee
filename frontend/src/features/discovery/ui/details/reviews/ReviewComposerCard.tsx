import { useMemo, type FormEvent, type RefObject } from "react";
import {
  IconHelpCircle,
  IconPhotoPlus,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";

import {
  Badge,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../../../components/ui";
import { cn } from "../../../../../lib/utils";
import { AppTagsInput } from "../../../../../ui/bridge";
import type { CafeReview } from "../../../../../api/reviews";
import { type FormPhoto, type ReviewFormValues } from "./reviewForm";
import type { ReviewQualityInsight } from "./useReviewsSectionController";

type ReviewComposerCardProps = {
  ownReview: CafeReview | undefined;
  ownReviewQualityInsight: ReviewQualityInsight | null;
  draftQualitySuggestions: string[];
  control: Control<ReviewFormValues>;
  errors: FieldErrors<ReviewFormValues>;
  isSubmitting: boolean;
  positionsInput: string[];
  positionInputData: string[];
  drinksLoading: boolean;
  onPositionsInputSearchChange: (value: string) => void;
  photos: FormPhoto[];
  uploadingPhotos: boolean;
  activeCheckIn: {
    id: string;
    status: string;
    distanceMeters: number;
    canVerifyAfter: string;
    minDwellSeconds: number;
  } | null;
  checkInStarting: boolean;
  verifyVisitPending: boolean;
  submitError: string | null;
  submitHint: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFormSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAppendFiles: (files: FileList | null) => void;
  onRemovePhoto: (photoId: string) => void;
  onStartCheckIn: () => void;
  onVerifyCurrentVisit: () => void;
};

const glassInputStyle = {
  borderRadius: 14,
  border: "1px solid var(--glass-border)",
  background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
  boxShadow: "var(--glass-shadow)",
  backdropFilter: "blur(10px) saturate(130%)",
  WebkitBackdropFilter: "blur(10px) saturate(130%)",
} as const;

const tagsInputStyles = {
  input: glassInputStyle,
  dropdown: {
    borderRadius: 14,
    border: "1px solid var(--glass-border)",
    background: "var(--color-surface-card)",
  },
  pill: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  },
} as const;

export function ReviewComposerCard({
  ownReview,
  ownReviewQualityInsight,
  draftQualitySuggestions,
  control,
  errors,
  isSubmitting,
  positionsInput,
  positionInputData,
  drinksLoading,
  onPositionsInputSearchChange,
  photos,
  uploadingPhotos,
  activeCheckIn,
  checkInStarting,
  verifyVisitPending,
  submitError,
  submitHint,
  fileInputRef,
  onFormSubmit,
  onAppendFiles,
  onRemovePhoto,
  onStartCheckIn,
  onVerifyCurrentVisit,
}: ReviewComposerCardProps) {
  const submitLoading = isSubmitting || uploadingPhotos;
  const remainingPhotoSlots = Math.max(0, 8 - photos.length);
  const addPhotoTilesCount = Math.min(3, remainingPhotoSlots);
  const positionsError = errors.positionsInput?.message
    ? String(errors.positionsInput.message)
    : null;
  const improveError = errors.improve?.message ? String(errors.improve.message) : null;
  const normalizedPositionInputData = useMemo(() => {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const value of positionInputData) {
      const trimmed = value.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      unique.push(trimmed);
    }
    return unique;
  }, [positionInputData]);

  return (
    <div
      className="rounded-[18px] border border-[var(--glass-border)] p-4 shadow-[var(--glass-shadow)]"
      style={{
        background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
      }}
    >
      <form onSubmit={onFormSubmit}>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-[var(--text)]">
            {ownReview ? "Редактировать отзыв" : "Оставить отзыв"}
          </p>

          <Controller
            control={control}
            name="ratingValue"
            render={({ field }) => {
              const ratingValue = Number(field.value) || 0;
              return (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-semibold text-[var(--text)]">Оценка</p>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 5 }, (_, idx) => {
                      const starValue = idx + 1;
                      const isActive = starValue <= ratingValue;
                      return (
                        <button
                          key={`rating-star-${starValue}`}
                          type="button"
                          aria-label={`Поставить ${starValue} из 5`}
                          onClick={() => field.onChange(String(starValue))}
                          className={cn(
                            "inline-flex h-10 items-center justify-center rounded-[14px] border ui-focus-ring ui-interactive",
                            isActive
                              ? "text-[var(--color-on-accent)]"
                              : "text-[var(--muted)]",
                          )}
                          style={{
                            borderColor: "var(--glass-border)",
                            background: isActive
                              ? "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent) 70%, white), var(--color-brand-accent))"
                              : "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
                            boxShadow: "var(--glass-shadow)",
                          }}
                        >
                          {isActive ? <IconStarFilled size={18} /> : <IconStar size={18} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }}
          />

          <Controller
            control={control}
            name="positionsInput"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-[var(--text)]">Напиток</p>
                <p className="text-xs text-[var(--muted)]">
                  Можно выбрать из подсказок или добавить свой формат
                </p>
                <AppTagsInput
                  implementation="radix"
                  placeholder="Добавьте позиции: эспрессо, воронка v60, фильтр"
                  value={field.value}
                  data={normalizedPositionInputData}
                  maxTags={8}
                  splitChars={[","]}
                  clearable
                  searchable
                  required
                  onSearchChange={onPositionsInputSearchChange}
                  onChange={(value) => field.onChange(value)}
                  nothingFoundMessage={drinksLoading ? "Ищем..." : "Ничего не найдено"}
                  error={positionsError ?? undefined}
                  styles={tagsInputStyles}
                />
              </div>
            )}
          />

          <p className="text-xs text-[var(--muted)]">Позиции: {positionsInput.length}/8.</p>

          <Controller
            control={control}
            name="tagsInput"
            render={({ field }) => (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Вкусовые теги</span>
                <span className="text-xs text-[var(--muted)]">Через запятую, до 10</span>
                <Input
                  value={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.value)}
                  placeholder="кислинка, шоколад, орех"
                  style={glassInputStyle}
                />
              </label>
            )}
          />

          <Controller
            control={control}
            name="liked"
            render={({ field }) => (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Понравилось</span>
                <textarea
                  value={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.value)}
                  placeholder="Что получилось особенно хорошо"
                  rows={3}
                  className="min-h-[78px] w-full resize-y rounded-[14px] border px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] ui-interactive ui-focus-ring"
                  style={glassInputStyle}
                />
              </label>
            )}
          />

          <Controller
            control={control}
            name="improve"
            render={({ field }) => (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Что улучшить</span>
                <textarea
                  value={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.value)}
                  placeholder="Что бы вы улучшили"
                  rows={3}
                  className="min-h-[78px] w-full resize-y rounded-[14px] border px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] ui-interactive ui-focus-ring"
                  style={glassInputStyle}
                />
                {improveError ? <p className="text-xs text-danger">{improveError}</p> : null}
              </label>
            )}
          />

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-[var(--text)]">Верификация визита</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Как работает верификация"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--surface)] text-[var(--muted)] ui-focus-ring ui-interactive"
                    >
                      <IconHelpCircle size={15} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-60">
                    <p className="text-xs text-[var(--text)]">
                      Нажмите I&apos;m here в кофейне, подождите несколько минут и
                      опубликуйте/обновите отзыв. Если check-in активен, можно отдельно
                      нажать подтверждение.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
              {activeCheckIn ? (
                <Badge variant="secondary" className="text-[10px]">
                  check-in активен
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="rounded-full"
                onClick={onStartCheckIn}
                disabled={checkInStarting}
              >
                {checkInStarting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Запуск...
                  </>
                ) : (
                  "I'm here"
                )}
              </Button>
              {ownReview && activeCheckIn ? (
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={onVerifyCurrentVisit}
                  disabled={verifyVisitPending}
                >
                  {verifyVisitPending ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Проверяем...
                    </>
                  ) : (
                    "Подтвердить визит"
                  )}
                </Button>
              ) : null}
            </div>

            {activeCheckIn ? (
              <p className="text-xs text-[var(--muted)]">
                Дистанция: {activeCheckIn.distanceMeters}м. После выдержки времени
                опубликуйте отзыв: визит подтвердится автоматически.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text)]">Фото отзыва</p>
              <Badge variant="secondary">{photos.length}/8</Badge>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square overflow-hidden rounded-[14px] border border-[var(--glass-border)] bg-[var(--surface)]"
                >
                  <img
                    src={photo.url}
                    alt="Фото отзыва"
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Удалить фото"
                    className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-status-error)] bg-[var(--color-status-error)] text-white ui-focus-ring ui-interactive"
                    onClick={() => onRemovePhoto(photo.id)}
                  >
                    <IconTrash size={12} />
                  </button>
                </div>
              ))}

              {Array.from({ length: addPhotoTilesCount }, (_, idx) => (
                <button
                  key={`add-photo-slot-${idx + 1}`}
                  type="button"
                  aria-label="Добавить фото"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex aspect-square items-center justify-center rounded-[14px] border border-dashed ui-focus-ring ui-interactive"
                  style={{
                    borderColor:
                      "color-mix(in srgb, var(--color-brand-accent) 55%, var(--border))",
                    background:
                      "repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 30%, transparent), color-mix(in srgb, var(--color-brand-accent-soft) 30%, transparent) 6px, transparent 6px, transparent 12px)",
                    color: "var(--color-brand-accent)",
                    boxShadow: "var(--glass-shadow)",
                  }}
                >
                  {uploadingPhotos ? <IconPhotoPlus size={20} /> : <IconPlus size={22} />}
                </button>
              ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => onAppendFiles(event.currentTarget.files)}
            />
          </div>

          {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
          {submitHint ? <p className="text-sm text-[var(--color-status-success)]">{submitHint}</p> : null}

          {ownReviewQualityInsight ? (
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-[var(--text)]">
                  Качество отзыва: {Number(ownReviewQualityInsight.score) || 0}/100
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ownReviewQualityInsight.checklist.map((item) => (
                    <Badge
                      key={item.label}
                      variant={item.ok ? "secondary" : "outline"}
                      className={cn(item.ok ? "" : "text-[var(--muted)]")}
                    >
                      {item.label}
                    </Badge>
                  ))}
                </div>
                {ownReviewQualityInsight.suggestions.length > 0 ? (
                  <p className="text-xs text-[var(--muted)]">
                    Чтобы повысить оценку:{" "}
                    {ownReviewQualityInsight.suggestions.slice(0, 2).join(", ")}.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {!ownReviewQualityInsight && draftQualitySuggestions.length > 0 ? (
            <p className="text-xs text-[var(--muted)]">
              Чтобы улучшить отзыв: {draftQualitySuggestions.slice(0, 2).join(", ")}.
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={submitLoading}
            className="review-submit-button rounded-full"
            data-submitting={submitLoading ? "true" : "false"}
          >
            {submitLoading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Сохраняем...
              </>
            ) : ownReview ? (
              "Сохранить изменения"
            ) : (
              "Опубликовать отзыв"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
