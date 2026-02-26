import { useEffect, useMemo, useRef, useState, type TouchEventHandler } from "react";
import {
  IconArrowsLeftRight,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "./ui";
import { cn } from "../lib/utils";
import { AppModal } from "../ui/bridge";
import {
  buildCafePhotoPictureSources,
  buildCafePhotoSrcSet,
} from "../utils/cafePhotoVariants";

export type PhotoLightboxItem = {
  id: string;
  url: string;
  alt?: string;
};

type PhotoLightboxModalProps = {
  opened: boolean;
  onClose: () => void;
  title?: string;
  photos: PhotoLightboxItem[];
  index: number;
  onIndexChange: (nextIndex: number) => void;
};

function detectDirection(prev: number, next: number, length: number): -1 | 1 {
  if (length <= 1 || prev === next) return 1;
  if (prev === 0 && next === length - 1) return -1;
  if (prev === length - 1 && next === 0) return 1;
  return next > prev ? 1 : -1;
}

export default function PhotoLightboxModal({
  opened,
  onClose,
  title = "Фото",
  photos,
  index,
  onIndexChange,
}: PhotoLightboxModalProps) {
  const touchStartXRef = useRef<number | null>(null);
  const loadedUrlsRef = useRef<Set<string>>(new Set());
  const prevIndexRef = useRef(index);
  const [imageReady, setImageReady] = useState(true);
  const [direction, setDirection] = useState<-1 | 1>(1);

  const safeIndex = useMemo(() => {
    if (photos.length === 0) return 0;
    return Math.max(0, Math.min(index, photos.length - 1));
  }, [index, photos.length]);

  const activePhoto = photos[safeIndex] ?? null;
  const mainSources = buildCafePhotoPictureSources(activePhoto?.url, [640, 1024, 1536]);

  useEffect(() => {
    if (!opened) return;
    const previous = prevIndexRef.current;
    setDirection(detectDirection(previous, safeIndex, photos.length));
    prevIndexRef.current = safeIndex;
  }, [opened, photos.length, safeIndex]);

  useEffect(() => {
    const nextURL = activePhoto?.url?.trim();
    if (!nextURL) {
      setImageReady(true);
      return;
    }
    setImageReady(loadedUrlsRef.current.has(nextURL));
  }, [activePhoto?.url]);

  useEffect(() => {
    if (!opened) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (photos.length <= 1) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onIndexChange((safeIndex - 1 + photos.length) % photos.length);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onIndexChange((safeIndex + 1) % photos.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onIndexChange, opened, photos.length, safeIndex]);

  const stepPhoto = (step: -1 | 1) => {
    if (photos.length <= 1) return;
    onIndexChange((safeIndex + step + photos.length) % photos.length);
  };

  const handleTouchStart: TouchEventHandler<HTMLDivElement> = (event) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd: TouchEventHandler<HTMLDivElement> = (event) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    if (startX == null || endX == null || photos.length <= 1) return;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 45) return;
    if (deltaX < 0) stepPhoto(1);
    if (deltaX > 0) stepPhoto(-1);
  };

  return (
    <AppModal
      open={opened}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      implementation="radix"
      presentation="dialog"
      closeButton={false}
      contentClassName="w-[min(96vw,1080px)] border-0 bg-transparent p-0 shadow-none"
      bodyClassName="p-0"
    >
      <div
        style={{
          border: "1px solid color-mix(in srgb, var(--glass-border) 84%, transparent)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--glass-grad-1) 94%, transparent), color-mix(in srgb, var(--glass-grad-2) 92%, transparent))",
          boxShadow: "0 28px 80px color-mix(in srgb, #000 44%, transparent)",
          backdropFilter: "blur(22px) saturate(135%)",
          WebkitBackdropFilter: "blur(22px) saturate(135%)",
          borderRadius: 26,
          padding: 12,
        }}
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="truncate text-sm font-semibold text-[var(--text)]">
              {title}
            </p>
            <div className="flex items-center gap-1.5">
              {photos.length > 0 && (
                <p className="text-xs text-[var(--muted)]">
                  {safeIndex + 1} / {photos.length}
                </p>
              )}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={onClose}
                aria-label="Закрыть просмотр фото"
                className="h-9 w-9 rounded-full border-glass-border bg-glass text-text shadow-glass"
              >
                ✕
              </Button>
            </div>
          </div>

              {activePhoto ? (
            <>
              <div
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                style={{
                  position: "relative",
                  borderRadius: 20,
                  overflow: "hidden",
                  background:
                    "radial-gradient(circle at 30% 16%, color-mix(in srgb, var(--bg-accent-1) 35%, transparent), transparent 58%), var(--surface)",
                  border: "1px solid color-mix(in srgb, var(--glass-border) 80%, transparent)",
                  minHeight: 240,
                  maxHeight: "76vh",
                }}
              >
                <AnimatePresence initial={false} custom={direction}>
                  <motion.picture
                    key={`${activePhoto.id}:${activePhoto.url}`}
                    custom={direction}
                    initial={{ opacity: 0, x: direction > 0 ? 38 : -38 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction > 0 ? -38 : 38 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      width: "100%",
                      display: "block",
                    }}
                  >
                    {mainSources.avifSrcSet && (
                      <source
                        type="image/avif"
                        srcSet={mainSources.avifSrcSet}
                        sizes="(max-width: 768px) 92vw, 1080px"
                      />
                    )}
                    {mainSources.webpSrcSet && (
                      <source
                        type="image/webp"
                        srcSet={mainSources.webpSrcSet}
                        sizes="(max-width: 768px) 92vw, 1080px"
                      />
                    )}
                    <img
                      src={activePhoto.url}
                      srcSet={mainSources.fallbackSrcSet}
                      sizes="(max-width: 768px) 92vw, 1080px"
                      alt={activePhoto.alt || `Фото ${safeIndex + 1}`}
                      onLoad={(event) => {
                        const src = event.currentTarget.currentSrc || event.currentTarget.src;
                        if (src) {
                          loadedUrlsRef.current.add(src);
                        }
                        setImageReady(true);
                      }}
                      onError={() => setImageReady(true)}
                      style={{
                        width: "100%",
                        maxHeight: "76vh",
                        objectFit: "contain",
                        display: "block",
                        opacity: imageReady ? 1 : 0.3,
                        filter: imageReady ? "blur(0px)" : "blur(3px)",
                        transition: "opacity 240ms ease, filter 260ms ease",
                      }}
                    />
                  </motion.picture>
                </AnimatePresence>

                <div
                  style={{
                    position: "absolute",
                    insetInline: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    disabled={photos.length <= 1}
                    onClick={() => stepPhoto(-1)}
                    aria-label="Предыдущее фото"
                    className="pointer-events-auto h-10 w-10 rounded-full border-glass-border bg-glass text-text shadow-glass backdrop-blur-[8px]"
                  >
                    <IconChevronLeft size={18} />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    disabled={photos.length <= 1}
                    onClick={() => stepPhoto(1)}
                    aria-label="Следующее фото"
                    className="pointer-events-auto h-10 w-10 rounded-full border-glass-border bg-glass text-text shadow-glass backdrop-blur-[8px]"
                  >
                    <IconChevronRight size={18} />
                  </Button>
                </div>
              </div>

              {photos.length > 1 && (
                <div className="flex items-center justify-center gap-1.5">
                  <IconArrowsLeftRight size={14} style={{ opacity: 0.6 }} />
                  <p className="text-xs text-[var(--muted)]">
                    Свайп влево/вправо или кнопки для листания
                  </p>
                </div>
              )}

              {photos.length > 1 && (
                <div className="horizontal-scroll-modern flex flex-nowrap gap-2 overflow-x-auto pb-[2px]">
                  {photos.map((photo, nextIndex) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => onIndexChange(nextIndex)}
                      aria-label={`Открыть фото ${nextIndex + 1}`}
                      className={cn(
                        "overflow-hidden rounded-md border transition ui-interactive",
                        nextIndex === safeIndex
                          ? "border-[var(--color-brand-accent)]"
                          : "border-[var(--border)]",
                      )}
                      style={{
                        width: 92,
                        minWidth: 92,
                        height: 68,
                        background: "var(--surface)",
                        transform: nextIndex === safeIndex ? "translateY(-1px)" : "none",
                      }}
                    >
                      <img
                        src={photo.url}
                        srcSet={buildCafePhotoSrcSet(photo.url, [320, 640])}
                        sizes="92px"
                        alt={photo.alt || `Миниатюра ${nextIndex + 1}`}
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
            </>
          ) : (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-sm text-[var(--muted)]">Фото не найдено.</p>
            </div>
          )}
        </div>
      </div>
    </AppModal>
  );
}
