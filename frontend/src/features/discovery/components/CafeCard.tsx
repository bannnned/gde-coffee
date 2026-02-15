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
import { AMENITY_LABELS, DISCOVERY_UI_TEXT } from "../constants";
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
    setPhotoReady(false);
    const timer = window.setTimeout(() => setPhotoReady(true), 220);
    return () => window.clearTimeout(timer);
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
      radius="lg"
      p="sm"
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
      {activePhotoUrl && (
        <Box
          mb="sm"
          onTouchStart={handlePhotoTouchStart}
          onTouchEnd={handlePhotoTouchEnd}
          style={{
            position: "relative",
            height: 126,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <img
            src={activePhotoUrl}
            alt={`Фото: ${cafe.name}`}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              opacity: photoReady ? 1 : 0.36,
              filter: photoReady ? "blur(0px)" : "blur(2px)",
              transition: "opacity 200ms ease, filter 220ms ease",
            }}
          />
          {photoUrls.length > 1 && (
            <Group
              gap={4}
              justify="center"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 8,
                pointerEvents: "none",
              }}
            >
              {photoUrls.map((_, index) => (
                <Box
                  key={`photo-dot-${index + 1}`}
                  style={{
                    width: 16,
                    height: 3,
                    borderRadius: 999,
                    background:
                      index === activePhotoIndex
                        ? "rgba(255, 255, 255, 0.94)"
                        : "rgba(255, 255, 255, 0.42)",
                    boxShadow:
                      index === activePhotoIndex
                        ? "0 0 0 1px rgba(0, 0, 0, 0.18)"
                        : "none",
                    transition: "background 180ms ease, box-shadow 180ms ease",
                  }}
                />
              ))}
            </Group>
          )}
        </Box>
      )}
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text fw={700} c="text" size="md" lineClamp={1} title={cafe.name}>
            {cafe.name}
          </Text>
          <Text c="dimmed" size="sm" lineClamp={1} title={cafe.address}>
            {cafe.address}
          </Text>
          {showDistance && (
            <Text size="sm" mt={6}>
              {formatDistance(cafe.distance_m)}
            </Text>
          )}
          <Group
            gap={6}
            mt={8}
            wrap="nowrap"
            style={{
              overflow: "hidden",
              WebkitMaskImage: "linear-gradient(90deg, currentColor 85%, transparent)",
              maskImage: "linear-gradient(90deg, currentColor 85%, transparent)",
            }}
          >
            {cafe.amenities.map((a) => (
              <Badge key={a} variant="light" styles={badgeStyles}>
                {AMENITY_LABELS[a] ?? a}
              </Badge>
            ))}
          </Group>
        </Box>

        {showRoutes && (
          <Stack gap={6} miw={160} style={{ flexShrink: 0 }}>
            <Button
              size="xs"
              onClick={(event) => {
                event.stopPropagation();
                onOpen2gis(cafe);
              }}
            >
              {DISCOVERY_UI_TEXT.route2gis}
            </Button>
            <Button
              size="xs"
              variant="light"
              onClick={(event) => {
                event.stopPropagation();
                onOpenYandex(cafe);
              }}
            >
              {DISCOVERY_UI_TEXT.routeYandex}
            </Button>
          </Stack>
        )}
      </Group>
    </Paper>
  );
}
