import { Badge, Button } from "../../../../../components/ui";
import { cn } from "../../../../../lib/utils";
import { IconCamera, IconCameraPlus, IconPlus } from "@tabler/icons-react";
import type { ReactNode } from "react";

import type { Cafe, CafePhoto } from "../../../../../entities/cafe/model/types";
import {
  buildCafePhotoPictureSources,
  buildCafePhotoSrcSet,
} from "../../../../../utils/cafePhotoVariants";
import { AMENITY_LABELS } from "../../../constants";
import { formatDistance } from "../../../utils";

type AboutSectionProps = {
  cafe: Cafe;
  aboutMainPhoto: CafePhoto | null;
  aboutPhotoItems: CafePhoto[];
  aboutActiveIndex: number;
  aboutImageReady: boolean;
  isPhotoProcessing?: boolean;
  onOpenViewer: () => void;
  onAboutMainPhotoLoad: (src: string) => void;
  onAboutMainPhotoError: () => void;
  onSelectAboutPhoto: (index: number) => void;
  ratingPanel: ReactNode;
  showDistance: boolean;
  showRoutes: boolean;
  onOpen2gis?: () => void;
  onOpenYandex?: () => void;
  descriptionEditing: boolean;
  description: string;
  descriptionDraft: string;
  descriptionSaving: boolean;
  descriptionError: string | null;
  descriptionHint: string | null;
  descriptionActionLabel: string;
  canManageDirectly: boolean;
  onDescriptionDraftChange: (value: string) => void;
  onStartDescription: () => void;
  onCancelDescription: () => void;
  onSaveDescription: () => void;
  onManagePhotos?: (kind: "cafe" | "menu") => void;
  canSaveDescription: boolean;
};

export default function AboutSection({
  cafe,
  aboutMainPhoto,
  aboutPhotoItems,
  aboutActiveIndex,
  aboutImageReady,
  isPhotoProcessing = false,
  onOpenViewer,
  onAboutMainPhotoLoad,
  onAboutMainPhotoError,
  onSelectAboutPhoto,
  ratingPanel,
  showDistance,
  showRoutes,
  onOpen2gis,
  onOpenYandex,
  descriptionEditing,
  description,
  descriptionDraft,
  descriptionSaving,
  descriptionError,
  descriptionHint,
  descriptionActionLabel,
  canManageDirectly,
  onDescriptionDraftChange,
  onStartDescription,
  onCancelDescription,
  onSaveDescription,
  onManagePhotos,
  canSaveDescription,
}: AboutSectionProps) {
  const aboutMainSources = buildCafePhotoPictureSources(aboutMainPhoto?.url, [640, 1024, 1536]);
  const aboutThumbSizes = "108px";

  return (
    <div className="flex flex-col gap-0">
      {aboutMainPhoto ? (
        <div
          onClick={onOpenViewer}
          style={{
            overflow: "hidden",
            cursor: "pointer",
          }}
        >
          <picture style={{ display: "block" }}>
            {aboutMainSources.avifSrcSet && (
              <source
                type="image/avif"
                srcSet={aboutMainSources.avifSrcSet}
                sizes="(max-width: 768px) 100vw, 960px"
              />
            )}
            {aboutMainSources.webpSrcSet && (
              <source
                type="image/webp"
                srcSet={aboutMainSources.webpSrcSet}
                sizes="(max-width: 768px) 100vw, 960px"
              />
            )}
            <img
              src={aboutMainPhoto.url}
              srcSet={aboutMainSources.fallbackSrcSet}
              sizes="(max-width: 768px) 100vw, 960px"
              alt={`Фото: ${cafe.name}`}
              onLoad={(event) => onAboutMainPhotoLoad(event.currentTarget.currentSrc || event.currentTarget.src)}
              onError={onAboutMainPhotoError}
              style={{
                width: "100%",
                height: 260,
                objectFit: "cover",
                display: "block",
                opacity: aboutImageReady ? 1 : 0.38,
                filter: aboutImageReady ? "blur(0px)" : "blur(2px)",
                transition: "opacity 220ms ease, filter 240ms ease",
              }}
            />
          </picture>
        </div>
      ) : (
        <div
          style={{
            height: 260,
            display: "grid",
            placeItems: "center",
            padding: "18px var(--page-edge-padding)",
            background:
              "radial-gradient(circle at 18% 20%, color-mix(in srgb, var(--bg-accent-1) 52%, transparent), transparent 45%), linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
            borderBottom: "1px solid var(--glass-border)",
          }}
        >
          {onManagePhotos && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isPhotoProcessing}
              onClick={() => onManagePhotos("cafe")}
              className="mt-1 h-11 rounded-full px-4 font-bold shadow-glass"
              style={{
                border: "1px solid color-mix(in srgb, var(--color-brand-accent) 45%, var(--glass-border))",
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 68%, var(--surface)), var(--surface))",
                color: "var(--cafe-hero-emphasis-color)",
              }}
            >
              <IconCameraPlus size={16} />
              Добавить первое фото
              {isPhotoProcessing ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : null}
            </Button>
          )}
        </div>
      )}

      {aboutPhotoItems.length > 1 && (
        <div
          className="horizontal-scroll-modern flex flex-nowrap gap-2 overflow-x-auto py-2"
          style={{ paddingInline: "var(--page-edge-padding)" }}
        >
          {aboutPhotoItems.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onSelectAboutPhoto(index)}
              aria-label={`Открыть фото ${index + 1}`}
              className={cn(
                "overflow-hidden rounded-md border transition ui-interactive",
                index === aboutActiveIndex
                  ? "border-[var(--color-brand-accent)]"
                  : "border-[var(--border)]",
              )}
              style={{
                width: 108,
                minWidth: 108,
                height: 78,
                background: "var(--surface)",
                transform: index === aboutActiveIndex ? "translateY(-1px)" : "none",
              }}
            >
              <img
                src={photo.url}
                srcSet={buildCafePhotoSrcSet(photo.url, [320, 640])}
                sizes={aboutThumbSizes}
                alt={`Фото: ${cafe.name}`}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </button>
          ))}
        </div>
      )}

      <div
        className="flex flex-col gap-3 py-4"
        style={{ paddingInline: "var(--page-edge-padding)" }}
      >
        {ratingPanel}

        <p className="text-sm text-[var(--muted)]">
          {cafe.address}
        </p>
        {showDistance ? (
          <p className="text-sm text-[var(--text)]">{formatDistance(cafe.distance_m)}</p>
        ) : null}

        {descriptionEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={descriptionDraft}
              onChange={(event) => onDescriptionDraftChange(event.currentTarget.value)}
              placeholder="Опишите атмосферу, меню или особенности места"
              rows={4}
              className="min-h-[96px] w-full resize-y rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] shadow-surface placeholder:text-[var(--muted)] ui-interactive ui-focus-ring"
            />
            {descriptionError ? (
              <p className="text-xs text-danger">{descriptionError}</p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onCancelDescription}
                disabled={descriptionSaving}
              >
                Отмена
              </Button>
              <Button type="button" onClick={onSaveDescription} disabled={descriptionSaving}>
                {descriptionSaving ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Сохраняем...
                  </>
                ) : (
                  "Сохранить"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {description ? (
              <p className="whitespace-pre-wrap text-sm text-[var(--text)]">
                {description}
              </p>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Описание пока не добавлено.
              </p>
            )}
            {canManageDirectly && (
              <Button
                type="button"
                variant="secondary"
                onClick={onStartDescription}
                disabled={!canSaveDescription}
                className="h-9 w-fit rounded-full px-3.5 font-semibold tracking-[0.01em]"
                style={{
                  border: "1px solid color-mix(in srgb, var(--color-brand-accent) 42%, var(--glass-border))",
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 62%, var(--surface)), color-mix(in srgb, var(--glass-grad-1) 86%, var(--surface)))",
                  color: "var(--cafe-hero-emphasis-color)",
                  boxShadow:
                    "0 8px 18px color-mix(in srgb, var(--color-brand-accent-soft) 44%, transparent)",
                }}
              >
                {descriptionActionLabel}
              </Button>
            )}
          </>
        )}

        {canManageDirectly && descriptionHint ? (
          <p className="text-sm text-[var(--color-status-success)]">{descriptionHint}</p>
        ) : null}

        {cafe.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {cafe.amenities.map((a) => (
              <Badge
                key={a}
                variant="secondary"
                className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              >
                {AMENITY_LABELS[a] ?? a}
              </Badge>
            ))}
          </div>
        )}
        {showRoutes && (onOpen2gis || onOpenYandex) ? (
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {onOpen2gis ? (
              <Button type="button" onClick={onOpen2gis}>
                2GIS
              </Button>
            ) : null}
            {onOpenYandex && (
              <Button type="button" variant="secondary" onClick={onOpenYandex}>
                Яндекс
              </Button>
            )}
          </div>
        ) : null}
        {onManagePhotos && aboutPhotoItems.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Фото места"
            onClick={() => onManagePhotos("cafe")}
            className="mt-1 rounded-full px-3.5 font-bold tracking-[0.01em]"
            style={{
              border: "1px solid color-mix(in srgb, var(--accent) 46%, var(--glass-border))",
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 66%, var(--surface)), color-mix(in srgb, var(--glass-grad-1) 88%, var(--surface)))",
              color: "var(--cafe-hero-emphasis-color)",
              boxShadow:
                "0 10px 24px color-mix(in srgb, var(--color-brand-accent-soft) 58%, transparent)",
              backdropFilter: "blur(12px) saturate(150%)",
              WebkitBackdropFilter: "blur(12px) saturate(150%)",
            }}
          >
            <IconCamera size={16} />
            Добавить фото
            <IconPlus size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
