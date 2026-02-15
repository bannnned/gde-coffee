import { useEffect, useMemo, useRef, useState, type TouchEventHandler } from "react";
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
import {
  IconArrowsLeftRight,
  IconChevronLeft,
  IconChevronRight,
  IconHeart,
  IconLock,
} from "@tabler/icons-react";
import { getCafePhotos } from "../../../api/cafePhotos";

import type { Cafe, CafePhoto, CafePhotoKind } from "../types";
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

function filterPhotosByKind(photos: CafePhoto[] | undefined, kind: CafePhotoKind): CafePhoto[] {
  if (!Array.isArray(photos) || photos.length === 0) return [];
  return photos.filter((photo) => photo.kind === kind);
}

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
  const [cafePhotos, setCafePhotos] = useState<CafePhoto[]>(
    filterPhotosByKind(cafe?.photos, "cafe"),
  );
  const [menuPhotos, setMenuPhotos] = useState<CafePhoto[]>(
    filterPhotosByKind(cafe?.photos, "menu"),
  );
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
  const [aboutActiveIndex, setAboutActiveIndex] = useState(0);
  const [menuActiveIndex, setMenuActiveIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerKind, setViewerKind] = useState<CafePhotoKind>("cafe");
  const [viewerIndex, setViewerIndex] = useState(0);
  const [aboutImageReady, setAboutImageReady] = useState(true);
  const [menuImageReady, setMenuImageReady] = useState(true);
  const [viewerImageReady, setViewerImageReady] = useState(true);
  const touchStartXRef = useRef<number | null>(null);
  const coverPhotoUrl =
    cafe?.cover_photo_url ??
    cafePhotos.find((photo) => photo.is_cover)?.url ??
    cafePhotos[0]?.url;
  const aboutPhotoItems = useMemo(() => {
    if (cafePhotos.length > 0) return cafePhotos;
    if (!coverPhotoUrl) return [];
    return [
      {
        id: "__cover__",
        url: coverPhotoUrl,
        kind: "cafe" as const,
        is_cover: true,
        position: 1,
      },
    ];
  }, [cafePhotos, coverPhotoUrl]);
  const menuPhotoItems = menuPhotos;
  const aboutMainPhoto = aboutPhotoItems[aboutActiveIndex] ?? null;
  const menuMainPhoto = menuPhotoItems[menuActiveIndex] ?? null;
  const viewerPhotos = viewerKind === "menu" ? menuPhotoItems : aboutPhotoItems;
  const viewerPhoto = viewerPhotos[viewerIndex] ?? null;

  useEffect(() => {
    if (!opened || !cafe?.id) {
      setCafePhotos(filterPhotosByKind(cafe?.photos, "cafe"));
      setMenuPhotos(filterPhotosByKind(cafe?.photos, "menu"));
      return;
    }

    let cancelled = false;
    setCafePhotos(filterPhotosByKind(cafe.photos, "cafe"));
    setMenuPhotos(filterPhotosByKind(cafe.photos, "menu"));
    Promise.all([getCafePhotos(cafe.id, "cafe"), getCafePhotos(cafe.id, "menu")])
      .then(([nextCafePhotos, nextMenuPhotos]) => {
        if (cancelled) return;
        setCafePhotos(nextCafePhotos);
        setMenuPhotos(nextMenuPhotos);
      })
      .catch(() => {
        if (cancelled) return;
        setCafePhotos(filterPhotosByKind(cafe.photos, "cafe"));
        setMenuPhotos(filterPhotosByKind(cafe.photos, "menu"));
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
    setAboutActiveIndex(0);
    setMenuActiveIndex(0);
    setViewerOpen(false);
    setViewerIndex(0);
  }, [cafe?.id, opened]);

  useEffect(() => {
    setAboutActiveIndex((prev) =>
      aboutPhotoItems.length === 0 ? 0 : Math.min(prev, aboutPhotoItems.length - 1),
    );
  }, [aboutPhotoItems.length]);

  useEffect(() => {
    setMenuActiveIndex((prev) =>
      menuPhotoItems.length === 0 ? 0 : Math.min(prev, menuPhotoItems.length - 1),
    );
  }, [menuPhotoItems.length]);

  useEffect(() => {
    setViewerIndex((prev) =>
      viewerPhotos.length === 0 ? 0 : Math.min(prev, viewerPhotos.length - 1),
    );
  }, [viewerPhotos.length]);

  useEffect(() => {
    setAboutImageReady(false);
    const timer = window.setTimeout(() => setAboutImageReady(true), 260);
    return () => window.clearTimeout(timer);
  }, [aboutMainPhoto?.url]);

  useEffect(() => {
    setMenuImageReady(false);
    const timer = window.setTimeout(() => setMenuImageReady(true), 260);
    return () => window.clearTimeout(timer);
  }, [menuMainPhoto?.url]);

  useEffect(() => {
    setViewerImageReady(false);
    const timer = window.setTimeout(() => setViewerImageReady(true), 280);
    return () => window.clearTimeout(timer);
  }, [viewerPhoto?.url]);

  useEffect(() => {
    if (!viewerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setViewerOpen(false);
        return;
      }
      if (viewerPhotos.length <= 1) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setViewerIndex((prev) => (prev - 1 + viewerPhotos.length) % viewerPhotos.length);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setViewerIndex((prev) => (prev + 1) % viewerPhotos.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewerOpen, viewerPhotos.length]);

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

  const openViewer = (kind: CafePhotoKind, index: number) => {
    const list = kind === "menu" ? menuPhotoItems : aboutPhotoItems;
    if (list.length === 0) return;
    const safeIndex = Math.max(0, Math.min(index, list.length - 1));
    setViewerKind(kind);
    setViewerIndex(safeIndex);
    setViewerOpen(true);
  };

  const stepViewer = (direction: -1 | 1) => {
    if (viewerPhotos.length <= 1) return;
    setViewerIndex((prev) => (prev + direction + viewerPhotos.length) % viewerPhotos.length);
  };

  const handleViewerTouchStart: TouchEventHandler<HTMLDivElement> = (event) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleViewerTouchEnd: TouchEventHandler<HTMLDivElement> = (event) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    if (startX == null || endX == null || viewerPhotos.length <= 1) return;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 45) return;
    if (deltaX < 0) stepViewer(1);
    if (deltaX > 0) stepViewer(-1);
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
              {aboutMainPhoto && (
                <Paper
                  withBorder
                  radius="md"
                  onClick={() => openViewer("cafe", aboutActiveIndex)}
                  style={{
                    overflow: "hidden",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <img
                    src={aboutMainPhoto.url}
                    alt={`Фото: ${cafe.name}`}
                    onLoad={() => setAboutImageReady(true)}
                    style={{
                      width: "100%",
                      maxHeight: 260,
                      objectFit: "cover",
                      display: "block",
                      opacity: aboutImageReady ? 1 : 0.38,
                      filter: aboutImageReady ? "blur(0px)" : "blur(2px)",
                      transition: "opacity 220ms ease, filter 240ms ease",
                    }}
                  />
                </Paper>
              )}
              {aboutPhotoItems.length > 1 && (
                <Group
                  wrap="nowrap"
                  gap={8}
                  style={{ overflowX: "auto", paddingBottom: 2 }}
                >
                  {aboutPhotoItems.map((photo, index) => (
                    <Paper
                      key={photo.id}
                      withBorder
                      radius="sm"
                      onClick={() => setAboutActiveIndex(index)}
                      style={{
                        width: 96,
                        minWidth: 96,
                        height: 72,
                        overflow: "hidden",
                        border:
                          index === aboutActiveIndex
                            ? "1px solid var(--color-brand-accent)"
                            : "1px solid var(--border)",
                        background: "var(--surface)",
                        cursor: "pointer",
                        transform: index === aboutActiveIndex ? "translateY(-1px)" : "none",
                        transition: "border-color 160ms ease, transform 160ms ease",
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
                <Stack gap="xs">
                  {menuMainPhoto && (
                    <Paper
                      withBorder
                      radius="md"
                      onClick={() => openViewer("menu", menuActiveIndex)}
                      style={{
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        cursor: "pointer",
                      }}
                    >
                      <img
                        src={menuMainPhoto.url}
                        alt={`Меню: ${cafe.name}`}
                        loading="lazy"
                        onLoad={() => setMenuImageReady(true)}
                        style={{
                          width: "100%",
                          maxHeight: 260,
                          objectFit: "cover",
                          display: "block",
                          opacity: menuImageReady ? 1 : 0.38,
                          filter: menuImageReady ? "blur(0px)" : "blur(2px)",
                          transition: "opacity 220ms ease, filter 240ms ease",
                        }}
                      />
                    </Paper>
                  )}
                  {menuPhotoItems.length > 1 && (
                    <Group
                      wrap="nowrap"
                      gap={8}
                      style={{ overflowX: "auto", paddingBottom: 2 }}
                    >
                      {menuPhotoItems.map((photo, index) => (
                        <Paper
                          key={photo.id}
                          withBorder
                          radius="sm"
                          onClick={() => setMenuActiveIndex(index)}
                          style={{
                            width: 96,
                            minWidth: 96,
                            height: 72,
                            overflow: "hidden",
                            border:
                              index === menuActiveIndex
                                ? "1px solid var(--color-brand-accent)"
                                : "1px solid var(--border)",
                            background: "var(--surface)",
                            cursor: "pointer",
                            transform: index === menuActiveIndex ? "translateY(-1px)" : "none",
                            transition: "border-color 160ms ease, transform 160ms ease",
                          }}
                        >
                          <img
                            src={photo.url}
                            alt={`Меню: ${cafe.name}`}
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
                </Stack>
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

      <Modal
        opened={viewerOpen}
        onClose={() => setViewerOpen(false)}
        fullScreen
        withCloseButton
        title={viewerKind === "menu" ? "Фото меню" : "Фото заведения"}
        styles={{
          content: {
            background: "var(--bg)",
          },
          header: {
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          },
          body: {
            padding: 12,
          },
          overlay: {
            backgroundColor: "var(--color-surface-overlay-strong)",
            backdropFilter: "blur(4px)",
          },
        }}
      >
        {viewerPhoto ? (
          <Stack gap="sm">
            <Paper
              withBorder
              radius="md"
              onTouchStart={handleViewerTouchStart}
              onTouchEnd={handleViewerTouchEnd}
              style={{
                overflow: "hidden",
                border: "1px solid var(--border)",
                background: "var(--surface)",
              }}
            >
              <img
                src={viewerPhoto.url}
                alt={viewerKind === "menu" ? `Меню: ${cafe.name}` : `Фото: ${cafe.name}`}
                onLoad={() => setViewerImageReady(true)}
                style={{
                  width: "100%",
                  maxHeight: "72vh",
                  objectFit: "contain",
                  display: "block",
                  opacity: viewerImageReady ? 1 : 0.28,
                  filter: viewerImageReady ? "blur(0px)" : "blur(3px)",
                  transition: "opacity 240ms ease, filter 260ms ease",
                }}
              />
            </Paper>
            <Group justify="space-between" align="center">
              <ActionIcon
                variant="light"
                size="lg"
                radius="xl"
                onClick={() => stepViewer(-1)}
                disabled={viewerPhotos.length <= 1}
                aria-label="Предыдущее фото"
              >
                <IconChevronLeft size={18} />
              </ActionIcon>
              <Text size="sm" c="dimmed">
                {viewerIndex + 1} / {viewerPhotos.length}
              </Text>
              <ActionIcon
                variant="light"
                size="lg"
                radius="xl"
                onClick={() => stepViewer(1)}
                disabled={viewerPhotos.length <= 1}
                aria-label="Следующее фото"
              >
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
            {viewerPhotos.length > 1 && (
              <Group justify="center" gap={6}>
                <IconArrowsLeftRight size={14} style={{ opacity: 0.65 }} />
                <Text size="xs" c="dimmed">
                  Свайп влево/вправо или кнопки для листания
                </Text>
              </Group>
            )}
            {viewerPhotos.length > 1 && (
              <Group wrap="nowrap" gap={8} style={{ overflowX: "auto", paddingBottom: 2 }}>
                {viewerPhotos.map((photo, index) => (
                  <Paper
                    key={photo.id}
                    withBorder
                    radius="sm"
                    onClick={() => setViewerIndex(index)}
                    style={{
                      width: 88,
                      minWidth: 88,
                      height: 66,
                      overflow: "hidden",
                      border:
                        index === viewerIndex
                          ? "1px solid var(--color-brand-accent)"
                          : "1px solid var(--border)",
                      background: "var(--surface)",
                      cursor: "pointer",
                    }}
                  >
                    <img
                      src={photo.url}
                      alt={`Миниатюра ${index + 1}`}
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
          </Stack>
        ) : (
          <Paper withBorder radius="md" p="md">
            <Text c="dimmed">Фото не найдено.</Text>
          </Paper>
        )}
      </Modal>
    </Modal>
  );
}
