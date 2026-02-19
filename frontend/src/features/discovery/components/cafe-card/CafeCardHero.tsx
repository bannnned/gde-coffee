import { Badge, Box, Button, Group, Stack } from "@mantine/core";
import { IconRoute2 } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
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
  activePhotoDirection: -1 | 1;
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
  activePhotoDirection,
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
  const HERO_HEIGHT_PX = 172;
  const photoSources = buildCafePhotoPictureSources(activePhotoURL, [640, 1024, 1536]);
  const photoSizes = "(max-width: 768px) 100vw, 560px";
  const INDICATOR_SEGMENT_WIDTH = 18;
  const INDICATOR_SEGMENT_HEIGHT = 4;
  const INDICATOR_SEGMENT_GAP = 6;
  const INDICATOR_INNER_HORIZONTAL_PADDING = 8;
  const indicatorOffset =
    activePhotoIndex * (INDICATOR_SEGMENT_WIDTH + INDICATOR_SEGMENT_GAP);

  return (
    <Box
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: "relative",
        minHeight: HERO_HEIGHT_PX,
        height: HERO_HEIGHT_PX,
        touchAction: "pan-y",
        background:
          "radial-gradient(circle at 20% 20%, var(--bg-accent-1), transparent 45%), var(--surface)",
      }}
    >
      {activePhotoURL ? (
        <>
          <AnimatePresence initial={false} custom={activePhotoDirection}>
            <motion.picture
              key={activePhotoURL}
              custom={activePhotoDirection}
              initial={{ opacity: 0, x: activePhotoDirection > 0 ? 34 : -34 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: activePhotoDirection > 0 ? -34 : 34 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
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
            </motion.picture>
          </AnimatePresence>
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
                width: 90,
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
            2ГИС
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
                width: 90,
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
            Яндекс
          </Button>
        </Stack>
      )}

      {photoURLs.length > 1 && (
        <Box
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            top: 10,
            padding: `6px ${INDICATOR_INNER_HORIZONTAL_PADDING}px`,
            borderRadius: 999,
            background: "color-mix(in srgb, var(--cafe-hero-overlay-3) 28%, transparent)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            pointerEvents: "none",
            zIndex: 4,
          }}
        >
          <Group gap={INDICATOR_SEGMENT_GAP} wrap="nowrap">
            {photoURLs.map((_, index) => (
              <Box
                key={`photo-dot-${index + 1}`}
                style={{
                  width: INDICATOR_SEGMENT_WIDTH,
                  height: INDICATOR_SEGMENT_HEIGHT,
                  borderRadius: 999,
                  background:
                    index === activePhotoIndex
                      ? "transparent"
                      : "var(--cafe-hero-indicator-idle)",
                  transition: "background 180ms ease",
                }}
              />
            ))}
          </Group>
          <Box
            component={motion.div}
            animate={{ x: indicatorOffset }}
            transition={{
              type: "spring",
              stiffness: 460,
              damping: 32,
              mass: 0.45,
            }}
            style={{
              position: "absolute",
              left: INDICATOR_INNER_HORIZONTAL_PADDING,
              top: 6,
              width: INDICATOR_SEGMENT_WIDTH,
              height: INDICATOR_SEGMENT_HEIGHT,
              borderRadius: 999,
              background: "var(--cafe-hero-indicator-active)",
              boxShadow: "0 0 10px color-mix(in srgb, var(--cafe-hero-indicator-active) 55%, transparent)",
            }}
          />
        </Box>
      )}

      {photoURLs.length > 1 && (
        <Box
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 56,
            zIndex: 2,
            pointerEvents: "none",
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--cafe-hero-overlay-3) 34%, transparent) 0%, transparent 100%)",
          }}
        />
      )}

      <Box
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, transparent 0%, transparent 50%, var(--cafe-hero-overlay-1) 50%, var(--cafe-hero-overlay-2) 70%, var(--cafe-hero-overlay-3) 100%)",
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
