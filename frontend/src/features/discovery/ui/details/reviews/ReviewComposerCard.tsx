import type { FormEvent, RefObject } from "react";
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
  type ComboboxItem,
} from "@mantine/core";
import { IconPhotoPlus, IconTrash } from "@tabler/icons-react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";

import type { CafeReview } from "../../../../../api/reviews";
import {
  MIN_SUMMARY_LENGTH,
  type FormPhoto,
  type ReviewFormValues,
} from "./reviewForm";

type ReviewComposerCardProps = {
  ownReview: CafeReview | undefined;
  control: Control<ReviewFormValues>;
  errors: FieldErrors<ReviewFormValues>;
  isSubmitting: boolean;
  drinkSelectData: ComboboxItem[];
  drinkIdValue: string;
  drinkQueryValue: string;
  drinksLoading: boolean;
  summaryLength: number;
  summaryTrimmedLength: number;
  photos: FormPhoto[];
  uploadingPhotos: boolean;
  submitError: string | null;
  submitHint: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFormSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDrinkSearchChange: (value: string) => void;
  onDrinkChange: (value: string | null, option: ComboboxItem | null) => void;
  onAppendFiles: (files: FileList | null) => void;
  onRemovePhoto: (photoId: string) => void;
};

export function ReviewComposerCard({
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
  onDrinkSearchChange,
  onDrinkChange,
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
              <SegmentedControl
                fullWidth
                value={field.value}
                onChange={field.onChange}
                data={[
                  { label: "1", value: "1" },
                  { label: "2", value: "2" },
                  { label: "3", value: "3" },
                  { label: "4", value: "4" },
                  { label: "5", value: "5" },
                ]}
              />
            )}
          />

          <Select
            label="Напиток"
            placeholder="Начните вводить название напитка"
            searchable
            required
            value={drinkIdValue || null}
            data={drinkSelectData}
            searchValue={drinkQueryValue}
            onSearchChange={onDrinkSearchChange}
            onChange={onDrinkChange}
            nothingFoundMessage={drinksLoading ? "Ищем..." : "Ничего не найдено"}
            description="Можно выбрать из справочника или ввести новый формат вручную"
            error={errors.drinkQuery?.message}
          />

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

          <Button type="submit" loading={isSubmitting || uploadingPhotos}>
            {ownReview ? "Сохранить изменения" : "Опубликовать отзыв"}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
