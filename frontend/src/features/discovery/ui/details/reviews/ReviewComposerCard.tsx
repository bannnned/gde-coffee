import type { FormEvent, RefObject } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Rating,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { IconPhotoPlus, IconTrash } from "@tabler/icons-react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";

import type { CafeReview } from "../../../../../api/reviews";
import {
  MIN_SUMMARY_LENGTH,
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
  summaryLength: number;
  summaryTrimmedLength: number;
  photos: FormPhoto[];
  uploadingPhotos: boolean;
  submitError: string | null;
  submitHint: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFormSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAppendFiles: (files: FileList | null) => void;
  onRemovePhoto: (photoId: string) => void;
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
  summaryLength,
  summaryTrimmedLength,
  photos,
  uploadingPhotos,
  submitError,
  submitHint,
  fileInputRef,
  onFormSubmit,
  onAppendFiles,
  onRemovePhoto,
}: ReviewComposerCardProps) {
  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <form onSubmit={onFormSubmit}>
        <Stack gap="xs">
          <Text fw={600} size="sm">
            {ownReview ? "Редактировать отзыв" : "Оставить отзыв"}
          </Text>

          <Controller
            control={control}
            name="ratingValue"
            render={({ field }) => (
              <Rating
                value={Number(field.value)}
                onChange={(value) => field.onChange(String(value))}
                count={5}
                allowDeselect={false}
              />
            )}
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
              />
            )}
          />

          <Controller
            control={control}
            name="summary"
            render={({ field }) => (
              <Textarea
                label="Короткий вывод"
                minRows={4}
                maxRows={8}
                value={field.value}
                onChange={(event) => field.onChange(event.currentTarget.value)}
                placeholder="Что именно пили, какие вкусовые ноты, стоит ли брать повторно"
                required
                styles={{ input: { whiteSpace: "pre-wrap" } }}
                error={errors.summary?.message}
              />
            )}
          />

          <Text size="xs" c={summaryTrimmedLength >= MIN_SUMMARY_LENGTH ? "teal" : "dimmed"}>
            Символы: {summaryLength}. Минимум: {MIN_SUMMARY_LENGTH}.
          </Text>

          <Paper
            withBorder
            p="sm"
            radius="md"
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
                  type="button"
                  leftSection={<IconPhotoPlus size={16} />}
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploadingPhotos}
                >
                  Добавить фото
                </Button>
              </Group>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(event) => onAppendFiles(event.currentTarget.files)}
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
                    onClick={() => onRemovePhoto(photo.id)}
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

          <Button type="submit" loading={isSubmitting || uploadingPhotos}>
            {ownReview ? "Сохранить изменения" : "Опубликовать отзыв"}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
