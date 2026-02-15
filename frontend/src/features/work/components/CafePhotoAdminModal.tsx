import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowsSort,
  IconChevronDown,
  IconChevronUp,
  IconPhotoPlus,
  IconStar,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";

import {
  confirmCafePhotoUpload,
  deleteCafePhoto,
  getCafePhotos,
  presignCafePhotoUpload,
  reorderCafePhotos,
  setCafePhotoCover,
  uploadCafePhotoByPresignedUrl,
} from "../../../api/cafePhotos";
import type { CafePhoto } from "../types";

type CafePhotoAdminModalProps = {
  opened: boolean;
  cafeId: string | null;
  cafeName: string;
  initialPhotos?: CafePhoto[];
  onClose: () => void;
  onPhotosChanged?: (photos: CafePhoto[]) => void;
};

const MAX_UPLOAD_CONCURRENCY = 3;

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  const runners = Array.from({ length: safeConcurrency }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
}

export default function CafePhotoAdminModal({
  opened,
  cafeId,
  cafeName,
  initialPhotos = [],
  onClose,
  onPhotosChanged,
}: CafePhotoAdminModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [photos, setPhotos] = useState<CafePhoto[]>(initialPhotos);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setPhotos(initialPhotos);
    setOrderDirty(false);
  }, [opened, initialPhotos]);

  useEffect(() => {
    if (!opened || !cafeId) return;
    let cancelled = false;
    setIsLoading(true);
    setLastError(null);
    getCafePhotos(cafeId)
      .then((list) => {
        if (cancelled) return;
        setPhotos(list);
        setOrderDirty(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        const message =
          err?.normalized?.message ?? err?.response?.data?.message ?? "Не удалось загрузить фото.";
        setLastError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [opened, cafeId]);

  const canSaveOrder = orderDirty && !isSavingOrder && !isUploading && Boolean(cafeId);
  const photosCountLabel = useMemo(() => {
    if (photos.length === 0) return "Фото пока нет";
    return photos.length === 1 ? "1 фото" : `${photos.length} фото`;
  }, [photos.length]);

  const handlePickFiles = () => {
    fileInputRef.current?.click();
  };

  const publishPhotos = (next: CafePhoto[]) => {
    setPhotos(next);
    onPhotosChanged?.(next);
  };

  const handleUploadFiles = async (fileList: FileList | File[] | null) => {
    if (!cafeId || !fileList || fileList.length === 0 || isUploading) return;
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) {
      notifications.show({
        color: "orange",
        title: "Нужны изображения",
        message: "Выберите файлы JPG/PNG/WEBP/AVIF.",
      });
      return;
    }

    setIsUploading(true);
    setLastError(null);
    try {
      const hadNoPhotos = photos.length === 0;
      await runWithConcurrency(files, MAX_UPLOAD_CONCURRENCY, async (file, idx) => {
        const presigned = await presignCafePhotoUpload(cafeId, {
          contentType: file.type,
          sizeBytes: file.size,
        });
        await uploadCafePhotoByPresignedUrl(presigned.upload_url, file, presigned.headers ?? {});
        await confirmCafePhotoUpload(cafeId, {
          objectKey: presigned.object_key,
          isCover: hadNoPhotos && idx === 0,
        });
      });

      const fresh = await getCafePhotos(cafeId);
      publishPhotos(fresh);
      setOrderDirty(false);
      notifications.show({
        color: "green",
        title: "Фото загружены",
        message: `Добавлено: ${files.length}`,
      });
    } catch (err: any) {
      const message =
        err?.normalized?.message ?? err?.response?.data?.message ?? "Не удалось загрузить фото.";
      setLastError(message);
      notifications.show({
        color: "red",
        title: "Ошибка загрузки",
        message,
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDropUpload = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files?.length) {
      void handleUploadFiles(event.dataTransfer.files);
    }
  };

  const handleDragOverUpload = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleSetCover = async (photoId: string) => {
    if (!cafeId) return;
    try {
      const next = await setCafePhotoCover(cafeId, photoId);
      publishPhotos(next);
      setOrderDirty(false);
    } catch (err: any) {
      const message =
        err?.normalized?.message ?? err?.response?.data?.message ?? "Не удалось установить обложку.";
      setLastError(message);
      notifications.show({
        color: "red",
        title: "Ошибка",
        message,
      });
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!cafeId) return;
    try {
      const next = await deleteCafePhoto(cafeId, photoId);
      publishPhotos(next);
      setOrderDirty(false);
    } catch (err: any) {
      const message =
        err?.normalized?.message ?? err?.response?.data?.message ?? "Не удалось удалить фото.";
      setLastError(message);
      notifications.show({
        color: "red",
        title: "Ошибка удаления",
        message,
      });
    }
  };

  const handleMovePhoto = (photoId: string, dir: -1 | 1) => {
    const from = photos.findIndex((item) => item.id === photoId);
    if (from < 0) return;
    const to = from + dir;
    if (to < 0 || to >= photos.length) return;
    setPhotos((prev) => moveItem(prev, from, to));
    setOrderDirty(true);
  };

  const handleReorderSave = async () => {
    if (!cafeId || !canSaveOrder) return;
    setIsSavingOrder(true);
    setLastError(null);
    try {
      const next = await reorderCafePhotos(
        cafeId,
        photos.map((photo) => photo.id),
      );
      publishPhotos(next);
      setOrderDirty(false);
      notifications.show({
        color: "green",
        title: "Порядок сохранен",
        message: "Новый порядок фото применен.",
      });
    } catch (err: any) {
      const message =
        err?.normalized?.message ?? err?.response?.data?.message ?? "Не удалось сохранить порядок.";
      setLastError(message);
      notifications.show({
        color: "red",
        title: "Ошибка",
        message,
      });
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleDragStart = (photoId: string) => {
    setDraggedPhotoId(photoId);
  };

  const handleDragOverRow = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDropRow = (event: DragEvent<HTMLDivElement>, targetPhotoId: string) => {
    event.preventDefault();
    if (!draggedPhotoId || draggedPhotoId === targetPhotoId) return;
    const from = photos.findIndex((item) => item.id === draggedPhotoId);
    const to = photos.findIndex((item) => item.id === targetPhotoId);
    if (from < 0 || to < 0 || from === to) return;
    setPhotos((prev) => moveItem(prev, from, to));
    setOrderDirty(true);
    setDraggedPhotoId(null);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      withCloseButton
      zIndex={420}
      title={`Фото кофейни: ${cafeName}`}
      styles={{
        content: {
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
        },
        header: {
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        },
        body: {
          paddingBottom: 96,
        },
        overlay: {
          backgroundColor: "var(--color-surface-overlay-strong)",
          backdropFilter: "blur(6px)",
        },
      }}
    >
      <Stack gap="md">
        <Paper
          withBorder
          p="md"
          radius="md"
          onDrop={handleDropUpload}
          onDragOver={handleDragOverUpload}
          style={{
            border: "1px dashed var(--border)",
            background: "var(--surface)",
          }}
        >
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={600}>Загрузка фото</Text>
              <Badge variant="light">{photosCountLabel}</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Нажмите кнопку ниже или перетащите файлы в эту область.
            </Text>
            <Group grow>
              <Button
                leftSection={<IconPhotoPlus size={16} />}
                onClick={handlePickFiles}
                loading={isUploading}
              >
                Выбрать фото
              </Button>
              <Button
                variant="light"
                leftSection={<IconUpload size={16} />}
                onClick={handlePickFiles}
                loading={isUploading}
              >
                Drag and drop
              </Button>
            </Group>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              hidden
              onChange={(event) => {
                void handleUploadFiles(event.currentTarget.files);
              }}
            />
          </Stack>
        </Paper>

        {lastError && (
          <Paper withBorder p="sm" radius="md" style={{ borderColor: "var(--color-status-error)" }}>
            <Text size="sm" c="red.6">
              {lastError}
            </Text>
          </Paper>
        )}

        <Stack gap="xs">
          {isLoading && <Text size="sm">Загружаем фото...</Text>}
          {!isLoading && photos.length === 0 && (
            <Paper withBorder radius="md" p="md" style={{ background: "var(--surface)" }}>
              <Text size="sm" c="dimmed">
                Пока нет фото. Добавьте первые изображения кофейни.
              </Text>
            </Paper>
          )}
          {photos.map((photo, index) => (
            <Paper
              key={photo.id}
              withBorder
              radius="md"
              p="xs"
              draggable
              onDragStart={() => handleDragStart(photo.id)}
              onDragOver={handleDragOverRow}
              onDrop={(event) => handleDropRow(event, photo.id)}
              style={{
                background: "var(--surface)",
                borderColor:
                  draggedPhotoId === photo.id
                    ? "var(--color-brand-accent)"
                    : "var(--border)",
              }}
            >
              <Group align="center" wrap="nowrap" gap="xs">
                <Box
                  style={{
                    width: 88,
                    height: 66,
                    borderRadius: 10,
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={photo.url}
                    alt={`Фото ${index + 1}`}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </Box>
                <Stack gap={6} style={{ minWidth: 0, flex: 1 }}>
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Text fw={600} size="sm">
                      Фото #{index + 1}
                    </Text>
                    {photo.is_cover && (
                      <Badge color="yellow" variant="light">
                        Обложка
                      </Badge>
                    )}
                  </Group>
                  <Group gap={6}>
                    <Button
                      size="xs"
                      variant={photo.is_cover ? "filled" : "light"}
                      leftSection={<IconStar size={14} />}
                      onClick={() => void handleSetCover(photo.id)}
                    >
                      Обложка
                    </Button>
                    <ActionIcon
                      variant="light"
                      aria-label="Переместить вверх"
                      onClick={() => handleMovePhoto(photo.id, -1)}
                      disabled={index === 0}
                    >
                      <IconChevronUp size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      aria-label="Переместить вниз"
                      onClick={() => handleMovePhoto(photo.id, 1)}
                      disabled={index === photos.length - 1}
                    >
                      <IconChevronDown size={16} />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      variant="light"
                      aria-label="Удалить фото"
                      onClick={() => void handleDeletePhoto(photo.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      aria-label="Перетащить"
                      style={{ cursor: "grab" }}
                    >
                      <IconArrowsSort size={16} />
                    </ActionIcon>
                  </Group>
                </Stack>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Stack>

      <Box
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
          borderTop: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <Button
          fullWidth
          onClick={() => void handleReorderSave()}
          disabled={!canSaveOrder}
          loading={isSavingOrder}
          leftSection={<IconArrowsSort size={16} />}
        >
          Сохранить порядок
        </Button>
      </Box>
    </Modal>
  );
}
