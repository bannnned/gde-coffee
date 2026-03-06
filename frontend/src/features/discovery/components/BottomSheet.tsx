import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
} from "framer-motion";
import type {
  PropsWithChildren,
  ReactNode,
  RefObject,
} from "react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import classes from "./BottomSheet.module.css";
import { appHaptics, type AppHapticPreset } from "../../../lib/haptics";
import { useLayoutMetrics } from "../layout/LayoutMetricsContext";

type BottomSheetProps = PropsWithChildren<{
  sheetRef: RefObject<HTMLDivElement | null>;
  isError: boolean;
  errorText: string;
  header?: ReactNode;
  isListEmpty?: boolean;
  autoExpandTrigger?: number;
  lockedState?: SheetState | null;
  disableMidState?: boolean;
  hideHeaderContentInPeek?: boolean;
}>;

type SheetState = "peek" | "mid" | "expanded";
type DetentPoint = { state: SheetState; height: number };
type SnapCause = "gesture" | "programmatic";
type VelocitySample = { y: number; t: number };

const PEEK_HEIGHT_PX = 24;
const SHEET_PADDING_PX = 6;
const MID_HEADER_EXTRA_PX = 4;
const FLING_COMMIT_VELOCITY = 620;
const FLING_FAST_VELOCITY = 1200;
const FLING_PROJECTION_FACTOR = 0.32;
const VELOCITY_WINDOW_MS = 140;
const DETENT_SELECTION_HAPTIC_COOLDOWN_MS = 110;
const SNAP_HAPTIC_DELAY_MS = 48;
const SNAP_STIFFNESS = 280;
const SNAP_DAMPING = 24;
const SNAP_MASS = 0.86;
const MAX_LAUNCH_VELOCITY = 3200;

const MotionSheet = motion.div;

function resolveSnapHapticPreset(state: SheetState): AppHapticPreset {
  if (state === "expanded") return "medium";
  if (state === "peek") return "rigid";
  return "light";
}

export default function BottomSheet({
  sheetRef,
  isError,
  errorText,
  header,
  isListEmpty,
  autoExpandTrigger = 0,
  lockedState = null,
  disableMidState = false,
  hideHeaderContentInPeek = false,
  children,
}: BottomSheetProps) {
  const {
    filtersBarHeight,
    safeViewportHeight,
    setSheetHeight,
    setSheetHeightLive,
    setSheetState: setLayoutSheetState,
  } = useLayoutMetrics();
  const [sheetState, setSheetState] = useState<SheetState>("mid");
  const [isDragging, setIsDragging] = useState(false);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const lastAutoExpandTriggerRef = useRef(autoExpandTrigger);
  const [headerHeight, setHeaderHeight] = useState(PEEK_HEIGHT_PX);
  const animationControlsRef = useRef<ReturnType<typeof animate> | null>(null);
  const launchVelocityRef = useRef(0);
  const pendingSnapHapticRef = useRef(false);
  const snapHapticTimeoutRef = useRef<number | null>(null);
  const lastSelectionHapticAtRef = useRef(0);
  const currentDetentRef = useRef<SheetState>("mid");
  const snapCauseRef = useRef<SnapCause>("programmatic");
  const velocitySamplesRef = useRef<VelocitySample[]>([]);

  useLayoutEffect(() => {
    const node = headerRef.current;
    if (!node) return undefined;

    const update = () => {
      const next = Math.max(PEEK_HEIGHT_PX, node.getBoundingClientRect().height);
      setHeaderHeight(next);
    };

    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    return () => {
      if (snapHapticTimeoutRef.current != null) {
        window.clearTimeout(snapHapticTimeoutRef.current);
      }
    };
  }, []);

  const normalizedSheetState =
    disableMidState && sheetState === "mid" ? "expanded" : sheetState;
  const effectiveSheetState = lockedState ?? normalizedSheetState;
  const hideHeaderContent = hideHeaderContentInPeek && effectiveSheetState === "peek";

  const heights = useMemo(() => {
    const chromeReserve = 24;
    const safeViewport = Math.max(0, safeViewportHeight - chromeReserve);
    const topReserved =
      filtersBarHeight > 0 ? Math.max(0, filtersBarHeight + 12) : 0;
    const available = Math.max(0, safeViewport - topReserved);
    const maxPeek = Math.round(safeViewport * 0.9);
    const peekHeaderHeight = hideHeaderContentInPeek ? PEEK_HEIGHT_PX : headerHeight;
    const peek = Math.min(
      maxPeek,
      Math.round(peekHeaderHeight + SHEET_PADDING_PX * 2),
    );
    const expanded = Math.max(peek, Math.round(available));
    const midTarget = hideHeaderContentInPeek
      ? Math.round(headerHeight + SHEET_PADDING_PX * 2 + MID_HEADER_EXTRA_PX)
      : Math.max(peek + 120, Math.round(available * 0.33));
    const mid = disableMidState
      ? expanded
      : Math.min(expanded, midTarget);
    return { mid, expanded, peek };
  }, [disableMidState, filtersBarHeight, headerHeight, hideHeaderContentInPeek, safeViewportHeight]);

  const detents = useMemo<DetentPoint[]>(() => {
    const base: DetentPoint[] = [
      { state: "peek", height: heights.peek },
      { state: "expanded", height: heights.expanded },
    ];
    if (!disableMidState && heights.mid > heights.peek + 1 && heights.mid < heights.expanded - 1) {
      base.push({ state: "mid", height: heights.mid });
    }
    return base.sort((a, b) => a.height - b.height);
  }, [disableMidState, heights.expanded, heights.mid, heights.peek]);

  const findNearestDetent = useCallback(
    (value: number): DetentPoint => {
      const normalized = Number.isFinite(value) ? value : detents[0]?.height ?? heights.peek;
      return detents.reduce((best, point) => {
        if (Math.abs(point.height - normalized) < Math.abs(best.height - normalized)) {
          return point;
        }
        return best;
      }, detents[0] ?? { state: "peek" as const, height: heights.peek });
    },
    [detents, heights.peek],
  );

  const resolveSnapState = useCallback(
    (projected: number, currentHeight: number, velocityHeight: number): SheetState => {
      const currentDetent = findNearestDetent(currentHeight);
      const currentIndex = Math.max(
        0,
        detents.findIndex((point) => point.state === currentDetent.state),
      );
      const direction = velocityHeight > 0 ? 1 : velocityHeight < 0 ? -1 : 0;
      const absVelocity = Math.abs(velocityHeight);

      // iOS-like fling: a fast gesture commits to the next (or extreme) detent in direction.
      if (direction !== 0 && absVelocity >= FLING_FAST_VELOCITY) {
        return direction > 0 ? detents[detents.length - 1].state : detents[0].state;
      }
      if (direction !== 0 && absVelocity >= FLING_COMMIT_VELOCITY) {
        const nextIndex = Math.max(0, Math.min(detents.length - 1, currentIndex + direction));
        return detents[nextIndex].state;
      }
      return findNearestDetent(projected).state;
    },
    [detents, findNearestDetent],
  );

  const visibleHeight = useMotionValue(heights.mid);
  const translateY = useMotionValue(Math.max(0, heights.expanded - heights.mid));

  useLayoutEffect(() => {
    if (!isDragging) {
      currentDetentRef.current = effectiveSheetState;
    }
  }, [effectiveSheetState, isDragging]);

  useLayoutEffect(() => {
    const targetDetent =
      detents.find((point) => point.state === effectiveSheetState) ??
      detents[detents.length - 1];
    const target = targetDetent.height;
    animationControlsRef.current?.stop();
    const initialVelocity =
      snapCauseRef.current === "gesture"
        ? Math.max(
            -MAX_LAUNCH_VELOCITY,
            Math.min(MAX_LAUNCH_VELOCITY, launchVelocityRef.current),
          )
        : 0;
    // Consume gesture momentum once; all next re-runs are pure settle animations.
    snapCauseRef.current = "programmatic";
    const controls = animate(visibleHeight, target, {
      type: "spring",
      stiffness: SNAP_STIFFNESS,
      damping: SNAP_DAMPING,
      mass: SNAP_MASS,
      velocity: initialVelocity,
      restDelta: 0.4,
      restSpeed: 8,
      onComplete: () => {
        setSheetHeight(target);
        setSheetHeightLive(target);
        currentDetentRef.current = targetDetent.state;
        launchVelocityRef.current = 0;
        if (pendingSnapHapticRef.current) {
          pendingSnapHapticRef.current = false;
          if (snapHapticTimeoutRef.current != null) {
            window.clearTimeout(snapHapticTimeoutRef.current);
          }
          // Delay the snap haptic slightly so it is not swallowed by the last drag tick.
          snapHapticTimeoutRef.current = window.setTimeout(() => {
            snapHapticTimeoutRef.current = null;
            void appHaptics.trigger(resolveSnapHapticPreset(targetDetent.state));
          }, SNAP_HAPTIC_DELAY_MS);
        }
      },
    });
    animationControlsRef.current = controls;
    return () => {
      controls.stop();
      if (animationControlsRef.current === controls) {
        animationControlsRef.current = null;
      }
    };
  }, [detents, effectiveSheetState, setSheetHeight, setSheetHeightLive, visibleHeight]);

  useMotionValueEvent(visibleHeight, "change", (latest) => {
    // With fixed sheet height, dragging maps to a compositor-friendly translateY.
    translateY.set(Math.max(0, heights.expanded - latest));
    const currentVisibleHeight = Math.max(heights.peek, latest);
    // Live updates via CSS var preserve smooth drag by avoiding global context churn.
    setSheetHeightLive(currentVisibleHeight);
  });

  useLayoutEffect(() => {
    // Re-sync translate when viewport-driven expanded height changes.
    const currentVisible = Math.max(heights.peek, visibleHeight.get());
    translateY.set(Math.max(0, heights.expanded - currentVisible));
    setSheetHeightLive(currentVisible);
  }, [heights, setSheetHeightLive, translateY, visibleHeight]);

  useLayoutEffect(() => {
    if (autoExpandTrigger === lastAutoExpandTriggerRef.current) return;
    lastAutoExpandTriggerRef.current = autoExpandTrigger;
    if (lockedState) return;
    if (effectiveSheetState !== "peek") return;
    const nextState: SheetState = disableMidState ? "expanded" : "mid";
    const rafId = window.requestAnimationFrame(() => {
      snapCauseRef.current = "programmatic";
      setSheetState(nextState);
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [autoExpandTrigger, disableMidState, effectiveSheetState, lockedState]);

  useLayoutEffect(() => {
    setLayoutSheetState(effectiveSheetState);
  }, [effectiveSheetState, setLayoutSheetState]);

  const handleHeaderPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (lockedState) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('input, textarea, select, [data-no-drag="true"]')) {
      return;
    }
    const startX = event.clientX;
    const startY = event.clientY;
    const startHeight = visibleHeight.get();
    animationControlsRef.current?.stop();
    animationControlsRef.current = null;
    launchVelocityRef.current = 0;
    snapCauseRef.current = "programmatic";
    pendingSnapHapticRef.current = false;
    const pointerId = event.pointerId;
    const pointerHost = event.currentTarget;
    if (pointerHost.setPointerCapture) {
      try {
        pointerHost.setPointerCapture(pointerId);
      } catch {
        // no-op
      }
    }
    const isInteractive = Boolean(target.closest("button, a"));
    const threshold = isInteractive ? 10 : 7;
    let mode: "pending" | "drag" | "ignore" = "pending";
    const pushVelocitySample = (clientY: number, ts: number) => {
      const samples = velocitySamplesRef.current;
      samples.push({ y: clientY, t: ts });
      const cutoff = ts - VELOCITY_WINDOW_MS;
      while (samples.length > 0 && samples[0].t < cutoff) {
        samples.shift();
      }
      if (samples.length > 8) {
        samples.splice(0, samples.length - 8);
      }
    };
    velocitySamplesRef.current = [];
    pushVelocitySample(startY, performance.now());

    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (mode === "pending") {
        if (absDx < threshold && absDy < threshold) return;
        const verticalDominant = absDy > absDx + 3;
        const horizontalDominant = absDx > absDy + 8;
        if (!verticalDominant && !horizontalDominant) {
          return;
        }
        if (horizontalDominant) {
          // Horizontal gesture: let nested UI (e.g. photo swipe) handle it.
          mode = "ignore";
          cleanup();
          return;
        }
        mode = "drag";
        setIsDragging(true);
        currentDetentRef.current = findNearestDetent(startHeight).state;
      }
      if (mode !== "drag") return;
      moveEvent.preventDefault();
      const next = startHeight - dy;
      const clamped = Math.max(heights.peek, Math.min(heights.expanded, next));
      visibleHeight.set(clamped);
      pushVelocitySample(moveEvent.clientY, performance.now());
      const nextDetent = findNearestDetent(clamped).state;
      if (nextDetent !== currentDetentRef.current) {
        currentDetentRef.current = nextDetent;
        const now = performance.now();
        if (now - lastSelectionHapticAtRef.current >= DETENT_SELECTION_HAPTIC_COOLDOWN_MS) {
          lastSelectionHapticAtRef.current = now;
          void appHaptics.trigger("selection");
        }
      }
    };

    const handleUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      if (mode === "drag") {
        const current = visibleHeight.get();
        const releaseTs = performance.now();
        pushVelocitySample(upEvent.clientY, releaseTs);
        const samples = velocitySamplesRef.current;
        const first = samples[0] ?? null;
        const last = samples[samples.length - 1] ?? null;
        const dt = first && last ? Math.max(1, last.t - first.t) : 1;
        // Average velocity over recent gesture window feels closer to native inertial sheets.
        const velocityY = first && last ? ((last.y - first.y) / dt) * 1000 : 0; // Screen axis.
        const velocityHeight = -velocityY; // Sheet axis: up swipe -> positive value.
        // Project release momentum to choose the most natural detent before spring settle.
        const projected = current + velocityHeight * FLING_PROJECTION_FACTOR;
        launchVelocityRef.current = velocityHeight;
        snapCauseRef.current = "gesture";
        pendingSnapHapticRef.current = true;
        setSheetState(resolveSnapState(projected, current, velocityHeight));
      }
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      velocitySamplesRef.current = [];
      setIsDragging(false);
      if (pointerHost.releasePointerCapture) {
        try {
          pointerHost.releasePointerCapture(pointerId);
        } catch {
          // no-op
        }
      }
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp, { passive: true });
    window.addEventListener("pointercancel", handleUp, { passive: true });
  };

  return (
    <div
      ref={sheetRef}
      className={classes.wrapper}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
      }}
    >
      <MotionSheet
        className={classes.sheet}
        data-state={effectiveSheetState}
        data-dragging={isDragging ? "true" : "false"}
        style={{
          y: translateY,
          height: heights.expanded,
          maxHeight: "100%",
          borderRadius: 22,
          ["--sheet-header-height" as string]: `${Math.round(headerHeight)}px`,
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow)",
          backdropFilter: isDragging ? "none" : "blur(14px)",
          WebkitBackdropFilter: isDragging ? "none" : "blur(14px)",
        }}
      >
        <div
          ref={headerRef}
          className={classes.header}
          onPointerDownCapture={handleHeaderPointerDown}
        >
          <div className={classes.grabber} />
          {isError && (
            <p
              style={{
                margin: 0,
                color: "var(--color-status-error)",
                fontSize: "0.875rem",
              }}
            >
              {errorText}
            </p>
          )}
          {!hideHeaderContent && header}
        </div>
        <div
          className={classes.list}
          data-sheet-scroll="true"
          data-empty={isListEmpty ? "true" : "false"}
          aria-hidden={effectiveSheetState === "peek"}
        >
          {children}
        </div>
      </MotionSheet>
    </div>
  );
}
