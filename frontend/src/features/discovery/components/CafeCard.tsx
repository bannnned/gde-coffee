import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type { Cafe } from "../../../entities/cafe/model/types";
import CafeCardFooter from "./cafe-card/CafeCardFooter";
import CafeCardHero from "./cafe-card/CafeCardHero";
import { useCafeCardPhotos } from "./cafe-card/useCafeCardPhotos";

type CafeCardProps = {
  cafe: Cafe;
  ratingRefreshToken?: number;
  onOpen2gis: (cafe: Cafe) => void;
  onOpenYandex: (cafe: Cafe) => void;
  onAddFirstPhoto?: () => void;
  onOpenDetails?: () => void;
  isPhotoProcessing?: boolean;
  showDistance?: boolean;
  showRoutes?: boolean;
};

export default function CafeCard({
  cafe,
  ratingRefreshToken = 0,
  onOpen2gis,
  onOpenYandex,
  onAddFirstPhoto,
  onOpenDetails,
  isPhotoProcessing = false,
  showDistance = true,
  showRoutes = true,
}: CafeCardProps) {
  const {
    photoURLs,
    activePhotoIndex,
    activePhotoDirection,
    activePhotoURL,
    photoReady,
    handlePhotoTouchStart,
    handlePhotoTouchEnd,
    handlePhotoLoad,
    handlePhotoError,
    shouldSuppressCardClick,
  } = useCafeCardPhotos(cafe);

  const cardStyles = {
    position: "relative",
    zIndex: 2,
    background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
    border: "1px solid var(--glass-border)",
    boxShadow:
      "0 16px 32px color-mix(in srgb, var(--color-surface-overlay-strong) 34%, transparent), var(--shadow)",
    backdropFilter: "blur(18px) saturate(160%)",
    WebkitBackdropFilter: "blur(18px) saturate(160%)",
    overflow: "hidden",
  } as const;

  const handleCardClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onOpenDetails) return;
    if (shouldSuppressCardClick()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('button, a, input, textarea, select, [data-no-drag="true"]')) {
      return;
    }
    onOpenDetails();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!onOpenDetails) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenDetails();
    }
  };

  return (
    <div
      style={{
        ...cardStyles,
        cursor: onOpenDetails ? "pointer" : "default",
        borderRadius: 22,
      }}
      role={onOpenDetails ? "button" : undefined}
      tabIndex={onOpenDetails ? 0 : -1}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      <CafeCardHero
        cafe={cafe}
        activePhotoURL={activePhotoURL}
        photoReady={photoReady}
        photoURLs={photoURLs}
        activePhotoIndex={activePhotoIndex}
        activePhotoDirection={activePhotoDirection}
        showDistance={showDistance}
        showRoutes={showRoutes}
        onOpen2gis={onOpen2gis}
        onOpenYandex={onOpenYandex}
        onAddFirstPhoto={onAddFirstPhoto}
        isPhotoProcessing={isPhotoProcessing}
        onPhotoLoad={handlePhotoLoad}
        onPhotoError={handlePhotoError}
        onTouchStart={handlePhotoTouchStart}
        onTouchEnd={handlePhotoTouchEnd}
      >
        <CafeCardFooter cafe={cafe} ratingRefreshToken={ratingRefreshToken} />
      </CafeCardHero>
    </div>
  );
}
