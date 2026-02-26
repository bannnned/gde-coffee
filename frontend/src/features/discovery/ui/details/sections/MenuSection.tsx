import { Badge, Button } from "../../../../../components/ui";
import { IconCamera, IconCameraPlus, IconPlus } from "@tabler/icons-react";
import { cn } from "../../../../../lib/utils";

import type { Cafe, CafePhoto } from "../../../../../entities/cafe/model/types";
import {
  buildCafePhotoPictureSources,
  buildCafePhotoSrcSet,
} from "../../../../../utils/cafePhotoVariants";

type MenuSectionProps = {
  cafe: Cafe;
  menuMainPhoto: CafePhoto | null;
  menuPhotoItems: CafePhoto[];
  specificTags: string[];
  menuActiveIndex: number;
  menuImageReady: boolean;
  isPhotoProcessing?: boolean;
  onOpenViewer: () => void;
  onMenuMainPhotoLoad: (src: string) => void;
  onMenuMainPhotoError: () => void;
  onSelectMenuPhoto: (index: number) => void;
  onManagePhotos?: (kind: "cafe" | "menu") => void;
};

function formatPhotoAddedDate(photo: CafePhoto | null): string | null {
  if (!photo) return null;
  const source = photo as CafePhoto & {
    created_at?: string;
    uploaded_at?: string;
    added_at?: string;
  };
  const rawDate = source.created_at || source.uploaded_at || source.added_at;
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MenuSection({
  cafe,
  menuMainPhoto,
  menuPhotoItems,
  specificTags,
  menuActiveIndex,
  menuImageReady,
  isPhotoProcessing = false,
  onOpenViewer,
  onMenuMainPhotoLoad,
  onMenuMainPhotoError,
  onSelectMenuPhoto,
  onManagePhotos,
}: MenuSectionProps) {
  const menuMainSources = buildCafePhotoPictureSources(menuMainPhoto?.url, [640, 1024, 1536]);
  const menuThumbSizes = "108px";
  const menuPhotoAddedDate = formatPhotoAddedDate(menuMainPhoto);

  return (
    <div className="flex flex-col gap-0">
      {menuMainPhoto ? (
        <div
          onClick={onOpenViewer}
          style={{
            overflow: "hidden",
            cursor: "pointer",
          }}
        >
          <picture style={{ display: "block" }}>
            {menuMainSources.avifSrcSet && (
              <source
                type="image/avif"
                srcSet={menuMainSources.avifSrcSet}
                sizes="(max-width: 768px) 100vw, 960px"
              />
            )}
            {menuMainSources.webpSrcSet && (
              <source
                type="image/webp"
                srcSet={menuMainSources.webpSrcSet}
                sizes="(max-width: 768px) 100vw, 960px"
              />
            )}
            <img
              src={menuMainPhoto.url}
              srcSet={menuMainSources.fallbackSrcSet}
              sizes="(max-width: 768px) 100vw, 960px"
              alt={`Меню: ${cafe.name}`}
              loading="lazy"
              onLoad={(event) => onMenuMainPhotoLoad(event.currentTarget.currentSrc || event.currentTarget.src)}
              onError={onMenuMainPhotoError}
              style={{
                width: "100%",
                height: 260,
                objectFit: "cover",
                display: "block",
                opacity: menuImageReady ? 1 : 0.38,
                filter: menuImageReady ? "blur(0px)" : "blur(2px)",
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
              "radial-gradient(circle at 78% 24%, color-mix(in srgb, var(--bg-accent-2) 52%, transparent), transparent 45%), linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
            borderBottom: "1px solid var(--glass-border)",
          }}
        >
          {onManagePhotos && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isPhotoProcessing}
              onClick={() => onManagePhotos("menu")}
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

      {menuPhotoAddedDate && (
        <div
          className="py-2"
          style={{
            borderBottom: "1px solid var(--border)",
            paddingInline: "var(--page-edge-padding)",
          }}
        >
          <p className="text-xs text-[var(--muted)]">
            Фото меню добавлено: {menuPhotoAddedDate}
          </p>
        </div>
      )}

      {specificTags.length > 0 && (
        <div
          className="horizontal-scroll-modern flex flex-nowrap gap-2 overflow-x-auto pt-3"
          style={{
            paddingBottom: menuPhotoItems.length > 1 ? 0 : 12,
            paddingInline: "var(--page-edge-padding)",
          }}
        >
          {specificTags.slice(0, 10).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="whitespace-nowrap px-3 py-1 text-xs font-semibold"
              style={{
                border: "1px solid color-mix(in srgb, var(--accent) 28%, var(--glass-border))",
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 42%, var(--surface)), color-mix(in srgb, var(--glass-grad-1) 88%, var(--surface)))",
                color: "var(--cafe-hero-emphasis-color)",
              }}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {menuPhotoItems.length > 1 && (
        <div
          className="horizontal-scroll-modern flex flex-nowrap gap-2 overflow-x-auto py-3"
          style={{
            paddingInline: "var(--page-edge-padding)",
          }}
        >
          {menuPhotoItems.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onSelectMenuPhoto(index)}
              aria-label={`Открыть фото меню ${index + 1}`}
              className={cn(
                "overflow-hidden rounded-md border transition ui-interactive",
                index === menuActiveIndex
                  ? "border-[var(--color-brand-accent)]"
                  : "border-[var(--border)]",
              )}
              style={{
                width: 108,
                minWidth: 108,
                height: 78,
                background: "var(--surface)",
                transform: index === menuActiveIndex ? "translateY(-1px)" : "none",
              }}
            >
              <img
                src={photo.url}
                srcSet={buildCafePhotoSrcSet(photo.url, [320, 640])}
                sizes={menuThumbSizes}
                alt={`Меню: ${cafe.name}`}
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

      <div className="py-4" style={{ paddingInline: "var(--page-edge-padding)" }}>
        {menuPhotoItems.length === 0 && specificTags.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            После добавления фото и отзывов здесь появятся позиции и теги меню.
          </p>
        )}
        {onManagePhotos && (
          <div className={cn("mt-2 flex justify-center", menuPhotoItems.length > 0 && "mt-0")}>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isPhotoProcessing}
              aria-label="Фото меню"
              onClick={() => onManagePhotos("menu")}
              className="rounded-full px-3.5 font-bold tracking-[0.01em]"
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
              {isPhotoProcessing ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : null}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
