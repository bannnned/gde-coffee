import { IconCameraPlus, IconRoute2 } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

import { Button } from "../../../../components/ui";
import type { Cafe } from "../../../../entities/cafe/model/types";
import { buildCafePhotoPictureSources } from "../../../../utils/cafePhotoVariants";
import { formatDistance } from "../../utils";
import classes from "./CafeCardHero.module.css";

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
  onAddFirstPhoto?: () => void;
  isPhotoProcessing?: boolean;
  onTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (event: React.TouchEvent<HTMLDivElement>) => void;
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
  onAddFirstPhoto,
  isPhotoProcessing = false,
  onTouchStart,
  onTouchEnd,
  children,
}: CafeCardHeroProps) {
  const HERO_HEIGHT = "clamp(132px, 28vh, 172px)";
  const EMPTY_STATE_RESERVED_BOTTOM_PX = 86;
  const photoSources = buildCafePhotoPictureSources(activePhotoURL, [640, 1024, 1536]);
  const photoSizes = "(max-width: 768px) 100vw, 560px";
  const INDICATOR_SEGMENT_WIDTH = 18;
  const INDICATOR_SEGMENT_HEIGHT = 4;
  const INDICATOR_SEGMENT_GAP = 6;
  const INDICATOR_INNER_HORIZONTAL_PADDING = 8;
  const indicatorOffset =
    activePhotoIndex * (INDICATOR_SEGMENT_WIDTH + INDICATOR_SEGMENT_GAP);

  return (
    <div
      className={classes.root}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        ["--hero-height" as string]: HERO_HEIGHT,
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
                width: "100%",
                maxWidth: "100%",
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
                  maxWidth: "100%",
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
              width: "100%",
              maxWidth: "100%",
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
                maxWidth: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                opacity: photoReady ? 0.58 : 0,
                filter: "blur(18px) saturate(122%) brightness(0.92)",
                transform: "scale(1.11)",
                transformOrigin: "center",
                WebkitMaskImage:
                  "linear-gradient(180deg, transparent 0%, transparent 56%, rgba(0,0,0,0.12) 66%, rgba(0,0,0,0.44) 76%, rgba(0,0,0,0.78) 88%, rgba(0,0,0,1) 100%)",
                maskImage:
                  "linear-gradient(180deg, transparent 0%, transparent 56%, rgba(0,0,0,0.12) 66%, rgba(0,0,0,0.44) 76%, rgba(0,0,0,0.78) 88%, rgba(0,0,0,1) 100%)",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                pointerEvents: "none",
                transition: "opacity 240ms ease",
              }}
            />
          </picture>
        </>
      ) : (
        <div
          className={classes.emptyState}
          style={{ ["--empty-reserved-bottom" as string]: `${EMPTY_STATE_RESERVED_BOTTOM_PX}px` }}
          data-no-drag="true"
        >
          {onAddFirstPhoto && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isPhotoProcessing}
              aria-busy={isPhotoProcessing ? "true" : undefined}
              className={classes.addPhotoButton}
              onClick={(event) => {
                event.stopPropagation();
                onAddFirstPhoto();
              }}
            >
              <IconCameraPlus
                size={16}
                className={isPhotoProcessing ? classes.loadingIconHidden : ""}
              />
              <span className={isPhotoProcessing ? classes.loadingLabelHidden : ""}>
                Добавить первое фото
              </span>
              {isPhotoProcessing ? (
                <span className={classes.spinner} aria-hidden="true" />
              ) : null}
            </Button>
          )}
        </div>
      )}

      {showDistance && (
        <span className={classes.distanceBadge}>
          {formatDistance(cafe.distance_m)}
        </span>
      )}

      {showRoutes && (
        <div className={classes.routes} data-no-drag="true">
          <button
            type="button"
            className={`${classes.routeButton} ui-focus-ring`}
            onClick={(event) => {
              event.stopPropagation();
              onOpen2gis(cafe);
            }}
          >
            <IconRoute2 size={14} />
            2ГИС
          </button>
          <button
            type="button"
            className={`${classes.routeButton} ui-focus-ring`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenYandex(cafe);
            }}
          >
            <IconRoute2 size={14} />
            Яндекс
          </button>
        </div>
      )}

      {photoURLs.length > 1 && (
        <div
          className={classes.indicatorWrap}
          style={{
            ["--indicator-segment-width" as string]: `${INDICATOR_SEGMENT_WIDTH}px`,
            ["--indicator-segment-height" as string]: `${INDICATOR_SEGMENT_HEIGHT}px`,
            ["--indicator-segment-gap" as string]: `${INDICATOR_SEGMENT_GAP}px`,
            ["--indicator-inner-padding" as string]: `${INDICATOR_INNER_HORIZONTAL_PADDING}px`,
          }}
        >
          <div className={classes.indicatorTrack}>
            {photoURLs.map((_, index) => (
              <div
                key={`photo-dot-${index + 1}`}
                className={classes.indicatorSegment}
                data-active={index === activePhotoIndex ? "true" : "false"}
              />
            ))}
          </div>
          <motion.div
            className={classes.indicatorActive}
            animate={{ x: indicatorOffset }}
            transition={{
              type: "spring",
              stiffness: 460,
              damping: 32,
              mass: 0.45,
            }}
            style={{ left: INDICATOR_INNER_HORIZONTAL_PADDING }}
          />
        </div>
      )}

      {photoURLs.length > 1 && (
        <div className={classes.topFade} />
      )}

      <div className={classes.bottomOverlay} />
      {children}
    </div>
  );
}
