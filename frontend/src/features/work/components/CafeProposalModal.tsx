import { useEffect, useMemo, useRef, useState } from "react";
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
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPhotoPlus, IconTrash } from "@tabler/icons-react";

import { uploadCafePhotoByPresignedUrl } from "../../../api/cafePhotos";
import {
  presignSubmissionPhotoUpload,
  submitCafeCreate,
} from "../../../api/submissions";

type CafeProposalModalProps = {
  opened: boolean;
  mapCenter: [number, number];
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

export default function CafeProposalModal({
  opened,
  mapCenter,
  onClose,
}: CafeProposalModalProps) {
  const placePhotosRef = useRef<HTMLInputElement | null>(null);
  const menuPhotosRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [placePhotos, setPlacePhotos] = useState<File[]>([]);
  const [menuPhotos, setMenuPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const centerLatitude = useMemo(() => Number(mapCenter[1]).toFixed(6), [mapCenter]);
  const centerLongitude = useMemo(() => Number(mapCenter[0]).toFixed(6), [mapCenter]);
  const placePreviewUrls = useMemo(
    () => placePhotos.map((file) => URL.createObjectURL(file)),
    [placePhotos],
  );
  const menuPreviewUrls = useMemo(
    () => menuPhotos.map((file) => URL.createObjectURL(file)),
    [menuPhotos],
  );

  useEffect(
    () => () => {
      placePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    },
    [placePreviewUrls],
  );
  useEffect(
    () => () => {
      menuPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    },
    [menuPreviewUrls],
  );

  useEffect(() => {
    if (!opened) return;
    setName("");
    setAddress("");
    setDescription("");
    setLatitude(centerLatitude);
    setLongitude(centerLongitude);
    setPlacePhotos([]);
    setMenuPhotos([]);
    setError(null);
  }, [centerLatitude, centerLongitude, opened]);

  const appendFiles = (
    setter: (updater: (prev: File[]) => File[]) => void,
    fileList: FileList | null,
  ) => {
    if (!fileList || fileList.length === 0) return;
    const accepted = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (accepted.length === 0) return;
    setter((prev) => [...prev, ...accepted]);
  };

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];
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
    return objectKeys.filter(Boolean);
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    if (!trimmedName || !trimmedAddress) {
      setError("Укажите название и адрес.");
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setError("Некорректная широта.");
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError("Некорректная долгота.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const [photoObjectKeys, menuPhotoObjectKeys] = await Promise.all([
        uploadFiles(placePhotos),
        uploadFiles(menuPhotos),
      ]);

      await submitCafeCreate({
        name: trimmedName,
        address: trimmedAddress,
        description: description.trim(),
        latitude: lat,
        longitude: lng,
        amenities: [],
        photoObjectKeys,
        menuPhotoObjectKeys,
      });

      notifications.show({
        color: "green",
        title: "Заявка отправлена",
        message: "Кофейня отправлена на модерацию.",
      });
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
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      withCloseButton
      title="Предложить новую кофейню"
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
          paddingBottom: 92,
        },
        overlay: {
          backgroundColor: "var(--color-surface-overlay-strong)",
          backdropFilter: "blur(6px)",
        },
      }}
    >
      <Stack gap="md">
        <Paper withBorder radius="md" p="md" style={{ background: "var(--surface)" }}>
          <Stack gap="sm">
            <TextInput
              label="Название"
              placeholder="Например, Roasters Corner"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <TextInput
              label="Адрес"
              placeholder="Улица, дом"
              value={address}
              onChange={(event) => setAddress(event.currentTarget.value)}
            />
            <Textarea
              label="Описание (необязательно)"
              placeholder="Что здесь особенного"
              minRows={3}
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
            <Group grow>
              <TextInput
                label="Широта"
                value={latitude}
                onChange={(event) => setLatitude(event.currentTarget.value)}
              />
              <TextInput
                label="Долгота"
                value={longitude}
                onChange={(event) => setLongitude(event.currentTarget.value)}
              />
            </Group>
            <Text size="xs" c="dimmed">
              По умолчанию координаты подставлены из текущего центра карты.
            </Text>
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p="md" style={{ background: "var(--surface)" }}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600}>Фото заведения</Text>
              <Badge variant="light">{placePhotos.length}</Badge>
            </Group>
            <Button
              variant="light"
              leftSection={<IconPhotoPlus size={16} />}
              onClick={() => placePhotosRef.current?.click()}
            >
              Добавить фото места
            </Button>
            <input
              ref={placePhotosRef}
              type="file"
              hidden
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => appendFiles(setPlacePhotos, event.currentTarget.files)}
            />
            {placePhotos.map((file, index) => (
              <Paper key={`${file.name}-${index}-${file.size}`} withBorder radius="md" p="xs">
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
                      src={placePreviewUrls[index]}
                      alt={file.name}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </Box>
                  <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                    <Text size="sm" lineClamp={1}>
                      {file.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </Text>
                  </Stack>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="Удалить фото"
                    onClick={() =>
                      setPlacePhotos((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p="md" style={{ background: "var(--surface)" }}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600}>Фото меню</Text>
              <Badge variant="light">{menuPhotos.length}</Badge>
            </Group>
            <Button
              variant="light"
              leftSection={<IconPhotoPlus size={16} />}
              onClick={() => menuPhotosRef.current?.click()}
            >
              Добавить фото меню
            </Button>
            <input
              ref={menuPhotosRef}
              type="file"
              hidden
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => appendFiles(setMenuPhotos, event.currentTarget.files)}
            />
            {menuPhotos.map((file, index) => (
              <Paper key={`${file.name}-${index}-${file.size}`} withBorder radius="md" p="xs">
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
                      src={menuPreviewUrls[index]}
                      alt={file.name}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </Box>
                  <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                    <Text size="sm" lineClamp={1}>
                      {file.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </Text>
                  </Stack>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="Удалить фото"
                    onClick={() =>
                      setMenuPhotos((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Paper>

        {error && (
          <Paper withBorder p="sm" radius="md" style={{ borderColor: "var(--color-status-error)" }}>
            <Text size="sm" c="red.6">
              {error}
            </Text>
          </Paper>
        )}

        <Paper
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
          <Button fullWidth onClick={() => void handleSubmit()} loading={submitting}>
            Отправить заявку
          </Button>
        </Paper>
      </Stack>
    </Modal>
  );
}
