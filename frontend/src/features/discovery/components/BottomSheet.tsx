import { Box, Paper, Text } from "@mantine/core";
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
import { useLayoutMetrics } from "../layout/LayoutMetricsContext";

type BottomSheetProps = PropsWithChildren<{
  sheetRef: RefObject<HTMLDivElement | null>;
  isError: boolean;
  errorText: string;
  header?: ReactNode;
  isListEmpty?: boolean;
  lockedState?: SheetState | null;
  disableMidState?: boolean;
  hideHeaderContentInPeek?: boolean;
}>;

type SheetState = "peek" | "mid" | "expanded";

const SWIPE_VELOCITY = 900;
const PEEK_HEIGHT_PX = 64;
const SHEET_PADDING_PX = 8;
const MID_SINGLE_CAFE_EXTRA_PX = 26;

const MotionPaper = motion(Paper);

export default function BottomSheet({
  sheetRef,
  isError,
  errorText,
  header,
  isListEmpty,
  lockedState = null,
  disableMidState = false,
  hideHeaderContentInPeek = false,
  children,
}: BottomSheetProps) {
  const {
    filtersBarHeight,
    safeViewportHeight,
    setSheetHeight,
    setSheetState: setLayoutSheetState,
  } = useLayoutMetrics();
  const [sheetState, setSheetState] = useState<SheetState>("mid");
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(PEEK_HEIGHT_PX);
  const sheetHeightRafRef = useRef<number | null>(null);
  const pendingSheetHeightRef = useRef<number | null>(null);

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
      ? peek + MID_SINGLE_CAFE_EXTRA_PX
      : Math.max(peek + 120, Math.round(available * 0.33));
    const mid = disableMidState
      ? expanded
      : Math.min(expanded, midTarget);
    return { mid, expanded, peek };
  }, [disableMidState, filtersBarHeight, headerHeight, hideHeaderContentInPeek, safeViewportHeight]);

  const height = useMotionValue(heights.mid);

  useLayoutEffect(() => {
    const target =
      effectiveSheetState === "expanded"
        ? heights.expanded
        : effectiveSheetState === "peek"
          ? heights.peek
          : heights.mid;
    const controls = animate(height, target, {
      type: "spring",
      stiffness: 300,
      damping: 34,
    });
    return () => controls.stop();
  }, [effectiveSheetState, height, heights]);

  const scheduleSheetHeight = useCallback((value: number) => {
    pendingSheetHeightRef.current = value;
    if (sheetHeightRafRef.current != null) return;
    sheetHeightRafRef.current = window.requestAnimationFrame(() => {
      sheetHeightRafRef.current = null;
      const pending = pendingSheetHeightRef.current;
      if (pending == null) return;
      pendingSheetHeightRef.current = null;
      setSheetHeight(pending);
    });
  }, [setSheetHeight]);

  useMotionValueEvent(height, "change", (latest) => {
    const visibleHeight = Math.max(heights.peek, latest);
    scheduleSheetHeight(visibleHeight);
  });

  useLayoutEffect(() => {
    const visibleHeight = Math.max(heights.peek, height.get());
    scheduleSheetHeight(visibleHeight);
    return () => {
      if (sheetHeightRafRef.current != null) {
        cancelAnimationFrame(sheetHeightRafRef.current);
        sheetHeightRafRef.current = null;
      }
      pendingSheetHeightRef.current = null;
    };
  }, [heights, height, scheduleSheetHeight]);

  useLayoutEffect(() => {
    setLayoutSheetState(effectiveSheetState);
  }, [effectiveSheetState, setLayoutSheetState]);

  const pickClosest = (value: number) => {
    const points = disableMidState
      ? [heights.expanded, heights.peek]
      : [heights.expanded, heights.mid, heights.peek];
    return points.reduce((prev, point) =>
      Math.abs(point - value) < Math.abs(prev - value) ? point : prev,
    );
  };

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
    const startHeight = height.get();
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
    let lastClientY = startY;
    let lastTs = performance.now();

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
      }
      if (mode !== "drag") return;
      moveEvent.preventDefault();
      const next = startHeight - dy;
      const clamped = Math.max(heights.peek, Math.min(heights.expanded, next));
      height.set(clamped);
      lastClientY = moveEvent.clientY;
      lastTs = performance.now();
    };

    const handleUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      if (mode === "drag") {
        const current = height.get();
        const offsetY = upEvent.clientY - startY;
        const nowTs = performance.now();
        const dt = Math.max(1, nowTs - lastTs);
        const velocityY = ((upEvent.clientY - lastClientY) / dt) * 1000;
        const projected =
          Math.abs(velocityY) > SWIPE_VELOCITY
            ? current - velocityY * 0.2
            : current - offsetY * 0.2;
        if (disableMidState) {
          // In single-cafe mode don't collapse too eagerly: require a deep pull.
          const peekSnapThreshold = heights.peek + Math.max(
            34,
            Math.min(72, Math.round((heights.expanded - heights.peek) * 0.16)),
          );
          if (projected <= peekSnapThreshold) {
            setSheetState("peek");
          } else {
            setSheetState("expanded");
          }
        } else {
          const snap = pickClosest(projected);
          if (snap === heights.peek) {
            setSheetState("peek");
          } else if (snap === heights.expanded) {
            setSheetState("expanded");
          } else {
            setSheetState("mid");
          }
        }
      }
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
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
    <Box
      pos="absolute"
      ref={sheetRef}
      bottom={0}
      left={0}
      right={0}
      px="sm"
      pb="sm"
      className={classes.wrapper}
    >
      <MotionPaper
        withBorder
        radius={22}
        p="xs"
        className={classes.sheet}
        data-state={effectiveSheetState}
        style={{
          y: 0,
          height,
          maxHeight: "100%",
          ["--sheet-header-height" as string]: `${Math.round(headerHeight)}px`,
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div
          ref={headerRef}
          className={classes.header}
          onPointerDownCapture={handleHeaderPointerDown}
        >
          <div className={classes.grabber} />
          {isError && (
            <Text c="red" size="sm">
              {errorText}
            </Text>
          )}
          {!hideHeaderContent && header}
        </div>
        <div
          className={classes.list}
          data-empty={isListEmpty ? "true" : "false"}
          aria-hidden={effectiveSheetState === "peek"}
        >
          {children}
        </div>
      </MotionPaper>
    </Box>
  );
}
