import { useEffect, useState } from "react";
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
  Textarea,
  ThemeIcon,
  useMantineTheme,
} from "@mantine/core";
import { IconHeart, IconLock } from "@tabler/icons-react";
import { getCafePhotos } from "../../../api/cafePhotos";

import type { Cafe, CafePhoto } from "../types";
import { AMENITY_LABELS } from "../constants";
import { formatDistance } from "../utils";

type CafeDetailsScreenProps = {
  opened: boolean;
  cafe: Cafe | null;
  onClose: () => void;
  showDistance?: boolean;
  showRoutes?: boolean;
  onOpen2gis?: () => void;
  onOpenYandex?: () => void;
  onSaveDescription?: (
    description: string,
  ) => Promise<{ applied: boolean; description?: string; message?: string }>;
  onManagePhotos?: (kind: "cafe" | "menu") => void;
  canManageDirectly?: boolean;
};

type DetailsSection = "about" | "menu" | "reviews";

export default function CafeDetailsScreen({
  opened,
  cafe,
  onClose,
  showDistance = true,
  showRoutes = true,
  onOpen2gis,
  onOpenYandex,
  onSaveDescription,
  onManagePhotos,
  canManageDirectly = false,
}: CafeDetailsScreenProps) {
  const theme = useMantineTheme();
  const [photos, setPhotos] = useState<CafePhoto[]>(cafe?.photos ?? []);
  const [section, setSection] = useState<DetailsSection>("about");
  const [description, setDescription] = useState(
    (cafe?.description ?? "").trim(),
  );
  const [descriptionDraft, setDescriptionDraft] = useState(
    (cafe?.description ?? "").trim(),
  );
  const [descriptionEditing, setDescriptionEditing] = useState(false);
  const [descriptionSaving, setDescriptionSaving] = useState(false);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [descriptionHint, setDescriptionHint] = useState<string | null>(null);
  const coverPhotoUrl = cafe?.cover_photo_url ?? photos[0]?.url;
  const menuPhotoItems: CafePhoto[] =
    photos.length > 0
      ? photos
      : coverPhotoUrl
        ? [{ id: "__cover__", url: coverPhotoUrl, is_cover: true, position: 1 }]
        : [];

  useEffect(() => {
    if (!opened || !cafe?.id) {
      setPhotos(cafe?.photos ?? []);
      return;
    }
    let cancelled = false;
    setPhotos(cafe.photos ?? []);
    getCafePhotos(cafe.id)
      .then((list) => {
        if (cancelled) return;
        setPhotos(list);
      })
      .catch(() => {
        if (cancelled) return;
        setPhotos(cafe.photos ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [cafe?.id, cafe?.photos, opened]);

  useEffect(() => {
    if (!opened) return;
    setSection("about");
    const nextDescription = (cafe?.description ?? "").trim();
    setDescription(nextDescription);
    setDescriptionDraft(nextDescription);
    setDescriptionEditing(false);
    setDescriptionSaving(false);
    setDescriptionError(null);
    setDescriptionHint(null);
  }, [cafe?.id, opened]);

  if (!cafe) return null;

  const modalStyles = {
    content: {
      background: "var(--glass-bg)",
      border: "1px solid var(--glass-border)",
      boxShadow: "var(--shadow)",
      backdropFilter: "blur(18px) saturate(160%)",
      WebkitBackdropFilter: "blur(18px) saturate(160%)",
    },
    header: {
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
    },
    title: {
      fontWeight: 700,
      width: "100%",
      paddingRight: 8,
    },
    body: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
    },
    overlay: {
      backdropFilter: "blur(4px)",
      backgroundColor: "var(--color-surface-overlay-strong)",
    },
  } as const;

  const cardStyles = {
    background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
    border: "1px solid var(--glass-border)",
    boxShadow: "var(--shadow)",
    backdropFilter: "blur(18px) saturate(160%)",
    WebkitBackdropFilter: "blur(18px) saturate(160%)",
  } as const;

  const badgeStyles = {
    root: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      color: "var(--text)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    },
  } as const;

  const sectionControlData = [
    { label: "О месте", value: "about" },
    { label: "Меню", value: "menu" },
    { label: "Отзывы", value: "reviews" },
  ];

  const handleStartDescription = () => {
    setDescriptionDraft(description);
    setDescriptionError(null);
    setDescriptionHint(null);
    setDescriptionEditing(true);
  };

  const handleCancelDescription = () => {
    setDescriptionDraft(description);
    setDescriptionError(null);
    setDescriptionEditing(false);
  };

  const handleSaveDescription = async () => {
    if (!onSaveDescription) return;
    const trimmed = descriptionDraft.trim();
    if (!trimmed) {
      setDescriptionError("Введите описание.");
      return;
    }

    setDescriptionSaving(true);
    setDescriptionError(null);
    try {
      const result = await onSaveDescription(trimmed);
      const next =
        result.applied && typeof result.description === "string"
          ? result.description.trim()
          : description;
      if (result.applied) {
        setDescription(next);
      }
      setDescriptionDraft(next || trimmed);
      setDescriptionEditing(false);
      setDescriptionHint(
        result.message ??
          (result.applied
            ? "Описание сохранено."
            : "Заявка на изменение отправлена на модерацию."),
      );
    } catch (error: any) {
      const message =
        error?.normalized?.message ??
        error?.response?.data?.message ??
        error?.message ??
        "Не удалось сохранить описание.";
      setDescriptionError(message);
    } finally {
      setDescriptionSaving(false);
    }
  };

  const descriptionActionLabel = description
    ? canManageDirectly
      ? "Редактировать описание"
      : "Предложить правку описания"
    : "Добавить описание";

  const lockedBlock = (title: string, blockDescription: string) => (
    <Paper
      withBorder
      radius="md"
      p="md"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <Group align="flex-start" wrap="nowrap">
        <ThemeIcon variant="light" color="gray" radius="xl" size="lg" mt={2}>
          <IconLock size={16} />
        </ThemeIcon>
        <Stack gap={2}>
          <Text fw={600} size="sm">
            {title}
          </Text>
          <Text c="dimmed" size="sm">
            {blockDescription}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      withCloseButton
      title={
        <Group justify="space-between" align="center" wrap="nowrap">
          <Text fw={700} lineClamp={1}>
            {cafe.name}
          </Text>
          <ActionIcon
            variant="default"
            size="lg"
            radius="xl"
            aria-label="Добавить в избранное"
            onClick={() => void 0}
            style={{
              border: "1px solid var(--glass-border)",
              background:
                "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
              boxShadow: "var(--shadow)",
              backdropFilter: "blur(14px) saturate(140%)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              flexShrink: 0,
            }}
          >
            <IconHeart size={18} />
          </ActionIcon>
        </Group>
      }
      styles={modalStyles}
    >
      <Paper withBorder radius="lg" p="md" style={cardStyles}>
        <Stack gap="md">
          <SegmentedControl
            fullWidth
            data={sectionControlData}
            value={section}
            onChange={(value) => setSection(value as DetailsSection)}
            styles={{
              root: {
                background:
                  "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
                border: "1px solid var(--glass-border)",
                boxShadow: "var(--shadow)",
                backdropFilter: "blur(14px) saturate(140%)",
                WebkitBackdropFilter: "blur(14px) saturate(140%)",
              },
              indicator: {
                background:
                  "linear-gradient(135deg, var(--color-brand-accent), var(--color-brand-accent-strong))",
                border: "1px solid var(--color-border-soft)",
                boxShadow: "0 6px 16px var(--color-brand-accent-soft)",
              },
              label: {
                color: "var(--text)",
                fontWeight: 600,
              },
            }}
          />

          {section === "about" && (
            <Stack gap="xs">
              {coverPhotoUrl && (
                <Paper
                  withBorder
                  radius="md"
                  style={{
                    overflow: "hidden",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <img
                    src={coverPhotoUrl}
                    alt={`Фото: ${cafe.name}`}
                    style={{
                      width: "100%",
                      maxHeight: 260,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </Paper>
              )}
              {photos.length > 1 && (
                <Group
                  wrap="nowrap"
                  gap={8}
                  style={{ overflowX: "auto", paddingBottom: 2 }}
                >
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
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                      }}
                    >
                      <img
                        src={photo.url}
                        alt={`Фото: ${cafe.name}`}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </Paper>
                  ))}
                </Group>
              )}
              <Text c="dimmed" size="sm">
                {cafe.address}
              </Text>
              {showDistance && <Text size="sm">{formatDistance(cafe.distance_m)}</Text>}

              {descriptionEditing ? (
                <Paper
                  withBorder
                  radius="md"
                  p="md"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Stack gap="xs">
                    <Textarea
                      value={descriptionDraft}
                      onChange={(event) => setDescriptionDraft(event.currentTarget.value)}
                      placeholder="Опишите атмосферу, меню или особенности места"
                      autosize
                      minRows={3}
                      maxRows={6}
                    />
                    {descriptionError && (
                      <Text size="xs" c="red">
                        {descriptionError}
                      </Text>
                    )}
                    <Group justify="flex-end">
                      <Button
                        variant="default"
                        onClick={handleCancelDescription}
                        disabled={descriptionSaving}
                      >
                        Отмена
                      </Button>
                      <Button onClick={handleSaveDescription} loading={descriptionSaving}>
                        Сохранить
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              ) : description ? (
                <Paper
                  withBorder
                  radius="md"
                  p="md"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                    {description}
                  </Text>
                </Paper>
              ) : (
                <Button
                  variant="light"
                  onClick={handleStartDescription}
                  disabled={!onSaveDescription}
                >
                  {descriptionActionLabel}
                </Button>
              )}
              {description && !descriptionEditing && (
                <Button
                  variant="subtle"
                  onClick={handleStartDescription}
                  disabled={!onSaveDescription}
                >
                  {descriptionActionLabel}
                </Button>
              )}
              {descriptionHint && (
                <Text size="sm" c="teal.6">
                  {descriptionHint}
                </Text>
              )}

              {cafe.amenities.length > 0 && (
                <Group gap={6} wrap="wrap">
                  {cafe.amenities.map((a) => (
                    <Badge key={a} variant="light" styles={badgeStyles}>
                      {AMENITY_LABELS[a] ?? a}
                    </Badge>
                  ))}
                </Group>
              )}
              {showRoutes && (onOpen2gis || onOpenYandex) && (
                <Group mt="xs" grow>
                  {onOpen2gis && <Button onClick={onOpen2gis}>2GIS</Button>}
                  {onOpenYandex && (
                    <Button variant="light" onClick={onOpenYandex}>
                      Яндекс
                    </Button>
                  )}
                </Group>
              )}
              {onManagePhotos && (
                <Button mt="xs" variant="light" onClick={() => onManagePhotos("cafe")}>
                  {canManageDirectly ? "Управлять фото заведения" : "Предложить фото заведения"}
                </Button>
              )}
            </Stack>
          )}

          {section === "menu" && (
            <Stack gap="sm">
              <Text size="sm" fw={600}>
                Фото меню и позиций
              </Text>
              {menuPhotoItems.length > 0 ? (
                <Box
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 8,
                  }}
                >
                  {menuPhotoItems.map((photo) => (
                    <Paper
                      key={photo.id}
                      withBorder
                      radius="sm"
                      style={{
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                      }}
                    >
                      <img
                        src={photo.url}
                        alt={`Меню: ${cafe.name}`}
                        loading="lazy"
                        style={{
                          width: "100%",
                          aspectRatio: "4 / 3",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Paper
                  withBorder
                  radius="md"
                  p="md"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Text size="sm" c="dimmed">
                    Фото меню и позиций
                  </Text>
                </Paper>
              )}
              {onManagePhotos && (
                <Button variant="light" onClick={() => onManagePhotos("menu")}>
                  {canManageDirectly ? "Управлять фото меню" : "Предложить фото меню"}
                </Button>
              )}
            </Stack>
          )}

          {section === "reviews" &&
            lockedBlock(
              "Отзывы скоро",
              "Раздел отзывов временно недоступен. Подключим в одном из следующих релизов.",
            )}
        </Stack>
      </Paper>
    </Modal>
  );
}
