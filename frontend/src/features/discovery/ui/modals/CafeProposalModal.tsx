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
import { IconMapPinFilled, IconPhotoPlus, IconTrash } from "@tabler/icons-react";

import Map from "../../../../components/Map";
import { uploadCafePhotoByPresignedUrl } from "../../../../api/cafePhotos";
import { geocodeAddress } from "../../../../api/geocode";
import {
  presignSubmissionPhotoUpload,
  submitCafeCreate,
} from "../../../../api/submissions";

type CafeProposalModalProps = {
  opened: boolean;
  mapCenter: [number, number];
  city?: string;
  onClose: () => void;
};

const MAX_UPLOAD_CONCURRENCY = 3;
const COORD_PRECISION = 6;
const GEOCODE_DEBOUNCE_MS = 2000;

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
  city,
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
  const [geocodeHint, setGeocodeHint] = useState<string | null>(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapPickerStartCenter, setMapPickerStartCenter] = useState<[number, number]>(
    mapCenter,
  );
  const [mapPickerCenter, setMapPickerCenter] = useState<[number, number]>(mapCenter);

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
    setGeocodeHint(null);
    setMapPickerOpen(false);
  }, [centerLatitude, centerLongitude, opened]);

  useEffect(() => {
    if (opened) return;
    setMapPickerOpen(false);
  }, [opened]);

  useEffect(() => {
    if (!opened || mapPickerOpen) return;

    const trimmedAddress = address.trim();
    if (trimmedAddress.length < 3) {
      setGeocodeHint(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      geocodeAddress({
        address: trimmedAddress,
        city: city?.trim() || undefined,
        signal: controller.signal,
      })
        .then((result) => {
          if (!result?.found) {
            setGeocodeHint("Адрес не найден. Укажите координаты вручную или выберите точку на карте.");
            return;
          }
          if (
            !Number.isFinite(result.latitude) ||
            !Number.isFinite(result.longitude)
          ) {
            setGeocodeHint("Геокодер вернул некорректные координаты.");
            return;
          }
          setLatitude(Number(result.latitude).toFixed(COORD_PRECISION));
          setLongitude(Number(result.longitude).toFixed(COORD_PRECISION));
          setGeocodeHint("Координаты обновлены по адресу.");
        })
        .catch((err: any) => {
          if (controller.signal.aborted) return;
          const status = err?.response?.status ?? err?.normalized?.status;
          if (status === 400) {
            setGeocodeHint(err?.response?.data?.message ?? "Проверьте адрес.");
            return;
          }
          setGeocodeHint("Не удалось определить координаты автоматически.");
        });
    }, GEOCODE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address, city, mapPickerOpen, opened]);

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

  const handleOpenMapPicker = () => {
    const parsedLat = Number(latitude);
    const parsedLng = Number(longitude);
    const nextCenter: [number, number] =
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLng) &&
      parsedLat >= -90 &&
      parsedLat <= 90 &&
      parsedLng >= -180 &&
      parsedLng <= 180
        ? [parsedLng, parsedLat]
        : mapCenter;

    setMapPickerStartCenter(nextCenter);
    setMapPickerCenter(nextCenter);
    setMapPickerOpen(true);
  };

  const handleConfirmMapPicker = () => {
    setLongitude(mapPickerCenter[0].toFixed(COORD_PRECISION));
    setLatitude(mapPickerCenter[1].toFixed(COORD_PRECISION));
    setMapPickerOpen(false);
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
    <>
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
            padding: 16,
            overflow: "hidden",
          },
          overlay: {
            backgroundColor: "var(--color-surface-overlay-strong)",
            backdropFilter: "blur(6px)",
          },
        }}
      >
        <Box style={{ height: "calc(100dvh - 74px)", overflow: "hidden" }}>
          <Stack
            gap="md"
            style={{
              height: "100%",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              paddingBottom: 96,
            }}
          >
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
                  onChange={(event) => {
                    setAddress(event.currentTarget.value);
                    setGeocodeHint("Определяем координаты...");
                  }}
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
                <Button variant="light" onClick={handleOpenMapPicker}>
                  Выбрать на карте
                </Button>
                <Text size="xs" c="dimmed">
                  По умолчанию координаты подставлены из текущего центра карты.
                </Text>
                {city && (
                  <Text size="xs" c="dimmed">
                    Город для автопоиска: {city}
                  </Text>
                )}
                {geocodeHint && (
                  <Text size="xs" c="dimmed">
                    {geocodeHint}
                  </Text>
                )}
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
              <Paper
                withBorder
                p="sm"
                radius="md"
                style={{ borderColor: "var(--color-status-error)" }}
              >
                <Text size="sm" c="red.6">
                  {error}
                </Text>
              </Paper>
            )}
          </Stack>
        </Box>

        <Paper
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
            zIndex: 3,
          }}
        >
          <Button fullWidth onClick={() => void handleSubmit()} loading={submitting}>
            Отправить заявку
          </Button>
        </Paper>
      </Modal>

      <Modal
        opened={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        fullScreen
        withCloseButton
        zIndex={430}
        title="Выбор точки на карте"
        styles={{
          content: {
            background: "var(--surface)",
          },
          header: {
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          },
          body: {
            padding: 0,
          },
          overlay: {
            backgroundColor: "var(--color-surface-overlay-strong)",
            backdropFilter: "blur(6px)",
          },
        }}
      >
        <Box pos="relative" h="calc(100dvh - 62px)">
          <Box pos="absolute" inset={0}>
            <Map
              center={mapPickerStartCenter}
              zoom={14}
              cafes={[]}
              userLocation={null}
              paddingEnabled={false}
              onCenterChange={setMapPickerCenter}
            />
          </Box>

          <Box
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -100%)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            <IconMapPinFilled size={40} color="var(--color-map-cafe-marker)" stroke={1.5} />
          </Box>

          <Group
            justify="center"
            gap="xs"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "calc(16px + env(safe-area-inset-bottom))",
              zIndex: 3,
              pointerEvents: "none",
            }}
          >
            <Button
              variant="default"
              style={{ pointerEvents: "auto" }}
              onClick={() => setMapPickerOpen(false)}
            >
              Отмена
            </Button>
            <Button
              variant="gradient"
              gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
              style={{ pointerEvents: "auto" }}
              onClick={handleConfirmMapPicker}
            >
              Выбрать
            </Button>
          </Group>
        </Box>
      </Modal>
    </>
  );
}
