import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconPlus, IconTrash } from "@tabler/icons-react";

import { uploadCafePhotoByPresignedUrl } from "../../../api/cafePhotos";
import {
  presignSubmissionPhotoUpload,
  submitCafePhotos,
  submitMenuPhotos,
} from "../../../api/submissions";
import { extractApiErrorMessage } from "../../../utils/apiError";

type CafePhotoSubmissionModalProps = {
  opened: boolean;
  cafeId: string | null;
  cafeName: string;
  kind: "cafe" | "menu";
  onClose: () => void;
};

const MAX_UPLOAD_CONCURRENCY = 3;

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
  onClose,
}: CafePhotoSubmissionModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"cafe" | "menu">(kind);
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

  useEffect(() => {
    if (!opened) return;
    setFiles([]);
    setError(null);
    setMode(kind);
  }, [kind, opened]);

  const modeLabel = mode === "menu" ? "фото меню" : "фото заведения";
  const fileCountLabel = useMemo(() => {
    if (files.length === 0) return "Файлы не выбраны";
    if (files.length === 1) return "1 файл";
    return `${files.length} файлов`;
  }, [files.length]);
  const previewUrls = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files],
  );

  useEffect(
    () => () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    },
    [previewUrls],
  );

  const appendFiles = (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;
    const accepted = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (accepted.length === 0) {
      notifications.show({
        color: "orange",
        title: "Нужны изображения",
        message: "Поддерживаются только файлы изображений.",
      });
      return;
    }
    setFiles((prev) => [...prev, ...accepted]);
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
    if (!cafeId || files.length === 0 || isUploading) return;
    setIsUploading(true);
    setError(null);

    try {
      const objectKeys: Array<string | null> = Array.from({ length: files.length }, () => null);
      await runWithConcurrency(files, MAX_UPLOAD_CONCURRENCY, async (file, index) => {
        const presigned = await presignSubmissionPhotoUpload({
          contentType: file.type,
          sizeBytes: file.size,
        });
        await uploadCafePhotoByPresignedUrl(
          presigned.upload_url,
          file,
          presigned.headers ?? {},
        );
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

      notifications.show({
        color: "green",
        title: "Заявка отправлена",
        message: `Отправили ${modeLabel} на модерацию.`,
      });
      setFiles([]);
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
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      withCloseButton
      zIndex={425}
      title={`Предложить фото: ${cafeName}`}
      styles={{
        content: {
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
        },
        header: {
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        },
        overlay: {
          backgroundColor: "var(--color-surface-overlay-strong)",
          backdropFilter: "blur(6px)",
        },
      }}
    >
      <Stack gap="md">
        <Button
          variant="default"
          leftSection={<IconArrowLeft size={16} />}
          onClick={onClose}
          radius="xl"
          styles={glassButtonStyles}
          style={{ alignSelf: "flex-start", marginTop: 8, marginBottom: 8 }}
        >
          К карточке
        </Button>

        <SegmentedControl
          fullWidth
          value={mode}
          onChange={(value) => setMode(value as "cafe" | "menu")}
          data={[
            { value: "cafe", label: "Фото места" },
            { value: "menu", label: "Фото меню" },
          ]}
          styles={{
            root: {
              background: "transparent",
              border: "none",
              boxShadow: "none",
              padding: 0,
            },
            control: {
              border: "none",
              "&::before": {
                display: "none",
              },
            },
            indicator: {
              border: "1px solid var(--glass-border)",
              borderRadius: 14,
              background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
              boxShadow: "var(--glass-shadow)",
            },
            label: {
              borderRadius: 14,
              fontWeight: 600,
              color: "var(--text)",
            },
          }}
        />

        <Paper
          withBorder
          p="md"
          radius="md"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{
            border: "1px dashed var(--border)",
            background: "var(--surface)",
          }}
        >
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={600}>Загрузка</Text>
              <Badge variant="light">{fileCountLabel}</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Выберите или перетащите изображения. После отправки они попадут в очередь
              модерации.
            </Text>
            <Box
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
                gap: 8,
              }}
            >
              {files.map((file, index) => (
                <Box
                  key={`${file.name}-${index}-${file.size}`}
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
                    src={previewUrls[index]}
                    alt={file.name}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
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
                  <ActionIcon
                    size={22}
                    variant="filled"
                    color="dark"
                    aria-label="Удалить фото"
                    onClick={() =>
                      setFiles((prev) => prev.filter((_, fileIdx) => fileIdx !== index))
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
                </Box>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
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
                  cursor: isUploading ? "not-allowed" : "pointer",
                  opacity: isUploading ? 0.6 : 1,
                }}
              >
                <IconPlus size={24} />
              </button>
            </Box>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => appendFiles(event.currentTarget.files)}
            />
          </Stack>
        </Paper>

        {error && (
          <Paper withBorder p="sm" radius="md" style={{ borderColor: "var(--color-status-error)" }}>
            <Text size="sm" c="red.6">
              {error}
            </Text>
          </Paper>
        )}

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
            onClick={() => void handleSubmit()}
            loading={isUploading}
            disabled={!cafeId || files.length === 0}
            radius="xl"
            styles={glassButtonStyles}
          >
            Отправить на модерацию
          </Button>
        </Box>
      </Stack>
    </Modal>
  );
}
