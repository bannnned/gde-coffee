import { Paper } from "@mantine/core";
import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { Cafe } from "../../../entities/cafe/model/types";
import CafeCardFooter from "./cafe-card/CafeCardFooter";
import CafeCardHero from "./cafe-card/CafeCardHero";
import { useCafeCardPhotos } from "./cafe-card/useCafeCardPhotos";

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

  const {
    photoURLs,
    activePhotoIndex,
    activePhotoURL,
    photoReady,
    handlePhotoTouchStart,
    handlePhotoTouchEnd,
    handlePhotoLoad,
    handlePhotoError,
  } = useCafeCardPhotos(cafe);

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
    if (target.closest('button, a, input, textarea, select, [data-no-drag="true"]')) {
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
      <CafeCardHero
        cafe={cafe}
        activePhotoURL={activePhotoURL}
        photoReady={photoReady}
        photoURLs={photoURLs}
        activePhotoIndex={activePhotoIndex}
        showDistance={showDistance}
        showRoutes={showRoutes}
        onOpen2gis={onOpen2gis}
        onOpenYandex={onOpenYandex}
        onPhotoLoad={handlePhotoLoad}
        onPhotoError={handlePhotoError}
        onTouchStart={handlePhotoTouchStart}
        onTouchEnd={handlePhotoTouchEnd}
        badgeStyles={badgeStyles}
      >
        <CafeCardFooter cafe={cafe} badgeStyles={badgeStyles} />
      </CafeCardHero>
    </Paper>
  );
}
