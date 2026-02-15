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
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPhotoPlus, IconTrash, IconUpload } from "@tabler/icons-react";

import { uploadCafePhotoByPresignedUrl } from "../../../api/cafePhotos";
import {
  presignSubmissionPhotoUpload,
  submitCafePhotos,
  submitMenuPhotos,
} from "../../../api/submissions";

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
      const objectKeys: string[] = new Array(files.length);
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

      if (mode === "menu") {
        await submitMenuPhotos(cafeId, objectKeys.filter(Boolean));
      } else {
        await submitCafePhotos(cafeId, objectKeys.filter(Boolean));
      }

      notifications.show({
        color: "green",
        title: "Заявка отправлена",
        message: `Отправили ${modeLabel} на модерацию.`,
      });
      setFiles([]);
      onClose();
    } catch (err: any) {
      const message =
        err?.normalized?.message ??
        err?.response?.data?.message ??
        err?.message ??
        "Не удалось отправить заявку.";
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
        <SegmentedControl
          fullWidth
          value={mode}
          onChange={(value) => setMode(value as "cafe" | "menu")}
          data={[
            { value: "cafe", label: "Фото места" },
            { value: "menu", label: "Фото меню" },
          ]}
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
            <Group grow>
              <Button
                leftSection={<IconPhotoPlus size={16} />}
                onClick={() => fileInputRef.current?.click()}
              >
                Выбрать фото
              </Button>
              <Button
                variant="light"
                leftSection={<IconUpload size={16} />}
                onClick={() => fileInputRef.current?.click()}
              >
                Drag and drop
              </Button>
            </Group>
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

        <Stack gap="xs">
          {files.map((file, index) => (
            <Paper
              key={`${file.name}-${index}-${file.size}`}
              withBorder
              radius="md"
              p="xs"
              style={{ background: "var(--surface)" }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" lineClamp={1}>
                  {file.name}
                </Text>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label="Удалить"
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, fileIdx) => fileIdx !== index))
                  }
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
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
            onClick={() => void handleSubmit()}
            loading={isUploading}
            disabled={!cafeId || files.length === 0}
          >
            Отправить на модерацию
          </Button>
        </Box>
      </Stack>
    </Modal>
  );
}
