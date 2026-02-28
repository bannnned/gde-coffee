import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { notifications } from "../../../lib/notifications";
import { IconPlus, IconRotateClockwise2, IconTrash } from "@tabler/icons-react";

import { uploadCafePhotoByPresignedUrl } from "../../../api/cafePhotos";
import { presignSubmissionPhotoUpload, submitCafePhotos, submitMenuPhotos } from "../../../api/submissions";
import { Badge, Button } from "../../../components/ui";
import { cn } from "../../../lib/utils";
import { AppModal } from "../../../ui/bridge";
import { extractApiErrorMessage } from "../../../utils/apiError";
import { rotateImageFileByQuarterTurns } from "../../../utils/imageRotation";
import classes from "./CafePhotoSubmissionModal.module.css";

type CafePhotoSubmissionModalProps = {
  opened: boolean;
  cafeId: string | null;
  cafeName: string;
  kind: "cafe" | "menu";
  existingPhotosCount?: number;
  onSubmitted?: (payload: { cafeId: string; kind: "cafe" | "menu"; count: number }) => void;
  onClose: () => void;
};

const MAX_UPLOAD_CONCURRENCY = 3;

type DraftUploadPhoto = {
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

function createDraftUploadPhoto(file: File): DraftUploadPhoto {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    rotationQuarterTurns: 0,
  };
}

function revokePreviewUrls(items: DraftUploadPhoto[]) {
  for (const item of items) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const safeConcurrency = Math.max(1, Math.min(items.length, concurrency));
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

export default function CafePhotoSubmissionModal({
  opened,
  cafeId,
  cafeName,
  kind,
  existingPhotosCount = 0,
  onSubmitted,
  onClose,
}: CafePhotoSubmissionModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftPhotosRef = useRef<DraftUploadPhoto[]>([]);
  const [draftPhotos, setDraftPhotos] = useState<DraftUploadPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"cafe" | "menu">(kind);

  useEffect(() => {
    draftPhotosRef.current = draftPhotos;
  }, [draftPhotos]);

  useEffect(() => {
    return () => {
      revokePreviewUrls(draftPhotosRef.current);
    };
  }, []);

  useEffect(() => {
    if (!opened) return;
    setDraftPhotos((prev) => {
      revokePreviewUrls(prev);
      return [];
    });
    setError(null);
    setMode(kind);
  }, [kind, opened]);

  const modeLabel = mode === "menu" ? "фото меню" : "фото заведения";
  const isFirstPhotographer = existingPhotosCount <= 0;
  const fileCountLabel = useMemo(() => {
    if (draftPhotos.length === 0) return "Файлы не выбраны";
    if (draftPhotos.length === 1) return "1 файл";
    return `${draftPhotos.length} файлов`;
  }, [draftPhotos.length]);

  const appendFiles = (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;
    const accepted = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (accepted.length === 0) {
      notifications.show({
        color: "orange",
        title: "Нужны изображения",
        message: "Поддерживаются только файлы изображений.",
      });
      return;
    }
    const nextDraftPhotos = accepted.map(createDraftUploadPhoto);
    setDraftPhotos((prev) => [...prev, ...nextDraftPhotos]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    appendFiles(event.dataTransfer?.files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleSubmit = async () => {
    if (!cafeId || draftPhotos.length === 0 || isUploading) return;
    setIsUploading(true);
    setError(null);

    try {
      const objectKeys: Array<string | null> = Array.from({ length: draftPhotos.length }, () => null);
      await runWithConcurrency(draftPhotos, MAX_UPLOAD_CONCURRENCY, async (draft, index) => {
        const uploadFile =
          draft.rotationQuarterTurns === 0
            ? draft.file
            : await rotateImageFileByQuarterTurns(draft.file, draft.rotationQuarterTurns);
        const presigned = await presignSubmissionPhotoUpload({
          contentType: uploadFile.type || draft.file.type,
          sizeBytes: uploadFile.size,
        });
        await uploadCafePhotoByPresignedUrl(presigned.upload_url, uploadFile, presigned.headers ?? {});
        objectKeys[index] = presigned.object_key;
      });
      const uploadedObjectKeys = objectKeys.filter(
        (objectKey): objectKey is string => typeof objectKey === "string" && objectKey.length > 0,
      );

      if (mode === "menu") {
        await submitMenuPhotos(cafeId, uploadedObjectKeys);
      } else {
        await submitCafePhotos(cafeId, uploadedObjectKeys);
      }
      onSubmitted?.({
        cafeId,
        kind: mode,
        count: uploadedObjectKeys.length,
      });

      notifications.show({
        color: "green",
        title: "Заявка отправлена",
        message: isFirstPhotographer
          ? `Отправили ${modeLabel} на модерацию. После одобрения получите +4 к репутации как первый фотограф.`
          : `Отправили ${modeLabel} на модерацию. После одобрения получите +4 к репутации.`,
      });
      setDraftPhotos((prev) => {
        revokePreviewUrls(prev);
        return [];
      });
      onClose();
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, "Не удалось отправить заявку.");
      setError(message);
      notifications.show({
        color: "red",
        title: "Ошибка",
        message,
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <AppModal
      open={opened}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`Предложить фото: ${cafeName}`}
      fullScreen
      implementation="radix"
      presentation="sheet"
      contentClassName={classes.modalContent}
      bodyClassName={classes.modalBody}
      titleClassName={classes.modalTitle}
    >
      <div className={classes.bodyRoot}>
        <div className={classes.content}>
          <div className={classes.modeTabs}>
            <button
              type="button"
              onClick={() => setMode("cafe")}
              className={cn(classes.modeTab, mode === "cafe" ? classes.modeTabActive : "")}
            >
              Фото места
            </button>
            <button
              type="button"
              onClick={() => setMode("menu")}
              className={cn(classes.modeTab, mode === "menu" ? classes.modeTabActive : "")}
            >
              Фото меню
            </button>
          </div>

          {isFirstPhotographer ? (
            <div className={classes.firstPhotographerRow}>
              <Badge className={classes.firstPhotographerBadge}>Первый фотограф</Badge>
              <p className={classes.firstPhotographerText}>+4 к репутации после одобрения</p>
            </div>
          ) : null}

          <div className={classes.uploadCard} onDrop={handleDrop} onDragOver={handleDragOver}>
            <div className={classes.uploadStack}>
              <div className={classes.uploadHeader}>
                <p className={classes.uploadTitle}>Загрузка</p>
                <Badge className={classes.counterBadge}>{fileCountLabel}</Badge>
              </div>
              <p className={classes.mutedText}>
                Выберите или перетащите изображения. После отправки они попадут в очередь
                модерации.
              </p>
              <div className={classes.uploadGrid}>
                {draftPhotos.map((draft) => (
                  <div key={draft.id} className={classes.photoTile}>
                    <img
                      src={draft.previewUrl}
                      alt={draft.file.name}
                      loading="lazy"
                      className={classes.photoTileImage}
                      style={{
                        transform: `rotate(${draft.rotationQuarterTurns * 90}deg)`,
                        transformOrigin: "center center",
                      }}
                    />
                    {isUploading ? <div className={classes.skeletonOverlay} /> : null}
                    <button
                      type="button"
                      className={`${classes.tileActionButton} ${classes.tileActionLeft} ui-focus-ring`}
                      aria-label="Повернуть фото"
                      onClick={() =>
                        setDraftPhotos((prev) =>
                          prev.map((item) =>
                            item.id === draft.id
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
                      aria-label="Удалить фото"
                      onClick={() =>
                        setDraftPhotos((prev) => {
                          const target = prev.find((item) => item.id === draft.id) ?? null;
                          if (target) URL.revokeObjectURL(target.previewUrl);
                          return prev.filter((item) => item.id !== draft.id);
                        })
                      }
                      disabled={isUploading}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  aria-label="Добавить фото"
                  className={`${classes.addTile} ui-focus-ring`}
                >
                  <IconPlus size={24} />
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(event) => appendFiles(event.currentTarget.files)}
              />
            </div>
          </div>

          {error ? (
            <div className={classes.errorBox}>
              <p className={classes.errorText}>{error}</p>
            </div>
          ) : null}
        </div>

        <div className={classes.footerSticky}>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!cafeId || draftPhotos.length === 0 || isUploading}
            aria-busy={isUploading ? "true" : undefined}
            className={classes.submitButton}
          >
            <span className={isUploading ? classes.loadingHidden : ""}>Отправить на модерацию</span>
            {isUploading ? <span className={classes.spinner} aria-hidden="true" /> : null}
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
