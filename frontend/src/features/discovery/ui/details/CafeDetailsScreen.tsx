import { useEffect, useRef, useState, type TouchEventHandler } from "react";
import {
  ActionIcon,
  Box,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  useMantineTheme,
} from "@mantine/core";
import {
  IconArrowsLeftRight,
  IconChevronLeft,
  IconChevronRight,
  IconHeart,
  IconHeartFilled,
} from "@tabler/icons-react";

import ReviewsSection from "./ReviewsSection";
import { useCafeDetailsComputed } from "./hooks/useCafeDetailsComputed";
import { useCafeDetailsData } from "./hooks/useCafeDetailsData";
import AboutSection from "./sections/AboutSection";
import MenuSection from "./sections/MenuSection";
import RatingPanel from "./sections/RatingPanel";

import type { Cafe, CafePhotoKind } from "../../../../entities/cafe/model/types";

type CafeDetailsScreenProps = {
  opened: boolean;
  cafe: Cafe | null;
  onClose: () => void;
  showDistance?: boolean;
  showRoutes?: boolean;
  onOpen2gis?: () => void;
  onOpenYandex?: () => void;
  onStartDescriptionEdit?: () => boolean;
  onSaveDescription?: (
    description: string,
  ) => Promise<{ applied: boolean; description?: string; message?: string }>;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  favoriteLoading?: boolean;
  onManagePhotos?: (kind: "cafe" | "menu") => void;
  canManageDirectly?: boolean;
  canViewAdminDiagnostics?: boolean;
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
  onStartDescriptionEdit,
  onSaveDescription,
  isFavorite = false,
  onToggleFavorite,
  favoriteLoading = false,
  onManagePhotos,
  canManageDirectly = false,
  canViewAdminDiagnostics = false,
}: CafeDetailsScreenProps) {
  const theme = useMantineTheme();

  const [section, setSection] = useState<DetailsSection>("about");
  const [description, setDescription] = useState((cafe?.description ?? "").trim());
  const [descriptionDraft, setDescriptionDraft] = useState((cafe?.description ?? "").trim());
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
  const [ratingDiagnosticsExpanded, setRatingDiagnosticsExpanded] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const loadedAboutUrlsRef = useRef<Set<string>>(new Set());
  const loadedMenuUrlsRef = useRef<Set<string>>(new Set());
  const loadedViewerUrlsRef = useRef<Set<string>>(new Set());

  const {
    cafePhotos,
    menuPhotos,
    ratingSnapshot,
    ratingLoading,
    ratingError,
    ratingDiagnostics,
    ratingDiagnosticsLoading,
    ratingDiagnosticsError,
  } = useCafeDetailsData({
    opened,
    cafe,
    canViewAdminDiagnostics,
  });

  const {
    aboutPhotoItems,
    menuPhotoItems,
    aboutMainPhoto,
    menuMainPhoto,
    viewerPhotos,
    viewerPhoto,
    ratingLabel,
    ratingReviews,
    verifiedSharePercent,
    bestReview,
    diagnosticsTrust,
    diagnosticsBase,
    diagnosticsTopReviews,
  } = useCafeDetailsComputed({
    cafe,
    cafePhotos,
    menuPhotos,
    aboutActiveIndex,
    menuActiveIndex,
    viewerKind,
    viewerIndex,
    ratingSnapshot,
    ratingDiagnostics,
  });

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
    setRatingDiagnosticsExpanded(false);
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
    const nextURL = aboutMainPhoto?.url?.trim();
    if (!nextURL) {
      setAboutImageReady(true);
      return;
    }
    setAboutImageReady(loadedAboutUrlsRef.current.has(nextURL));
  }, [aboutMainPhoto?.url]);

  useEffect(() => {
    const nextURL = menuMainPhoto?.url?.trim();
    if (!nextURL) {
      setMenuImageReady(true);
      return;
    }
    setMenuImageReady(loadedMenuUrlsRef.current.has(nextURL));
  }, [menuMainPhoto?.url]);

  useEffect(() => {
    const nextURL = viewerPhoto?.url?.trim();
    if (!nextURL) {
      setViewerImageReady(true);
      return;
    }
    setViewerImageReady(loadedViewerUrlsRef.current.has(nextURL));
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
    overflow: "hidden",
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
    if (!canManageDirectly) return;
    if (onStartDescriptionEdit && !onStartDescriptionEdit()) {
      return;
    }
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

  const descriptionActionLabel = description ? "Редактировать описание" : "Добавить описание";

  const ratingPanel = (
    <RatingPanel
      ratingLabel={ratingLabel}
      ratingReviews={ratingReviews}
      verifiedSharePercent={verifiedSharePercent}
      ratingLoading={ratingLoading}
      ratingError={ratingError}
      bestReview={bestReview}
      canViewAdminDiagnostics={canViewAdminDiagnostics}
      ratingDiagnostics={ratingDiagnostics}
      ratingDiagnosticsLoading={ratingDiagnosticsLoading}
      ratingDiagnosticsError={ratingDiagnosticsError}
      ratingDiagnosticsExpanded={ratingDiagnosticsExpanded}
      onToggleDiagnosticsExpanded={() => setRatingDiagnosticsExpanded((value) => !value)}
      diagnosticsTrust={diagnosticsTrust}
      diagnosticsBase={diagnosticsBase}
      diagnosticsTopReviews={diagnosticsTopReviews}
    />
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
            onClick={onToggleFavorite}
            disabled={!onToggleFavorite}
            loading={favoriteLoading}
            style={{
              border: "1px solid var(--glass-border)",
              background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
              boxShadow: "var(--shadow)",
              backdropFilter: "blur(14px) saturate(140%)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              flexShrink: 0,
              color: isFavorite ? "var(--color-brand-accent)" : "var(--text)",
            }}
          >
            {isFavorite ? <IconHeartFilled size={18} /> : <IconHeart size={18} />}
          </ActionIcon>
        </Group>
      }
      styles={modalStyles}
    >
      <Paper withBorder radius="lg" p={0} style={cardStyles}>
        <Stack gap={0}>
          <Box p="md" pb="xs">
            <SegmentedControl
              fullWidth
              data={sectionControlData}
              value={section}
              onChange={(value) => setSection(value as DetailsSection)}
              styles={{
                root: {
                  background: "transparent",
                  border: "none",
                  boxShadow: "none",
                  padding: 0,
                  overflow: "visible",
                },
                indicator: {
                  background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 14,
                  boxShadow: "var(--glass-shadow)",
                  backdropFilter: "blur(12px) saturate(140%)",
                  WebkitBackdropFilter: "blur(12px) saturate(140%)",
                },
                label: {
                  color: "var(--text)",
                  fontWeight: 600,
                  borderRadius: 14,
                  padding: "10px 8px",
                  transition: "color 180ms ease, transform 160ms ease",
                },
              }}
            />
          </Box>

          {section === "about" && (
            <AboutSection
              cafe={cafe}
              aboutMainPhoto={aboutMainPhoto}
              aboutPhotoItems={aboutPhotoItems}
              aboutActiveIndex={aboutActiveIndex}
              aboutImageReady={aboutImageReady}
              onOpenViewer={() => openViewer("cafe", aboutActiveIndex)}
              onAboutMainPhotoLoad={(src) => {
                if (src) {
                  loadedAboutUrlsRef.current.add(src);
                }
                setAboutImageReady(true);
              }}
              onAboutMainPhotoError={() => setAboutImageReady(true)}
              onSelectAboutPhoto={setAboutActiveIndex}
              ratingPanel={ratingPanel}
              showDistance={showDistance}
              showRoutes={showRoutes}
              onOpen2gis={onOpen2gis}
              onOpenYandex={onOpenYandex}
              descriptionEditing={descriptionEditing}
              description={description}
              descriptionDraft={descriptionDraft}
              descriptionSaving={descriptionSaving}
              descriptionError={descriptionError}
              descriptionHint={descriptionHint}
              descriptionActionLabel={descriptionActionLabel}
              canManageDirectly={canManageDirectly}
              onDescriptionDraftChange={setDescriptionDraft}
              onStartDescription={handleStartDescription}
              onCancelDescription={handleCancelDescription}
              onSaveDescription={handleSaveDescription}
              onManagePhotos={onManagePhotos}
              canSaveDescription={Boolean(onSaveDescription)}
              badgeStyles={badgeStyles}
            />
          )}

          {section === "menu" && (
            <MenuSection
              cafe={cafe}
              menuMainPhoto={menuMainPhoto}
              menuPhotoItems={menuPhotoItems}
              menuActiveIndex={menuActiveIndex}
              menuImageReady={menuImageReady}
              onOpenViewer={() => openViewer("menu", menuActiveIndex)}
              onMenuMainPhotoLoad={(src) => {
                if (src) {
                  loadedMenuUrlsRef.current.add(src);
                }
                setMenuImageReady(true);
              }}
              onMenuMainPhotoError={() => setMenuImageReady(true)}
              onSelectMenuPhoto={setMenuActiveIndex}
              onManagePhotos={onManagePhotos}
            />
          )}

          {section === "reviews" && (
            <Box px="md" pb="md">
              <ReviewsSection cafeId={cafe.id} opened={opened} />
            </Box>
          )}
        </Stack>
      </Paper>

      <Modal
        opened={viewerOpen}
        onClose={() => setViewerOpen(false)}
        fullScreen
        withCloseButton
        title={viewerKind === "menu" ? "Фото меню" : "Фото места"}
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
                onLoad={(event) => {
                  const src = event.currentTarget.currentSrc || event.currentTarget.src;
                  if (src) {
                    loadedViewerUrlsRef.current.add(src);
                  }
                  setViewerImageReady(true);
                }}
                onError={() => setViewerImageReady(true)}
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
