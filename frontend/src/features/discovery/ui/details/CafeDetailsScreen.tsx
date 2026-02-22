import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Box,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import {
  IconHeart,
  IconHeartFilled,
} from "@tabler/icons-react";

import { triggerCafeAISummary } from "../../../../api/reviews";
import ReviewsSection from "./ReviewsSection";
import { useCafeDetailsComputed } from "./hooks/useCafeDetailsComputed";
import { useCafeDetailsData } from "./hooks/useCafeDetailsData";
import AboutSection from "./sections/AboutSection";
import MenuSection from "./sections/MenuSection";
import RatingPanel from "./sections/RatingPanel";

import PhotoLightboxModal from "../../../../components/PhotoLightboxModal";
import type { Cafe, CafePhotoKind } from "../../../../entities/cafe/model/types";
import { extractApiErrorMessage } from "../../../../utils/apiError";

type CafeDetailsScreenProps = {
  opened: boolean;
  cafe: Cafe | null;
  journeyID?: string;
  photosRefreshToken?: number;
  onReviewSaved?: (cafeId: string) => void;
  isCafePhotoProcessing?: boolean;
  isMenuPhotoProcessing?: boolean;
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
const DETAILS_SECTION_CONTROL_DATA = [
  { label: "О месте", value: "about" },
  { label: "Меню", value: "menu" },
  { label: "Отзывы", value: "reviews" },
] as const;

export default function CafeDetailsScreen({
  opened,
  cafe,
  journeyID = "",
  photosRefreshToken = 0,
  onReviewSaved,
  isCafePhotoProcessing = false,
  isMenuPhotoProcessing = false,
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
  const [ratingDiagnosticsExpanded, setRatingDiagnosticsExpanded] = useState(false);
  const [ratingRefreshToken, setRatingRefreshToken] = useState(0);
  const [aiSummaryTriggerLoading, setAiSummaryTriggerLoading] = useState(false);

  const loadedAboutUrlsRef = useRef<Set<string>>(new Set());
  const loadedMenuUrlsRef = useRef<Set<string>>(new Set());

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
    photosRefreshToken,
    ratingRefreshToken,
  });

  const {
    aboutPhotoItems,
    menuPhotoItems,
    aboutMainPhoto,
    menuMainPhoto,
    viewerPhotos,
    ratingLabel,
    ratingReviews,
    verifiedSharePercent,
    bestReview,
    specificTags,
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
    setRatingRefreshToken(0);
    setAiSummaryTriggerLoading(false);
    setAboutActiveIndex(0);
    setMenuActiveIndex(0);
    setViewerOpen(false);
    setViewerIndex(0);
  }, [cafe?.description, cafe?.id, opened]);

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
      padding: "var(--page-edge-padding)",
      paddingBottom: "calc(var(--page-edge-padding) + env(safe-area-inset-bottom))",
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
    } catch (error: unknown) {
      const message = extractApiErrorMessage(error, "Не удалось сохранить описание.");
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

  const descriptionActionLabel = description ? "Редактировать описание" : "Добавить описание";

  const handleAdminTriggerAISummary = async () => {
    if (!canViewAdminDiagnostics || !cafe?.id) return;
    setAiSummaryTriggerLoading(true);
    try {
      const response = await triggerCafeAISummary(cafe.id);
      // Temporary observability requested by business: keep raw AI result in browser console.
      console.log("[AI summary trigger]", response);
    } catch (error: unknown) {
      console.error("[AI summary trigger failed]", error);
    } finally {
      setAiSummaryTriggerLoading(false);
      setRatingRefreshToken((value) => value + 1);
    }
  };

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
      aiSummaryTriggerLoading={aiSummaryTriggerLoading}
      onTriggerAISummary={handleAdminTriggerAISummary}
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
          <Box
            pt="md"
            pb="xs"
            style={{ paddingInline: "var(--page-edge-padding)" }}
          >
            <SegmentedControl
              fullWidth
              transitionDuration={0}
              data={DETAILS_SECTION_CONTROL_DATA}
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
                control: {
                  border: "none",
                  "&::before": {
                    display: "none",
                  },
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
                  transition: "color 120ms ease",
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
              isPhotoProcessing={isCafePhotoProcessing}
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
              onSaveDescription={() => {
                void handleSaveDescription();
              }}
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
              specificTags={specificTags}
              menuActiveIndex={menuActiveIndex}
              menuImageReady={menuImageReady}
              isPhotoProcessing={isMenuPhotoProcessing}
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
            <Box pb="md" style={{ paddingInline: "var(--page-edge-padding)" }}>
              <ReviewsSection
                cafeId={cafe.id}
                opened={opened}
                journeyID={journeyID}
                onReviewSaved={onReviewSaved}
              />
            </Box>
          )}
        </Stack>
      </Paper>

      <PhotoLightboxModal
        opened={viewerOpen}
        onClose={() => setViewerOpen(false)}
        title={viewerKind === "menu" ? "Фото меню" : "Фото места"}
        photos={viewerPhotos.map((photo, index) => ({
          id: photo.id || `${viewerKind}-${index + 1}`,
          url: photo.url,
          alt: viewerKind === "menu" ? `Меню: ${cafe.name}` : `Фото: ${cafe.name}`,
        }))}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
      />
    </Modal>
  );
}
