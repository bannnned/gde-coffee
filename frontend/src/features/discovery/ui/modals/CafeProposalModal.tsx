import { useEffect, useMemo, useRef, useState } from "react";
import { notifications } from "../../../../lib/notifications";
import { IconMapPinFilled, IconPhotoPlus, IconTrash } from "@tabler/icons-react";

import { uploadCafePhotoByPresignedUrl } from "../../../../api/cafePhotos";
import { geocodeAddress } from "../../../../api/geocode";
import { presignSubmissionPhotoUpload, submitCafeCreate } from "../../../../api/submissions";
import Map from "../../../../components/Map";
import { AppModal, Badge, Button, Input } from "../../../../components/ui";
import { extractApiErrorMessage, extractApiErrorStatus } from "../../../../utils/apiError";
import classes from "./CafeProposalModal.module.css";

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
  const [mapPickerStartCenter, setMapPickerStartCenter] = useState<[number, number]>(mapCenter);
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
          if (!Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
            setGeocodeHint("Геокодер вернул некорректные координаты.");
            return;
          }
          setLatitude(Number(result.latitude).toFixed(COORD_PRECISION));
          setLongitude(Number(result.longitude).toFixed(COORD_PRECISION));
          setGeocodeHint("Координаты обновлены по адресу.");
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          const status = extractApiErrorStatus(err);
          if (status === 400) {
            setGeocodeHint(extractApiErrorMessage(err, "Проверьте адрес."));
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
    const accepted = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
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
    const objectKeys: Array<string | null> = Array.from({ length: files.length }, () => null);
    await runWithConcurrency(files, MAX_UPLOAD_CONCURRENCY, async (file, index) => {
      const presigned = await presignSubmissionPhotoUpload({
        contentType: file.type,
        sizeBytes: file.size,
      });
      await uploadCafePhotoByPresignedUrl(presigned.upload_url, file, presigned.headers ?? {});
      objectKeys[index] = presigned.object_key;
    });
    return objectKeys.filter(
      (objectKey): objectKey is string => typeof objectKey === "string" && objectKey.length > 0,
    );
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
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, "Не удалось отправить заявку.");
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
      <AppModal
        open={opened}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title="Предложить новую кофейню"
        fullScreen
        presentation="sheet"
        contentClassName={classes.modalContent}
        bodyClassName={classes.modalBody}
        titleClassName={classes.modalTitle}
      >
        <div className={classes.root}>
          <div className={classes.scrollArea}>
            <section className={classes.sectionCard}>
              <div className={classes.sectionStack}>
                <label className={classes.fieldLabel}>
                  Название
                  <Input
                    placeholder="Например, Roasters Corner"
                    value={name}
                    onChange={(event) => setName(event.currentTarget.value)}
                  />
                </label>
                <label className={classes.fieldLabel}>
                  Адрес
                  <Input
                    placeholder="Улица, дом"
                    value={address}
                    onChange={(event) => {
                      setAddress(event.currentTarget.value);
                      setGeocodeHint("Определяем координаты...");
                    }}
                  />
                </label>
                <label className={classes.fieldLabel}>
                  Описание (необязательно)
                  <textarea
                    className={classes.textarea}
                    placeholder="Что здесь особенного"
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.currentTarget.value)}
                  />
                </label>

                <div className={classes.coordsRow}>
                  <label className={classes.fieldLabel}>
                    Широта
                    <Input value={latitude} onChange={(event) => setLatitude(event.currentTarget.value)} />
                  </label>
                  <label className={classes.fieldLabel}>
                    Долгота
                    <Input value={longitude} onChange={(event) => setLongitude(event.currentTarget.value)} />
                  </label>
                </div>

                <Button type="button" variant="secondary" onClick={handleOpenMapPicker}>
                  Выбрать на карте
                </Button>
                <p className={classes.hintText}>
                  По умолчанию координаты подставлены из текущего центра карты.
                </p>
                {city ? <p className={classes.hintText}>Город для автопоиска: {city}</p> : null}
                {geocodeHint ? <p className={classes.hintText}>{geocodeHint}</p> : null}
              </div>
            </section>

            <section className={classes.sectionCard}>
              <div className={classes.sectionStack}>
                <div className={classes.sectionHeader}>
                  <p className={classes.sectionTitle}>Фото заведения</p>
                  <Badge>{placePhotos.length}</Badge>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => placePhotosRef.current?.click()}
                >
                  <IconPhotoPlus size={16} />
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
                  <div key={`${file.name}-${index}-${file.size}`} className={classes.fileRow}>
                    <div className={classes.filePreview}>
                      <img
                        src={placePreviewUrls[index]}
                        alt={file.name}
                        loading="lazy"
                        className={classes.filePreviewImage}
                      />
                    </div>
                    <div className={classes.fileMeta}>
                      <p className={classes.fileName}>{file.name}</p>
                      <p className={classes.fileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      className={`${classes.removeButton} ui-focus-ring`}
                      aria-label="Удалить фото"
                      onClick={() => setPlacePhotos((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className={classes.sectionCard}>
              <div className={classes.sectionStack}>
                <div className={classes.sectionHeader}>
                  <p className={classes.sectionTitle}>Фото меню</p>
                  <Badge>{menuPhotos.length}</Badge>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => menuPhotosRef.current?.click()}
                >
                  <IconPhotoPlus size={16} />
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
                  <div key={`${file.name}-${index}-${file.size}`} className={classes.fileRow}>
                    <div className={classes.filePreview}>
                      <img
                        src={menuPreviewUrls[index]}
                        alt={file.name}
                        loading="lazy"
                        className={classes.filePreviewImage}
                      />
                    </div>
                    <div className={classes.fileMeta}>
                      <p className={classes.fileName}>{file.name}</p>
                      <p className={classes.fileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      className={`${classes.removeButton} ui-focus-ring`}
                      aria-label="Удалить фото"
                      onClick={() => setMenuPhotos((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {error ? (
              <div className={classes.errorBox}>
                <p className={classes.errorText}>{error}</p>
              </div>
            ) : null}
          </div>

          <div className={classes.footer}>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              aria-busy={submitting ? "true" : undefined}
              className={classes.submitButton}
            >
              {submitting ? "Отправляем..." : "Отправить заявку"}
            </Button>
          </div>
        </div>
      </AppModal>

      <AppModal
        open={mapPickerOpen}
        onOpenChange={(next) => {
          if (!next) setMapPickerOpen(false);
        }}
        title="Выбор точки на карте"
        fullScreen
        presentation="sheet"
        contentClassName={classes.mapModalContent}
        bodyClassName={classes.mapModalBody}
      >
        <div className={classes.mapRoot}>
          <div className={classes.mapCanvas}>
            <Map
              center={mapPickerStartCenter}
              zoom={14}
              cafes={[]}
              userLocation={null}
              paddingEnabled={false}
              onCenterChange={setMapPickerCenter}
            />
          </div>

          <div className={classes.mapPin}>
            <IconMapPinFilled size={40} color="var(--color-map-cafe-marker)" stroke={1.5} />
          </div>

          <div className={classes.mapActions}>
            <Button type="button" variant="secondary" onClick={() => setMapPickerOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={handleConfirmMapPicker}>
              Выбрать
            </Button>
          </div>
        </div>
      </AppModal>
    </>
  );
}
