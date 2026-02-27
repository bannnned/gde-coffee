import { useEffect, useRef, useState } from "react";
import {
  IconHeart,
  IconHeartFilled,
} from "@tabler/icons-react";

import { triggerCafeAISummary } from "../../../../api/reviews";
import { Button } from "../../../../components/ui";
import ReviewsSection from "./ReviewsSection";
import { useCafeDetailsComputed } from "./hooks/useCafeDetailsComputed";
import { useCafeDetailsData } from "./hooks/useCafeDetailsData";
import AboutSection from "./sections/AboutSection";
import MenuSection from "./sections/MenuSection";
import RatingPanel from "./sections/RatingPanel";

import PhotoLightboxModal from "../../../../components/PhotoLightboxModal";
import type { Cafe, CafePhotoKind } from "../../../../entities/cafe/model/types";
import { extractApiErrorMessage } from "../../../../utils/apiError";
import { cn } from "../../../../lib/utils";
import { AppModal } from "../../../../ui/bridge";

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
      showVerifiedSharePercent={canViewAdminDiagnostics}
      onOpenReviews={() => setSection("reviews")}
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
    <AppModal
      open={opened}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      fullScreen
      closeButton
      implementation="radix"
      title={
        <div className="flex min-w-0 items-center justify-between gap-2 pr-2">
          <p className="truncate text-base font-semibold text-[var(--text)]">{cafe.name}</p>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Добавить в избранное"
            onClick={onToggleFavorite}
            disabled={!onToggleFavorite || favoriteLoading}
            className={cn(
              "h-10 w-10 rounded-full border-glass-border bg-glass shadow-glass",
              isFavorite ? "text-[var(--color-brand-accent)]" : "text-[var(--text)]",
            )}
          >
            {isFavorite ? <IconHeartFilled size={18} /> : <IconHeart size={18} />}
          </Button>
        </div>
      }
      contentClassName="border border-glass-border bg-[linear-gradient(135deg,var(--glass-grad-1),var(--glass-grad-2))] shadow-[var(--shadow)] backdrop-blur-[18px] backdrop-saturate-[160%]"
      bodyClassName="pb-[calc(var(--page-edge-padding)+var(--safe-bottom))]"
    >
      <div className="px-[var(--page-edge-padding)] pb-2 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {DETAILS_SECTION_CONTROL_DATA.map((item) => {
            const active = section === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setSection(item.value)}
                className={cn(
                  "rounded-[12px] border px-2 py-2 text-sm font-semibold transition ui-interactive",
                  active
                    ? "border-[var(--glass-border)] bg-[linear-gradient(135deg,var(--glass-grad-1),var(--glass-grad-2))] text-[var(--text)] shadow-[var(--glass-shadow)]"
                    : "border-[var(--border)] bg-transparent text-[var(--text)]/82 hover:bg-[var(--card)]",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

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
        <div className="pb-4" style={{ paddingInline: "var(--page-edge-padding)" }}>
          <ReviewsSection
            cafeId={cafe.id}
            opened={opened}
            journeyID={journeyID}
            onReviewSaved={onReviewSaved}
          />
        </div>
      )}

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
    </AppModal>
  );
}
