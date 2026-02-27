import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Skeleton,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowsSort,
  IconChevronDown,
  IconChevronUp,
  IconPlus,
  IconRotateClockwise2,
  IconStar,
  IconTrash,
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
import type { CafePhoto, CafePhotoKind } from "../../../entities/cafe/model/types";
import { rotateImageFileByQuarterTurns } from "../../../utils/imageRotation";
import { extractApiErrorMessage } from "../../../utils/apiError";

type CafePhotoAdminModalProps = {
  opened: boolean;
  cafeId: string | null;
  cafeName: string;
  kind: CafePhotoKind;
  initialPhotos?: CafePhoto[];
  onClose: () => void;
  onPhotosChanged?: (photos: CafePhoto[]) => void;
};

const MAX_UPLOAD_CONCURRENCY = 3;

type PendingUploadPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
};

function normalizeQuarterTurns(value: number): 0 | 1 | 2 | 3 {
  const normalized = ((Math.trunc(value) % 4) + 4) % 4;
  if (normalized === 0 || normalized === 1 || normalized === 2 || normalized === 3) {
    return normalized;
  }
  return 0;
}

function createPendingUploadPhoto(file: File): PendingUploadPhoto {
  return {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    rotationQuarterTurns: 0,
  };
}

function revokePendingPreviewUrls(items: PendingUploadPhoto[]) {
  for (const item of items) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

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
  kind,
  initialPhotos = [],
  onClose,
  onPhotosChanged,
}: CafePhotoAdminModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadsRef = useRef<PendingUploadPhoto[]>([]);
  const [photos, setPhotos] = useState<CafePhoto[]>(initialPhotos);
  const [pendingUploads, setPendingUploads] = useState<PendingUploadPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    pendingUploadsRef.current = pendingUploads;
  }, [pendingUploads]);

  useEffect(() => {
    return () => {
      revokePendingPreviewUrls(pendingUploadsRef.current);
    };
  }, []);

  useEffect(() => {
    if (!opened) return;
    setPhotos(initialPhotos);
    setPendingUploads((prev) => {
      revokePendingPreviewUrls(prev);
      return [];
    });
    setOrderDirty(false);
  }, [opened, cafeId, kind]);

  useEffect(() => {
    if (!opened || !cafeId) return;
    let cancelled = false;
    setIsLoading(true);
    setLastError(null);
    getCafePhotos(cafeId, kind)
      .then((list) => {
        if (cancelled) return;
        setPhotos(list);
        setOrderDirty(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = extractApiErrorMessage(err, "Не удалось загрузить фото.");
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
  }, [opened, cafeId, kind]);

  const canSaveOrder = orderDirty && !isSavingOrder && !isUploading && Boolean(cafeId);
  const isCafeKind = kind === "cafe";
  const photoKindLabel = isCafeKind ? "места" : "меню";
  const glassButtonStyles = {
    root: {
      borderRadius: 14,
      border: "1px solid var(--glass-border)",
      background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
      boxShadow: "var(--glass-shadow)",
      backdropFilter: "blur(12px) saturate(140%)",
      WebkitBackdropFilter: "blur(12px) saturate(140%)",
      color: "var(--text)",
    },
  } as const;
  const photosCountLabel = useMemo(() => {
    if (photos.length === 0) return "Фото пока нет";
    return photos.length === 1 ? "1 фото" : `${photos.length} фото`;
  }, [photos.length]);
  const pendingUploadsLabel = useMemo(() => {
    if (pendingUploads.length === 0) return "Очередь пуста";
    if (pendingUploads.length === 1) return "1 файл в очереди";
    return `${pendingUploads.length} файлов в очереди`;
  }, [pendingUploads.length]);

  const handlePickFiles = () => {
    fileInputRef.current?.click();
  };

  const publishPhotos = (next: CafePhoto[]) => {
    setPhotos(next);
    onPhotosChanged?.(next);
  };

  const handleQueueUploadFiles = (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0 || isUploading) return;
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) {
      notifications.show({
        color: "orange",
        title: "Нужны изображения",
        message: "Выберите файлы JPG/PNG/WEBP/AVIF.",
      });
      return;
    }
    const pending = files.map(createPendingUploadPhoto);
    setPendingUploads((prev) => [...prev, ...pending]);
  };

  const handleUploadQueue = async () => {
    if (!cafeId || pendingUploads.length === 0 || isUploading) return;
    setIsUploading(true);
    setLastError(null);
    try {
      const hadNoPhotos = photos.length === 0;
      await runWithConcurrency(pendingUploads, MAX_UPLOAD_CONCURRENCY, async (pending, idx) => {
        const uploadFile =
          pending.rotationQuarterTurns === 0
            ? pending.file
            : await rotateImageFileByQuarterTurns(pending.file, pending.rotationQuarterTurns);
        const presigned = await presignCafePhotoUpload(cafeId, {
          contentType: uploadFile.type || pending.file.type,
          sizeBytes: uploadFile.size,
          kind,
        });
        await uploadCafePhotoByPresignedUrl(
          presigned.upload_url,
          uploadFile,
          presigned.headers ?? {},
        );
        await confirmCafePhotoUpload(cafeId, {
          objectKey: presigned.object_key,
          kind,
          isCover: isCafeKind && hadNoPhotos && idx === 0,
        });
      });

      const fresh = await getCafePhotos(cafeId, kind);
      publishPhotos(fresh);
      setOrderDirty(false);
      setPendingUploads((prev) => {
        revokePendingPreviewUrls(prev);
        return [];
      });
      notifications.show({
        color: "green",
        title: "Фото загружены",
        message: `Добавлено: ${pendingUploads.length}`,
      });
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, "Не удалось загрузить фото.");
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
      handleQueueUploadFiles(event.dataTransfer.files);
    }
  };

  const handleDragOverUpload = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleSetCover = async (photoId: string) => {
    if (!cafeId || !isCafeKind) return;
    try {
      const next = await setCafePhotoCover(cafeId, photoId, kind);
      publishPhotos(next);
      setOrderDirty(false);
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, "Не удалось установить обложку.");
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
      const next = await deleteCafePhoto(cafeId, photoId, kind);
      publishPhotos(next);
      setOrderDirty(false);
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, "Не удалось удалить фото.");
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
        kind,
      );
      publishPhotos(next);
      setOrderDirty(false);
      notifications.show({
        color: "green",
        title: "Порядок сохранен",
        message: "Новый порядок фото применен.",
      });
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, "Не удалось сохранить порядок.");
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
      zIndex={3600}
      title={`Фото ${photoKindLabel}: ${cafeName}`}
      styles={{
        content: {
          background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--glass-shadow)",
          backdropFilter: "blur(16px) saturate(150%)",
          WebkitBackdropFilter: "blur(16px) saturate(150%)",
        },
        header: {
          background: "transparent",
          borderBottom: "1px solid var(--border)",
        },
        body: {
          paddingBottom: "calc(12px + var(--safe-bottom))",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflowY: "auto",
        },
        overlay: {
          backgroundColor: "var(--color-surface-overlay-strong)",
          backdropFilter: "blur(6px)",
        },
      }}
    >
      <Stack gap="md">
        <Box
          onDrop={handleDropUpload}
          onDragOver={handleDragOverUpload}
          style={{
            border: "1px dashed var(--border)",
            borderRadius: 14,
            background: "transparent",
            padding: 12,
          }}
        >
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={600}>Загрузка фото</Text>
              <Badge variant="light">
                {isUploading
                  ? `Загружаем ${pendingUploads.length}...`
                  : pendingUploadsLabel}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Нажмите на слот с плюсом или перетащите файлы. Можно повернуть фото до загрузки.
            </Text>
            <Text size="xs" c="dimmed">
              Сейчас в галерее: {photosCountLabel}
            </Text>
            <Box
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
                gap: 8,
              }}
            >
              {pendingUploads.map((pending) => (
                <Box
                  key={pending.id}
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <img
                    src={pending.previewUrl}
                    alt={pending.file.name}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                      transform: `rotate(${pending.rotationQuarterTurns * 90}deg)`,
                      transformOrigin: "center center",
                    }}
                  />
                  <ActionIcon
                    size={22}
                    variant="filled"
                    color="dark"
                    aria-label="Повернуть фото"
                    onClick={() =>
                      setPendingUploads((prev) =>
                        prev.map((item) =>
                          item.id === pending.id
                            ? {
                                ...item,
                                rotationQuarterTurns: normalizeQuarterTurns(
                                  item.rotationQuarterTurns + 1,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                    disabled={isUploading}
                    style={{
                      position: "absolute",
                      top: 6,
                      left: 6,
                      background: "rgba(20,20,20,0.72)",
                    }}
                  >
                    <IconRotateClockwise2 size={14} />
                  </ActionIcon>
                  <ActionIcon
                    size={22}
                    variant="filled"
                    color="dark"
                    aria-label="Убрать из очереди"
                    onClick={() =>
                      setPendingUploads((prev) => {
                        const target = prev.find((item) => item.id === pending.id) ?? null;
                        if (target) {
                          URL.revokeObjectURL(target.previewUrl);
                        }
                        return prev.filter((item) => item.id !== pending.id);
                      })
                    }
                    disabled={isUploading}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      background: "rgba(20,20,20,0.72)",
                    }}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                  {isUploading && (
                    <Skeleton
                      visible
                      animate
                      h="100%"
                      radius={12}
                      style={{
                        position: "absolute",
                        inset: 0,
                      }}
                    />
                  )}
                </Box>
              ))}
              <button
                type="button"
                onClick={handlePickFiles}
                disabled={isUploading || !cafeId}
                aria-label="Добавить фото"
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: 12,
                  border: "1.5px dashed color-mix(in srgb, var(--color-brand-accent) 55%, var(--border))",
                  background: "color-mix(in srgb, var(--surface) 86%, transparent)",
                  color: "var(--muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: isUploading || !cafeId ? "not-allowed" : "pointer",
                  opacity: isUploading ? 0.6 : 1,
                }}
              >
                <IconPlus size={24} />
              </button>
            </Box>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              hidden
              onChange={(event) => {
                handleQueueUploadFiles(event.currentTarget.files);
              }}
            />
            <Button
              size="sm"
              fullWidth
              onClick={() => {
                void handleUploadQueue();
              }}
              disabled={!cafeId || pendingUploads.length === 0 || isUploading}
              loading={isUploading}
              styles={glassButtonStyles}
            >
              {pendingUploads.length > 0
                ? `Загрузить ${pendingUploads.length}`
                : "Выберите фото для загрузки"}
            </Button>
          </Stack>
        </Box>

        {lastError && (
          <Box
            p="sm"
            style={{
              borderRadius: 12,
              border: "1px solid var(--color-status-error)",
            }}
          >
            <Text size="sm" c="red.6">
              {lastError}
            </Text>
          </Box>
        )}

        <Stack gap="xs">
          {isLoading && <Text size="sm">Загружаем фото...</Text>}
          {!isLoading && photos.length === 0 && (
            <Box
              p="md"
              style={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "transparent",
              }}
            >
              <Text size="sm" c="dimmed">
                {isCafeKind
                  ? "Пока нет фото. Добавьте первые изображения места."
                  : "Пока нет фото. Добавьте первые изображения меню и позиций."}
              </Text>
            </Box>
          )}
          {photos.map((photo, index) => (
            <Box
              key={photo.id}
              p="xs"
              draggable
              onDragStart={() => handleDragStart(photo.id)}
              onDragOver={handleDragOverRow}
              onDrop={(event) => handleDropRow(event, photo.id)}
              style={{
                borderRadius: 12,
                border: "1px solid",
                background: "transparent",
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
                    {isCafeKind && photo.is_cover && (
                      <Badge color="yellow" variant="light">
                        Обложка
                      </Badge>
                    )}
                  </Group>
                  <Group gap={6}>
                    {isCafeKind && (
                      <Button
                        size="xs"
                        variant={photo.is_cover ? "filled" : "light"}
                        leftSection={<IconStar size={14} />}
                        onClick={() => void handleSetCover(photo.id)}
                      >
                        Обложка
                      </Button>
                    )}
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
            </Box>
          ))}
        </Stack>
      </Stack>

      <Box
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: "auto",
          marginInline: -16,
          padding: "12px 16px calc(12px + var(--safe-bottom))",
          borderTop: "1px solid var(--border)",
          background: "var(--surface)",
          zIndex: 2,
        }}
      >
        <Button
          fullWidth
          onClick={() => void handleReorderSave()}
          disabled={!canSaveOrder}
          loading={isSavingOrder}
          leftSection={<IconArrowsSort size={16} />}
          radius="xl"
          styles={glassButtonStyles}
        >
          Сохранить порядок
        </Button>
      </Box>
    </Modal>
  );
}
