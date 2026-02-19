import { Badge, Box, Button, Group, Stack } from "@mantine/core";
import { IconRoute2 } from "@tabler/icons-react";
import type { ReactNode } from "react";

import type { Cafe } from "../../../../entities/cafe/model/types";
import { buildCafePhotoPictureSources } from "../../../../utils/cafePhotoVariants";
import { formatDistance } from "../../utils";

type CafeCardHeroProps = {
  cafe: Cafe;
  activePhotoURL: string | null;
  photoReady: boolean;
  photoURLs: string[];
  activePhotoIndex: number;
  showDistance: boolean;
  showRoutes: boolean;
  onOpen2gis: (cafe: Cafe) => void;
  onOpenYandex: (cafe: Cafe) => void;
  onPhotoLoad: (src: string) => void;
  onPhotoError: () => void;
  onTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (event: React.TouchEvent<HTMLDivElement>) => void;
  badgeStyles: Record<string, unknown>;
  children?: ReactNode;
};

export default function CafeCardHero({
  cafe,
  activePhotoURL,
  photoReady,
  photoURLs,
  activePhotoIndex,
  showDistance,
  showRoutes,
  onOpen2gis,
  onOpenYandex,
  onPhotoLoad,
  onPhotoError,
  onTouchStart,
  onTouchEnd,
  badgeStyles,
  children,
}: CafeCardHeroProps) {
  const photoSources = buildCafePhotoPictureSources(activePhotoURL, [640, 1024, 1536]);
  const photoSizes = "(max-width: 768px) 100vw, 560px";

  return (
    <Box
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: "relative",
        minHeight: 216,
        height: 216,
        background:
          "radial-gradient(circle at 20% 20%, var(--bg-accent-1), transparent 45%), var(--surface)",
      }}
    >
      {activePhotoURL ? (
        <>
          <picture
            style={{
              position: "absolute",
              inset: 0,
              display: "block",
              zIndex: 0,
            }}
          >
            {photoSources.avifSrcSet && (
              <source type="image/avif" srcSet={photoSources.avifSrcSet} sizes={photoSizes} />
            )}
            {photoSources.webpSrcSet && (
              <source type="image/webp" srcSet={photoSources.webpSrcSet} sizes={photoSizes} />
            )}
            <img
              src={activePhotoURL}
              srcSet={photoSources.fallbackSrcSet}
              sizes={photoSizes}
              alt={`Фото: ${cafe.name}`}
              loading="lazy"
              onLoad={(event) => onPhotoLoad(event.currentTarget.currentSrc || event.currentTarget.src)}
              onError={onPhotoError}
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
          </picture>
          <picture
            style={{
              position: "absolute",
              inset: 0,
              display: "block",
              zIndex: 1,
            }}
          >
            {photoSources.avifSrcSet && (
              <source type="image/avif" srcSet={photoSources.avifSrcSet} sizes={photoSizes} />
            )}
            {photoSources.webpSrcSet && (
              <source type="image/webp" srcSet={photoSources.webpSrcSet} sizes={photoSizes} />
            )}
            <img
              src={activePhotoURL}
              srcSet={photoSources.fallbackSrcSet}
              sizes={photoSizes}
              alt=""
              loading="lazy"
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                opacity: photoReady ? 0.92 : 0,
                filter: "blur(32px) saturate(138%) brightness(0.94)",
                transform: "scale(1.16)",
                transformOrigin: "center",
                WebkitMaskImage:
                  "linear-gradient(180deg, transparent 0%, transparent 38%, rgba(0,0,0,0.16) 49%, rgba(0,0,0,0.52) 61%, rgba(0,0,0,0.92) 81%, rgba(0,0,0,1) 100%)",
                maskImage:
                  "linear-gradient(180deg, transparent 0%, transparent 38%, rgba(0,0,0,0.16) 49%, rgba(0,0,0,0.52) 61%, rgba(0,0,0,0.92) 81%, rgba(0,0,0,1) 100%)",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                pointerEvents: "none",
                transition: "opacity 240ms ease",
              }}
            />
          </picture>
        </>
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
            alignItems: "stretch",
          }}
          data-no-drag="true"
        >
          <Button
            size="compact-xs"
            variant="default"
            leftSection={<IconRoute2 size={14} />}
            styles={{
              root: {
                borderRadius: 999,
                border: "1px solid var(--glass-border)",
                background: "var(--glass-bg)",
                color: "var(--cafe-hero-title-color)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                width: 156,
                justifyContent: "flex-start",
                paddingInline: 8,
              },
              inner: {
                justifyContent: "flex-start",
                width: "100%",
              },
              label: {
                textAlign: "left",
                paddingLeft: 2,
              },
            }}
            onClick={(event) => {
              event.stopPropagation();
              onOpen2gis(cafe);
            }}
          >
            Маршрут 2ГИС
          </Button>
          <Button
            size="compact-xs"
            variant="default"
            leftSection={<IconRoute2 size={14} />}
            styles={{
              root: {
                borderRadius: 999,
                border: "1px solid var(--glass-border)",
                background: "var(--glass-bg)",
                color: "var(--cafe-hero-title-color)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                width: 156,
                justifyContent: "flex-start",
                paddingInline: 8,
              },
              inner: {
                justifyContent: "flex-start",
                width: "100%",
              },
              label: {
                textAlign: "left",
                paddingLeft: 2,
              },
            }}
            onClick={(event) => {
              event.stopPropagation();
              onOpenYandex(cafe);
            }}
          >
            Маршрут Яндекс
          </Button>
        </Stack>
      )}

      {photoURLs.length > 1 && (
        <Group
          gap={5}
          justify="center"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 6,
            pointerEvents: "none",
            zIndex: 4,
          }}
        >
          {photoURLs.map((_, index) => (
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
          background:
            "linear-gradient(180deg, transparent 0%, transparent 60%, var(--cafe-hero-overlay-1) 56%, var(--cafe-hero-overlay-2) 76%, var(--cafe-hero-overlay-3) 100%)",
          transition: "background 260ms ease",
          zIndex: 1,
        }}
      />
      <Box
        style={{
          position: "absolute",
          left: -16,
          right: -16,
          bottom: "calc(44px + 40%)",
          height: 64,
          pointerEvents: "none",
          background:
            "radial-gradient(90% 110% at 50% 100%, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.17) 42%, rgba(255,255,255,0.08) 68%, rgba(255,255,255,0) 100%)",
          filter: "blur(26.6px)",
          opacity: 0.72,
          transition: "opacity 220ms ease",
          zIndex: 2,
        }}
      />
      {children}
    </Box>
  );
}
