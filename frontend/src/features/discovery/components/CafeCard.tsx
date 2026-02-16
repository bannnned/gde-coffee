import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";

import { getCafePhotos } from "../../../api/cafePhotos";
import type { Cafe } from "../../../entities/cafe/model/types";
import { AMENITY_LABELS } from "../constants";
import { formatDistance } from "../utils";

const AUTO_SLIDE_MS = 4000;

type CafeCardProps = {
  cafe: Cafe;
  onOpen2gis: (cafe: Cafe) => void;
  onOpenYandex: (cafe: Cafe) => void;
  onOpenDetails?: () => void;
  showDistance?: boolean;
  showRoutes?: boolean;
};

export default function CafeCard({
  cafe,
  onOpen2gis,
  onOpenYandex,
  onOpenDetails,
  showDistance = true,
  showRoutes = true,
}: CafeCardProps) {
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const loadedPhotoUrlsRef = useRef<Set<string>>(new Set());

  const fallbackPhotoUrls = useMemo(() => {
    const direct = (cafe.photos ?? [])
      .filter((photo) => photo.kind === "cafe")
      .map((photo) => photo.url)
      .filter(Boolean);
    const cover = cafe.cover_photo_url?.trim() || "";

    if (cover && !direct.includes(cover)) {
      return [cover, ...direct];
    }
    return cover ? (direct.length > 0 ? direct : [cover]) : direct;
  }, [cafe.cover_photo_url, cafe.photos]);

  const [photoUrls, setPhotoUrls] = useState<string[]>(fallbackPhotoUrls);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [photoReady, setPhotoReady] = useState(true);
  const activePhotoUrl = photoUrls[activePhotoIndex] ?? null;

  useEffect(() => {
    setPhotoUrls(fallbackPhotoUrls);
    setActivePhotoIndex(0);
  }, [cafe.id, fallbackPhotoUrls]);

  useEffect(() => {
    if (!cafe.id) return;
    let cancelled = false;

    getCafePhotos(cafe.id, "cafe")
      .then((list) => {
        if (cancelled) return;
        const fetched = list.map((photo) => photo.url).filter(Boolean);
        if (fetched.length === 0) return;

        const cover = cafe.cover_photo_url?.trim() || "";
        if (cover && !fetched.includes(cover)) {
          setPhotoUrls([cover, ...fetched]);
          return;
        }
        setPhotoUrls(fetched);
      })
      .catch(() => {
        // Keep fallback photos on error.
      });

    return () => {
      cancelled = true;
    };
  }, [cafe.id, cafe.cover_photo_url]);

  useEffect(() => {
    setActivePhotoIndex((prev) =>
      photoUrls.length === 0 ? 0 : Math.min(prev, photoUrls.length - 1),
    );
  }, [photoUrls.length]);

  useEffect(() => {
    if (!activePhotoUrl) {
      setPhotoReady(true);
      return;
    }
    setPhotoReady(loadedPhotoUrlsRef.current.has(activePhotoUrl));
  }, [activePhotoUrl]);

  useEffect(() => {
    if (photoUrls.length <= 1) return;
    const timer = window.setInterval(() => {
      setActivePhotoIndex((prev) => (prev + 1) % photoUrls.length);
    }, AUTO_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [photoUrls.length]);

  const cardStyles = {
    zIndex: 1,
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

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onOpenDetails) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest(
        'button, a, input, textarea, select, [data-no-drag="true"]',
      )
    ) {
      return;
    }
    clickStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onOpenDetails) return;
    const start = clickStartRef.current;
    clickStartRef.current = null;
    if (!start) return;
    const dx = Math.abs(event.clientX - start.x);
    const dy = Math.abs(event.clientY - start.y);
    if (dx <= 8 && dy <= 8) {
      onOpenDetails();
    }
  };

  const handlePointerCancel = () => {
    clickStartRef.current = null;
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!onOpenDetails) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenDetails();
    }
  };

  const stepPhoto = (direction: -1 | 1) => {
    if (photoUrls.length <= 1) return;
    setActivePhotoIndex((prev) => (prev + direction + photoUrls.length) % photoUrls.length);
  };

  const handlePhotoTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handlePhotoTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    if (startX == null || endX == null || photoUrls.length <= 1) return;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 40) return;
    if (deltaX < 0) stepPhoto(1);
    if (deltaX > 0) stepPhoto(-1);
  };

  return (
    <Paper
      withBorder
      radius={22}
      p={0}
      style={{
        ...cardStyles,
        cursor: onOpenDetails ? "pointer" : "default",
      }}
      role={onOpenDetails ? "button" : undefined}
      tabIndex={onOpenDetails ? 0 : -1}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
    >
      <Box
        onTouchStart={handlePhotoTouchStart}
        onTouchEnd={handlePhotoTouchEnd}
        style={{
          position: "relative",
          minHeight: 216,
          height: 216,
          background:
            "radial-gradient(circle at 20% 20%, var(--bg-accent-1), transparent 45%), var(--surface)",
        }}
      >
        {activePhotoUrl ? (
          <img
            src={activePhotoUrl}
            alt={`Фото: ${cafe.name}`}
            loading="lazy"
            onLoad={(event) => {
              const src = event.currentTarget.currentSrc || event.currentTarget.src;
              if (src) {
                loadedPhotoUrlsRef.current.add(src);
              }
              setPhotoReady(true);
            }}
            onError={() => setPhotoReady(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              opacity: photoReady ? 1 : 0.36,
              filter: photoReady ? "blur(0px)" : "blur(2px)",
              transition: "opacity 200ms ease, filter 220ms ease",
            }}
          />
        ) : null}

        {showDistance && (
          <Badge
            styles={badgeStyles}
            style={{
              position: "absolute",
              left: 12,
              top: 12,
              zIndex: 2,
            }}
          >
            {formatDistance(cafe.distance_m)}
          </Badge>
        )}

        {showRoutes && (
          <Stack
            gap={6}
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              zIndex: 2,
            }}
            data-no-drag="true"
          >
            <Button
              size="compact-xs"
              variant="default"
              styles={{
                root: {
                  borderRadius: 999,
                  border: "1px solid var(--glass-border)",
                  background: "var(--glass-bg)",
                  color: "var(--cafe-hero-title-color)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                },
              }}
              onClick={(event) => {
                event.stopPropagation();
                onOpen2gis(cafe);
              }}
            >
              2GIS
            </Button>
            <Button
              size="compact-xs"
              variant="default"
              styles={{
                root: {
                  borderRadius: 999,
                  border: "1px solid var(--glass-border)",
                  background: "var(--glass-bg)",
                  color: "var(--cafe-hero-title-color)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                },
              }}
              onClick={(event) => {
                event.stopPropagation();
                onOpenYandex(cafe);
              }}
            >
              Yandex
            </Button>
          </Stack>
        )}

        {photoUrls.length > 1 && (
          <Group
            gap={5}
            justify="center"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            {photoUrls.map((_, index) => (
              <Box
                key={`photo-dot-${index + 1}`}
                style={{
                  width: 22,
                  height: 3,
                  borderRadius: 999,
                  background:
                    index === activePhotoIndex
                      ? "var(--cafe-hero-indicator-active)"
                      : "var(--cafe-hero-indicator-idle)",
                  transition: "background 180ms ease",
                }}
              />
            ))}
          </Group>
        )}

        <Box
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backdropFilter: "blur(22px) saturate(145%)",
            WebkitBackdropFilter: "blur(22px) saturate(145%)",
            background:
              "linear-gradient(180deg, transparent 0%, transparent 60%, var(--cafe-hero-overlay-1) 74%, var(--cafe-hero-overlay-2) 88%, var(--cafe-hero-overlay-3) 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg, transparent 0%, transparent 60%, rgba(0,0,0,0.1) 70%, rgba(0,0,0,0.32) 80%, rgba(0,0,0,0.72) 92%, rgba(0,0,0,1) 100%)",
            maskImage:
              "linear-gradient(180deg, transparent 0%, transparent 60%, rgba(0,0,0,0.1) 70%, rgba(0,0,0,0.32) 80%, rgba(0,0,0,0.72) 92%, rgba(0,0,0,1) 100%)",
            transition: "background 260ms ease, backdrop-filter 260ms ease",
            zIndex: 1,
          }}
        />

        <Box
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "44px 14px 12px",
            zIndex: 3,
          }}
        >
          <Text
            fw={700}
            size="md"
            lineClamp={1}
            title={cafe.name}
            style={{ color: "var(--cafe-hero-title-color)" }}
          >
            {cafe.name}
          </Text>
          <Text
            size="sm"
            lineClamp={1}
            title={cafe.address}
            style={{ color: "var(--cafe-hero-subtitle-color)" }}
          >
            {cafe.address}
          </Text>
          <Group
            gap={6}
            mt={8}
            wrap="nowrap"
            style={{
              overflow: "hidden",
              WebkitMaskImage: "linear-gradient(90deg, currentColor 80%, transparent)",
              maskImage: "linear-gradient(90deg, currentColor 80%, transparent)",
            }}
          >
            {cafe.amenities.map((a) => (
              <Badge key={a} variant="light" styles={badgeStyles}>
                {AMENITY_LABELS[a] ?? a}
              </Badge>
            ))}
          </Group>
        </Box>
      </Box>
    </Paper>
  );
}
