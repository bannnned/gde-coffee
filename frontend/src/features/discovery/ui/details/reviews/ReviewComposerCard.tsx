import type { FormEvent, RefObject } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Popover,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  UnstyledButton,
} from "@mantine/core";
import {
  IconHelpCircle,
  IconPhotoPlus,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";

import type { CafeReview } from "../../../../../api/reviews";
import {
  type FormPhoto,
  type ReviewFormValues,
} from "./reviewForm";
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

  const roundedInputStyles = {
    input: {
      borderRadius: 14,
      border: "1px solid var(--glass-border)",
      background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
      boxShadow: "var(--glass-shadow)",
      backdropFilter: "blur(10px) saturate(130%)",
      WebkitBackdropFilter: "blur(10px) saturate(130%)",
    },
    label: {
      fontWeight: 600,
      marginBottom: 4,
    },
    description: {
      color: "var(--muted)",
    },
  } as const;

  return (
    <Paper
      withBorder
      radius="lg"
      p="md"
      style={{
        background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      <form onSubmit={onFormSubmit}>
        <Stack gap="sm">
          <Text fw={600} size="sm">
            {ownReview ? "Редактировать отзыв" : "Оставить отзыв"}
          </Text>

          <Controller
            control={control}
            name="ratingValue"
            render={({ field }) => {
              const ratingValue = Number(field.value) || 0;
              return (
                <Stack gap={6}>
                  <Text size="sm" fw={600}>
                    Оценка
                  </Text>
                  <Group gap={8} wrap="nowrap" grow>
                    {Array.from({ length: 5 }, (_, idx) => {
                      const starValue = idx + 1;
                      const isActive = starValue <= ratingValue;
                      return (
                        <UnstyledButton
                          key={`rating-star-${starValue}`}
                          type="button"
                          aria-label={`Поставить ${starValue} из 5`}
                          onClick={() => field.onChange(String(starValue))}
                          style={{
                            height: 42,
                            borderRadius: 14,
                            border: "1px solid var(--glass-border)",
                            background: isActive
                              ? "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent) 70%, white), var(--color-brand-accent))"
                              : "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
                            color: isActive ? "var(--color-on-accent)" : "var(--muted)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "var(--glass-shadow)",
                            transition: "transform 140ms ease, background 180ms ease, color 180ms ease",
                          }}
                        >
                          {isActive ? <IconStarFilled size={18} /> : <IconStar size={18} />}
                        </UnstyledButton>
                      );
                    })}
                  </Group>
                </Stack>
              );
            }}
          />

          <Controller
            control={control}
            name="positionsInput"
            render={({ field }) => (
              <TagsInput
                label="Напиток"
                placeholder="Добавьте позиции: эспрессо, воронка v60, фильтр"
                description="Можно выбрать из подсказок или добавить свой формат"
                value={field.value}
                data={positionInputData}
                maxTags={8}
                splitChars={[","]}
                clearable
                searchable
                required
                onSearchChange={onPositionsInputSearchChange}
                onChange={(value) => field.onChange(value)}
                nothingFoundMessage={drinksLoading ? "Ищем..." : "Ничего не найдено"}
                error={errors.positionsInput?.message}
                styles={roundedInputStyles}
              />
            )}
          />

          <Text size="xs" c="dimmed">
            Позиции: {positionsInput.length}/8.
          </Text>

          <Controller
            control={control}
            name="tagsInput"
            render={({ field }) => (
              <TextInput
                label="Вкусовые теги"
                description="Через запятую, до 10"
                placeholder="кислинка, шоколад, орех"
                value={field.value}
                onChange={(event) => field.onChange(event.currentTarget.value)}
                styles={roundedInputStyles}
              />
            )}
          />

          <Controller
            control={control}
            name="liked"
            render={({ field }) => (
              <Textarea
                label="Понравилось"
                minRows={2}
                maxRows={6}
                value={field.value}
                onChange={(event) => field.onChange(event.currentTarget.value)}
                placeholder="Что получилось особенно хорошо"
                styles={{
                  ...roundedInputStyles,
                  input: {
                    ...roundedInputStyles.input,
                    whiteSpace: "pre-wrap",
                    minHeight: 78,
                  },
                }}
              />
            )}
          />

          <Controller
            control={control}
            name="disliked"
            render={({ field }) => (
              <Textarea
                label="Не понравилось"
                minRows={2}
                maxRows={6}
                value={field.value}
                onChange={(event) => field.onChange(event.currentTarget.value)}
                placeholder="Что бы вы улучшили"
                styles={{
                  ...roundedInputStyles,
                  input: {
                    ...roundedInputStyles.input,
                    whiteSpace: "pre-wrap",
                    minHeight: 78,
                  },
                }}
              />
            )}
          />

          <Controller
            control={control}
            name="summary"
            render={({ field }) => (
              <Textarea
                label="Короткий вывод"
                minRows={3}
                maxRows={7}
                value={field.value}
                onChange={(event) => field.onChange(event.currentTarget.value)}
                placeholder="Для кого место и стоит ли вернуться"
                styles={{
                  ...roundedInputStyles,
                  input: {
                    ...roundedInputStyles.input,
                    whiteSpace: "pre-wrap",
                    minHeight: 98,
                  },
                }}
                error={errors.summary?.message}
              />
            )}
          />

          <Stack gap={6}>
            <Group justify="space-between" align="center">
              <Group gap={6} align="center">
                <Text size="sm" fw={600}>
                  Верификация визита
                </Text>
                <Popover width={240} position="bottom-start" withArrow shadow="md">
                  <Popover.Target>
                    <ActionIcon size="sm" radius="xl" variant="subtle" aria-label="Как работает верификация">
                      <IconHelpCircle size={15} />
                    </ActionIcon>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <Text size="xs">
                      Нажмите I&apos;m here в кофейне, подождите несколько минут и опубликуйте/обновите отзыв.
                      Если check-in активен, можно отдельно нажать подтверждение.
                    </Text>
                  </Popover.Dropdown>
                </Popover>
              </Group>
              {activeCheckIn && (
                <Badge size="xs" variant="light" color="teal">
                  check-in активен
                </Badge>
              )}
            </Group>
            <Group gap={8} wrap="wrap">
              <Button
                type="button"
                variant="light"
                loading={checkInStarting}
                onClick={onStartCheckIn}
                radius="xl"
              >
                I&apos;m here
              </Button>
              {ownReview && activeCheckIn && (
                <Button
                  type="button"
                  variant="default"
                  loading={verifyVisitPending}
                  onClick={onVerifyCurrentVisit}
                  radius="xl"
                >
                  Подтвердить визит
                </Button>
              )}
            </Group>
            {activeCheckIn && (
              <Text size="xs" c="dimmed">
                Дистанция: {activeCheckIn.distanceMeters}м. После выдержки времени опубликуйте отзыв: визит подтвердится автоматически.
              </Text>
            )}
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Фото отзыва
              </Text>
              <Badge variant="light">{photos.length}/8</Badge>
            </Group>

            <Box
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {photos.map((photo) => (
                <Box
                  key={photo.id}
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    overflow: "hidden",
                    borderRadius: 14,
                    position: "relative",
                    border: "1px solid var(--glass-border)",
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
                    style={{ position: "absolute", top: 6, right: 6 }}
                    onClick={() => onRemovePhoto(photo.id)}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                </Box>
              ))}

              {Array.from({ length: addPhotoTilesCount }, (_, idx) => (
                <UnstyledButton
                  key={`add-photo-slot-${idx + 1}`}
                  type="button"
                  aria-label="Добавить фото"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: 14,
                    border: "1px dashed color-mix(in srgb, var(--color-brand-accent) 55%, var(--border))",
                    background:
                      "repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 30%, transparent), color-mix(in srgb, var(--color-brand-accent-soft) 30%, transparent) 6px, transparent 6px, transparent 12px)",
                    color: "var(--color-brand-accent)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "var(--glass-shadow)",
                  }}
                >
                  {uploadingPhotos ? <IconPhotoPlus size={20} /> : <IconPlus size={22} />}
                </UnstyledButton>
              ))}
            </Box>

            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => onAppendFiles(event.currentTarget.files)}
            />
          </Stack>

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

          {ownReviewQualityInsight && (
            <Paper
              withBorder
              p="sm"
              radius="md"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <Stack gap={6}>
                <Text size="sm" fw={600}>
                  Качество отзыва: {ownReviewQualityInsight.score}/100
                </Text>
                <Group gap={6} wrap="wrap">
                  {ownReviewQualityInsight.checklist.map((item) => (
                    <Badge
                      key={item.label}
                      size="xs"
                      variant={item.ok ? "light" : "outline"}
                      color={item.ok ? "teal" : "gray"}
                    >
                      {item.label}
                    </Badge>
                  ))}
                </Group>
                {ownReviewQualityInsight.suggestions.length > 0 && (
                  <Text size="xs" c="dimmed">
                    Чтобы повысить оценку: {ownReviewQualityInsight.suggestions.slice(0, 2).join(", ")}.
                  </Text>
                )}
              </Stack>
            </Paper>
          )}
          {!ownReviewQualityInsight && draftQualitySuggestions.length > 0 && (
            <Text size="xs" c="dimmed">
              Чтобы улучшить отзыв: {draftQualitySuggestions.slice(0, 2).join(", ")}.
            </Text>
          )}

          <Button
            type="submit"
            loading={submitLoading}
            className="review-submit-button"
            data-submitting={submitLoading ? "true" : "false"}
            radius="xl"
          >
            {ownReview ? "Сохранить изменения" : "Опубликовать отзыв"}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
