import { useEffect, useMemo, useRef, useState, type TouchEventHandler } from "react";
import { ActionIcon, Box, Group, Modal, Paper, Stack, Text } from "@mantine/core";
import {
  IconArrowsLeftRight,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";

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
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      withCloseButton={false}
      size="xl"
      styles={{
        content: {
          background: "transparent",
          boxShadow: "none",
          border: "none",
          width: "min(96vw, 1080px)",
          maxWidth: "1080px",
        },
        body: {
          padding: 0,
        },
        overlay: {
          backdropFilter: "blur(10px)",
          backgroundColor: "color-mix(in srgb, var(--color-surface-overlay-strong) 72%, #050607)",
        },
      }}
    >
      <Paper
        withBorder
        radius={26}
        p={12}
        style={{
          border: "1px solid color-mix(in srgb, var(--glass-border) 84%, transparent)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--glass-grad-1) 94%, transparent), color-mix(in srgb, var(--glass-grad-2) 92%, transparent))",
          boxShadow: "0 28px 80px color-mix(in srgb, #000 44%, transparent)",
          backdropFilter: "blur(22px) saturate(135%)",
          WebkitBackdropFilter: "blur(22px) saturate(135%)",
        }}
      >
        <Stack gap={10}>
          <Group justify="space-between" align="center" wrap="nowrap" px={4}>
            <Text fw={700} size="sm" lineClamp={1}>
              {title}
            </Text>
            <Group gap={6} wrap="nowrap">
              {photos.length > 0 && (
                <Text size="xs" c="dimmed">
                  {safeIndex + 1} / {photos.length}
                </Text>
              )}
              <ActionIcon
                variant="default"
                radius="xl"
                onClick={onClose}
                aria-label="Закрыть просмотр фото"
                style={{
                  border: "1px solid var(--glass-border)",
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--surface) 90%, transparent), color-mix(in srgb, var(--surface) 76%, transparent))",
                }}
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          </Group>

          {activePhoto ? (
            <>
              <Box
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

                <Group
                  justify="space-between"
                  style={{
                    position: "absolute",
                    insetInline: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                  }}
                >
                  <ActionIcon
                    variant="default"
                    radius="xl"
                    size="lg"
                    disabled={photos.length <= 1}
                    onClick={() => stepPhoto(-1)}
                    aria-label="Предыдущее фото"
                    style={{
                      pointerEvents: "auto",
                      border: "1px solid color-mix(in srgb, var(--glass-border) 84%, transparent)",
                      background:
                        "linear-gradient(135deg, color-mix(in srgb, var(--surface) 88%, transparent), color-mix(in srgb, var(--surface) 72%, transparent))",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                    }}
                  >
                    <IconChevronLeft size={18} />
                  </ActionIcon>
                  <ActionIcon
                    variant="default"
                    radius="xl"
                    size="lg"
                    disabled={photos.length <= 1}
                    onClick={() => stepPhoto(1)}
                    aria-label="Следующее фото"
                    style={{
                      pointerEvents: "auto",
                      border: "1px solid color-mix(in srgb, var(--glass-border) 84%, transparent)",
                      background:
                        "linear-gradient(135deg, color-mix(in srgb, var(--surface) 88%, transparent), color-mix(in srgb, var(--surface) 72%, transparent))",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                    }}
                  >
                    <IconChevronRight size={18} />
                  </ActionIcon>
                </Group>
              </Box>

              {photos.length > 1 && (
                <Group justify="center" gap={6}>
                  <IconArrowsLeftRight size={14} style={{ opacity: 0.6 }} />
                  <Text size="xs" c="dimmed">
                    Свайп влево/вправо или кнопки для листания
                  </Text>
                </Group>
              )}

              {photos.length > 1 && (
                <Group
                  className="horizontal-scroll-modern"
                  wrap="nowrap"
                  gap={8}
                  style={{
                    overflowX: "auto",
                    paddingBottom: 2,
                  }}
                >
                  {photos.map((photo, nextIndex) => (
                    <Paper
                      key={photo.id}
                      withBorder
                      radius="md"
                      onClick={() => onIndexChange(nextIndex)}
                      style={{
                        width: 92,
                        minWidth: 92,
                        height: 68,
                        overflow: "hidden",
                        border:
                          nextIndex === safeIndex
                            ? "1px solid var(--color-brand-accent)"
                            : "1px solid var(--border)",
                        background: "var(--surface)",
                        cursor: "pointer",
                        transform: nextIndex === safeIndex ? "translateY(-1px)" : "none",
                        transition: "border-color 160ms ease, transform 160ms ease",
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
                    </Paper>
                  ))}
                </Group>
              )}
            </>
          ) : (
            <Paper withBorder radius="lg" p="md">
              <Text c="dimmed">Фото не найдено.</Text>
            </Paper>
          )}
        </Stack>
      </Paper>
    </Modal>
  );
}
