import { useCallback, useEffect, useMemo, useRef, useState, type TouchEventHandler } from "react";
import {
  IconArrowsLeftRight,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";

import { AppModal, Button } from "./ui";
import { cn } from "../lib/utils";
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

type Point = {
  x: number;
  y: number;
};

type Size = {
  width: number;
  height: number;
};

type PinchState = {
  startDistance: number;
  startZoom: number;
  contentPoint: Point;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function detectDirection(prev: number, next: number, length: number): -1 | 1 {
  if (length <= 1 || prev === next) return 1;
  if (prev === 0 && next === length - 1) return -1;
  if (prev === length - 1 && next === 0) return 1;
  return next > prev ? 1 : -1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readTouchDistance(touches: TouchList): number | null {
  if (touches.length < 2) return null;
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return null;
  const dx = second.clientX - first.clientX;
  const dy = second.clientY - first.clientY;
  return Math.hypot(dx, dy);
}

function readTouchCenter(touches: TouchList, rect: DOMRect): Point | null {
  if (touches.length < 2) return null;
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return null;
  return {
    x: (first.clientX + second.clientX) / 2 - rect.left,
    y: (first.clientY + second.clientY) / 2 - rect.top,
  };
}

function clampOffset(offset: Point, zoom: number, bounds: Size): Point {
  if (zoom <= 1 || bounds.width <= 0 || bounds.height <= 0) {
    return { x: 0, y: 0 };
  }
  const maxX = (bounds.width * (zoom - 1)) / 2;
  const maxY = (bounds.height * (zoom - 1)) / 2;
  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
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
  const pinchStateRef = useRef<PinchState | null>(null);
  const panStateRef = useRef<{ start: Point; offset: Point } | null>(null);
  const zoomRef = useRef<number>(MIN_ZOOM);
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const loadedUrlsRef = useRef<Set<string>>(new Set());
  const prevIndexRef = useRef(index);
  const [imageReady, setImageReady] = useState(true);
  const [direction, setDirection] = useState<-1 | 1>(1);
  const [zoom, setZoom] = useState<number>(MIN_ZOOM);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const safeIndex = useMemo(() => {
    if (photos.length === 0) return 0;
    return Math.max(0, Math.min(index, photos.length - 1));
  }, [index, photos.length]);

  const activePhoto = photos[safeIndex] ?? null;
  const mainSources = buildCafePhotoPictureSources(activePhoto?.url, [640, 1024, 1536]);

  const updateTransform = useCallback((nextZoom: number, nextOffset: Point) => {
    const viewport = viewportRef.current;
    const bounds: Size = viewport
      ? { width: viewport.clientWidth, height: viewport.clientHeight }
      : { width: 0, height: 0 };
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const clampedOffset = clampOffset(nextOffset, clampedZoom, bounds);
    zoomRef.current = clampedZoom;
    offsetRef.current = clampedOffset;
    setZoom(clampedZoom);
    setOffset(clampedOffset);
  }, []);

  const resetTransform = useCallback(() => {
    touchStartXRef.current = null;
    pinchStateRef.current = null;
    panStateRef.current = null;
    updateTransform(MIN_ZOOM, { x: 0, y: 0 });
  }, [updateTransform]);

  useEffect(() => {
    if (!opened) return;
    const previous = prevIndexRef.current;
    setDirection(detectDirection(previous, safeIndex, photos.length));
    prevIndexRef.current = safeIndex;
  }, [opened, photos.length, safeIndex]);

  useEffect(() => {
    if (!opened) return;
    const frameID = window.requestAnimationFrame(() => {
      resetTransform();
    });
    return () => {
      window.cancelAnimationFrame(frameID);
    };
  }, [activePhoto?.id, activePhoto?.url, opened, resetTransform]);

  useEffect(() => {
    const nextURL = activePhoto?.url?.trim();
    const frameID = window.requestAnimationFrame(() => {
      if (!nextURL) {
        setImageReady(true);
        return;
      }
      setImageReady(loadedUrlsRef.current.has(nextURL));
    });
    return () => {
      window.cancelAnimationFrame(frameID);
    };
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

  useEffect(() => {
    if (!opened) return;
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      updateTransform(zoomRef.current, offsetRef.current);
    });
    observer.observe(viewport);
    return () => {
      observer.disconnect();
    };
  }, [opened, updateTransform]);

  const stepPhoto = (step: -1 | 1) => {
    if (photos.length <= 1) return;
    resetTransform();
    onIndexChange((safeIndex + step + photos.length) % photos.length);
  };

  const handleTouchStart: TouchEventHandler<HTMLDivElement> = (event) => {
    const touches = event.touches;
    const viewport = viewportRef.current;
    if (!viewport) return;

    if (touches.length >= 2) {
      const rect = viewport.getBoundingClientRect();
      const distance = readTouchDistance(touches);
      const center = readTouchCenter(touches, rect);
      if (distance == null || !center) return;
      const currentZoom = zoomRef.current;
      const currentOffset = offsetRef.current;
      pinchStateRef.current = {
        startDistance: distance,
        startZoom: currentZoom,
        contentPoint: {
          x: (center.x - rect.width / 2 - currentOffset.x) / currentZoom,
          y: (center.y - rect.height / 2 - currentOffset.y) / currentZoom,
        },
      };
      panStateRef.current = null;
      touchStartXRef.current = null;
      return;
    }

    const touch = touches[0];
    if (!touch) return;

    if (zoomRef.current > MIN_ZOOM + 0.01) {
      panStateRef.current = {
        start: { x: touch.clientX, y: touch.clientY },
        offset: { ...offsetRef.current },
      };
      touchStartXRef.current = null;
      pinchStateRef.current = null;
      return;
    }

    touchStartXRef.current = touch.clientX;
    panStateRef.current = null;
    pinchStateRef.current = null;
  };

  const handleTouchMove: TouchEventHandler<HTMLDivElement> = (event) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();

    if (event.touches.length >= 2) {
      const pinchState = pinchStateRef.current;
      const distance = readTouchDistance(event.touches);
      const center = readTouchCenter(event.touches, rect);
      if (!pinchState || distance == null || !center) return;
      event.preventDefault();

      const nextZoom = clamp(
        (distance / pinchState.startDistance) * pinchState.startZoom,
        MIN_ZOOM,
        MAX_ZOOM,
      );
      const nextOffset = {
        x: center.x - rect.width / 2 - pinchState.contentPoint.x * nextZoom,
        y: center.y - rect.height / 2 - pinchState.contentPoint.y * nextZoom,
      };
      updateTransform(nextZoom, nextOffset);
      return;
    }

    if (event.touches.length !== 1) return;
    if (zoomRef.current <= MIN_ZOOM + 0.01) return;
    const panState = panStateRef.current;
    const touch = event.touches[0];
    if (!panState || !touch) return;
    event.preventDefault();

    const nextOffset = {
      x: panState.offset.x + touch.clientX - panState.start.x,
      y: panState.offset.y + touch.clientY - panState.start.y,
    };
    updateTransform(zoomRef.current, nextOffset);
  };

  const handleTouchEnd: TouchEventHandler<HTMLDivElement> = (event) => {
    if (event.touches.length === 1 && zoomRef.current > MIN_ZOOM + 0.01) {
      const touch = event.touches[0];
      if (touch) {
        panStateRef.current = {
          start: { x: touch.clientX, y: touch.clientY },
          offset: { ...offsetRef.current },
        };
      }
      pinchStateRef.current = null;
      touchStartXRef.current = null;
      return;
    }

    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    pinchStateRef.current = null;
    panStateRef.current = null;

    if (zoomRef.current <= MIN_ZOOM + 0.01) {
      updateTransform(MIN_ZOOM, { x: 0, y: 0 });
    }
    if (zoomRef.current > MIN_ZOOM + 0.01) return;

    if (startX == null || endX == null || photos.length <= 1) return;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 45) return;
    if (deltaX < 0) stepPhoto(1);
    if (deltaX > 0) stepPhoto(-1);
  };

  const handleDoubleClick = () => {
    if (zoomRef.current > MIN_ZOOM + 0.01) {
      resetTransform();
      return;
    }
    updateTransform(2, { x: 0, y: 0 });
  };

  return (
    <AppModal
      open={opened}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      presentation="dialog"
      closeButton={false}
      contentClassName="!left-0 !top-0 !h-[100dvh] !w-[100vw] !translate-x-0 !translate-y-0 border-0 bg-transparent p-0 shadow-none"
      bodyClassName="h-full p-0"
    >
      <div
        style={{
          height: "100%",
          paddingTop: "max(8px, var(--safe-top))",
          paddingBottom: "max(8px, var(--safe-bottom))",
          paddingInline: "max(8px, var(--page-edge-padding))",
          border: "1px solid color-mix(in srgb, var(--glass-border) 84%, transparent)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--glass-grad-1) 94%, transparent), color-mix(in srgb, var(--glass-grad-2) 92%, transparent))",
          boxShadow: "0 28px 80px color-mix(in srgb, #000 44%, transparent)",
          backdropFilter: "blur(22px) saturate(135%)",
          WebkitBackdropFilter: "blur(22px) saturate(135%)",
          borderRadius: 0,
        }}
      >
        <div className="flex h-full min-h-0 flex-col gap-2.5">
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
              {zoom > MIN_ZOOM + 0.01 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={resetTransform}
                  aria-label="Сбросить масштаб"
                  className="h-8 rounded-full border-glass-border bg-glass px-3 text-xs font-semibold text-text shadow-glass"
                >
                  100%
                </Button>
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
                ref={viewportRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onDoubleClick={handleDoubleClick}
                style={{
                  position: "relative",
                  borderRadius: 20,
                  overflow: "hidden",
                  background:
                    "radial-gradient(circle at 30% 16%, color-mix(in srgb, var(--bg-accent-1) 35%, transparent), transparent 58%), var(--surface)",
                  border: "1px solid color-mix(in srgb, var(--glass-border) 80%, transparent)",
                  flex: "1 1 auto",
                  minHeight: 0,
                  touchAction: "none",
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
                      height: "100%",
                      display: "block",
                      transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
                      transformOrigin: "center center",
                      willChange: "transform",
                      cursor: zoom > MIN_ZOOM + 0.01 ? "grab" : "default",
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
                        height: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                        display: "block",
                        opacity: imageReady ? 1 : 0.3,
                        filter: imageReady ? "blur(0px)" : "blur(3px)",
                        transition: "opacity 240ms ease, filter 260ms ease",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        WebkitTouchCallout: "none",
                        pointerEvents: "none",
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
                    disabled={photos.length <= 1 || zoom > MIN_ZOOM + 0.01}
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
                    disabled={photos.length <= 1 || zoom > MIN_ZOOM + 0.01}
                    onClick={() => stepPhoto(1)}
                    aria-label="Следующее фото"
                    className="pointer-events-auto h-10 w-10 rounded-full border-glass-border bg-glass text-text shadow-glass backdrop-blur-[8px]"
                  >
                    <IconChevronRight size={18} />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-1.5">
                <IconArrowsLeftRight size={14} style={{ opacity: 0.6 }} />
                <p className="text-xs text-[var(--muted)]">
                  Щипок двумя пальцами для увеличения, двойной тап для быстрого зума.
                  {photos.length > 1 ? " Свайп влево/вправо для листания." : ""}
                </p>
              </div>

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
