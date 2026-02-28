import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { notifications } from "../../../lib/notifications";
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
import { Badge, Button } from "../../../components/ui";
import type { CafePhoto, CafePhotoKind } from "../../../entities/cafe/model/types";
import { AppModal } from "../../../ui/bridge";
import { extractApiErrorMessage } from "../../../utils/apiError";
import { rotateImageFileByQuarterTurns } from "../../../utils/imageRotation";
import classes from "./CafePhotoAdminModal.module.css";

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
  }, [opened, cafeId, kind, initialPhotos]);

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
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, cafeId, kind]);

  const canSaveOrder = orderDirty && !isSavingOrder && !isUploading && Boolean(cafeId);
  const isCafeKind = kind === "cafe";
  const photoKindLabel = isCafeKind ? "места" : "меню";
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
        await uploadCafePhotoByPresignedUrl(presigned.upload_url, uploadFile, presigned.headers ?? {});
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
      if (fileInputRef.current) fileInputRef.current.value = "";
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
    <AppModal
      open={opened}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`Фото ${photoKindLabel}: ${cafeName}`}
      fullScreen
      implementation="radix"
      presentation="sheet"
      contentClassName={classes.modalContent}
      bodyClassName={classes.modalBody}
      titleClassName={classes.modalTitle}
    >
      <div className={classes.bodyRoot}>
        <div className={classes.content}>
          <div className={classes.uploadCard} onDrop={handleDropUpload} onDragOver={handleDragOverUpload}>
            <div className={classes.uploadStack}>
              <div className={classes.uploadHeader}>
                <p className={classes.uploadTitle}>Загрузка фото</p>
                <Badge className={classes.counterBadge}>
                  {isUploading ? `Загружаем ${pendingUploads.length}...` : pendingUploadsLabel}
                </Badge>
              </div>
              <p className={classes.mutedText}>
                Нажмите на слот с плюсом или перетащите файлы. Можно повернуть фото до загрузки.
              </p>
              <p className={classes.mutedTextSecondary}>Сейчас в галерее: {photosCountLabel}</p>

              <div className={classes.uploadGrid}>
                {pendingUploads.map((pending) => (
                  <div key={pending.id} className={classes.photoTile}>
                    <img
                      src={pending.previewUrl}
                      alt={pending.file.name}
                      loading="lazy"
                      className={classes.photoTileImage}
                      style={{
                        transform: `rotate(${pending.rotationQuarterTurns * 90}deg)`,
                        transformOrigin: "center center",
                      }}
                    />
                    <button
                      type="button"
                      className={`${classes.tileActionButton} ${classes.tileActionLeft} ui-focus-ring`}
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
                    >
                      <IconRotateClockwise2 size={14} />
                    </button>
                    <button
                      type="button"
                      className={`${classes.tileActionButton} ${classes.tileActionRight} ui-focus-ring`}
                      aria-label="Убрать из очереди"
                      onClick={() =>
                        setPendingUploads((prev) => {
                          const target = prev.find((item) => item.id === pending.id) ?? null;
                          if (target) URL.revokeObjectURL(target.previewUrl);
                          return prev.filter((item) => item.id !== pending.id);
                        })
                      }
                      disabled={isUploading}
                    >
                      <IconTrash size={14} />
                    </button>
                    {isUploading ? <div className={classes.skeletonOverlay} /> : null}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handlePickFiles}
                  disabled={isUploading || !cafeId}
                  aria-label="Добавить фото"
                  className={`${classes.addTile} ui-focus-ring`}
                >
                  <IconPlus size={24} />
                </button>
              </div>

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
                type="button"
                onClick={() => {
                  void handleUploadQueue();
                }}
                disabled={!cafeId || pendingUploads.length === 0 || isUploading}
                aria-busy={isUploading ? "true" : undefined}
                className={classes.uploadButton}
              >
                <span className={isUploading ? classes.loadingHidden : ""}>
                  {pendingUploads.length > 0
                    ? `Загрузить ${pendingUploads.length}`
                    : "Выберите фото для загрузки"}
                </span>
                {isUploading ? <span className={classes.spinner} aria-hidden="true" /> : null}
              </Button>
            </div>
          </div>

          {lastError ? (
            <div className={classes.errorBox}>
              <p className={classes.errorText}>{lastError}</p>
            </div>
          ) : null}

          <div className={classes.photosStack}>
            {isLoading ? <p className={classes.loadingText}>Загружаем фото...</p> : null}
            {!isLoading && photos.length === 0 ? (
              <div className={classes.emptyStateBox}>
                <p className={classes.emptyStateText}>
                  {isCafeKind
                    ? "Пока нет фото. Добавьте первые изображения места."
                    : "Пока нет фото. Добавьте первые изображения меню и позиций."}
                </p>
              </div>
            ) : null}

            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className={classes.photoRow}
                draggable
                onDragStart={() => handleDragStart(photo.id)}
                onDragOver={handleDragOverRow}
                onDrop={(event) => handleDropRow(event, photo.id)}
                data-dragged={draggedPhotoId === photo.id ? "true" : "false"}
              >
                <div className={classes.photoRowMain}>
                  <div className={classes.photoThumb}>
                    <img
                      src={photo.url}
                      alt={`Фото ${index + 1}`}
                      loading="lazy"
                      className={classes.photoThumbImage}
                    />
                  </div>
                  <div className={classes.photoMeta}>
                    <div className={classes.photoMetaHeader}>
                      <p className={classes.photoNumber}>Фото #{index + 1}</p>
                      {isCafeKind && photo.is_cover ? (
                        <Badge className={classes.coverBadge}>Обложка</Badge>
                      ) : null}
                    </div>
                    <div className={classes.photoActions}>
                      {isCafeKind ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={photo.is_cover ? "default" : "secondary"}
                          className={classes.coverButton}
                          onClick={() => void handleSetCover(photo.id)}
                        >
                          <IconStar size={14} />
                          Обложка
                        </Button>
                      ) : null}
                      <button
                        type="button"
                        className={`${classes.actionIconButton} ui-focus-ring`}
                        aria-label="Переместить вверх"
                        onClick={() => handleMovePhoto(photo.id, -1)}
                        disabled={index === 0}
                      >
                        <IconChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        className={`${classes.actionIconButton} ui-focus-ring`}
                        aria-label="Переместить вниз"
                        onClick={() => handleMovePhoto(photo.id, 1)}
                        disabled={index === photos.length - 1}
                      >
                        <IconChevronDown size={16} />
                      </button>
                      <button
                        type="button"
                        className={`${classes.actionIconButton} ${classes.actionIconDanger} ui-focus-ring`}
                        aria-label="Удалить фото"
                        onClick={() => void handleDeletePhoto(photo.id)}
                      >
                        <IconTrash size={16} />
                      </button>
                      <button
                        type="button"
                        className={`${classes.actionIconButton} ui-focus-ring`}
                        aria-label="Перетащить"
                        style={{ cursor: "grab" }}
                      >
                        <IconArrowsSort size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={classes.footerSticky}>
          <Button
            type="button"
            onClick={() => void handleReorderSave()}
            disabled={!canSaveOrder || isSavingOrder}
            aria-busy={isSavingOrder ? "true" : undefined}
            className={classes.saveOrderButton}
          >
            <IconArrowsSort size={16} />
            <span className={isSavingOrder ? classes.loadingHidden : ""}>Сохранить порядок</span>
            {isSavingOrder ? <span className={classes.spinner} aria-hidden="true" /> : null}
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
