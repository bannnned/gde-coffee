import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useMotionValueEvent,
} from "framer-motion";
import type {
  PropsWithChildren,
  ReactNode,
  RefObject,
} from "react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import useAppColorScheme from "../../../hooks/useAppColorScheme";
import { useLayoutMetrics } from "../layout/LayoutMetricsContext";

type BottomSheetProps = PropsWithChildren<{
  sheetRef: RefObject<HTMLDivElement | null>;
  isError: boolean;
  errorText: string;
  header?: ReactNode;
  isListEmpty?: boolean;
}>;

type SheetState = "peek" | "mid" | "expanded";

const SWIPE_VELOCITY = 900;
const PEEK_HEIGHT_PX = 64;
const SHEET_PADDING_PX = 12;

const MotionSheet = motion.div;

export default function BottomSheet({
  sheetRef,
  isError,
  errorText,
  header,
  isListEmpty,
  children,
}: BottomSheetProps) {
  const { colorScheme: scheme } = useAppColorScheme();
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
  const dragControls = useDragControls();

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

  const heights = useMemo(() => {
    const chromeReserve = 24;
    const safeViewport = Math.max(0, safeViewportHeight - chromeReserve);
    const topReserved =
      filtersBarHeight > 0 ? Math.max(0, filtersBarHeight + 12) : 0;
    const available = Math.max(0, safeViewport - topReserved);
    const maxPeek = Math.round(safeViewport * 0.9);
    const peek = Math.min(
      maxPeek,
      Math.round(headerHeight + SHEET_PADDING_PX * 2),
    );
    const expanded = Math.max(peek, Math.round(available));
    const mid = Math.min(
      expanded,
      Math.max(peek + 120, Math.round(available * 0.33)),
    );
    return { mid, expanded, peek };
  }, [filtersBarHeight, headerHeight, safeViewportHeight]);

  const height = useMotionValue(heights.mid);

  useLayoutEffect(() => {
    const target =
      sheetState === "expanded"
        ? heights.expanded
        : sheetState === "peek"
          ? heights.peek
          : heights.mid;
    const controls = animate(height, target, {
      type: "spring",
      stiffness: 300,
      damping: 34,
    });
    return () => controls.stop();
  }, [height, heights, sheetState]);

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
    setLayoutSheetState(sheetState);
  }, [setLayoutSheetState, sheetState]);

  const pickClosest = (value: number) => {
    const points = [heights.expanded, heights.mid, heights.peek];
    return points.reduce((prev, point) =>
      Math.abs(point - value) < Math.abs(prev - value) ? point : prev,
    );
  };

  const handleDrag = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: { delta: { y: number } },
  ) => {
    const next = height.get() - info.delta.y;
    const clamped = Math.max(heights.peek, Math.min(heights.expanded, next));
    height.set(clamped);
  };

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { y: number }; velocity: { y: number } },
  ) => {
    const current = height.get();
    const projected =
      Math.abs(info.velocity.y) > SWIPE_VELOCITY
        ? current - info.velocity.y * 0.2
        : current - info.offset.y * 0.2;
    const snap = pickClosest(projected);
    if (snap === heights.expanded) setSheetState("expanded");
    else if (snap === heights.peek) setSheetState("peek");
    else setSheetState("mid");
  };

  const handleHeaderPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest(
        'button, a, input, textarea, select, [data-no-drag="true"]',
      )
    ) {
      return;
    }
    dragControls.start(event);
  };

  return (
    <div
      ref={sheetRef}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "0 12px 12px",
        pointerEvents: "none",
      }}
    >
      <MotionSheet
        data-state={sheetState}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{
          y: 0,
          height,
          maxHeight: "100%",
          ["--sheet-header-height" as string]: `${Math.round(headerHeight)}px`,
          background:
            scheme === "dark"
              ? "rgba(26,26,26,0.78)"
              : "rgba(255,255,240,0.78)",
          border: `1px solid ${
            scheme === "dark"
              ? "rgba(255,255,240,0.16)"
              : "rgba(255,255,240,0.7)"
          }`,
          boxShadow:
            scheme === "dark"
              ? "0 18px 45px rgba(0,0,0,0.6)"
              : "0 18px 45px rgba(26,26,26,0.16)",
          backdropFilter: "blur(14px)",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          pointerEvents: "auto",
        }}
      >
        <div
          ref={headerRef}
          onPointerDown={handleHeaderPointerDown}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "100%",
            flexShrink: 0,
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            zIndex: 3,
            padding: 10,
            background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, transparent), color-mix(in srgb, var(--surface) 74%, transparent))",
          }}
        >
          <div
            style={{
              width: 72,
              height: 16,
              position: "relative",
              cursor: "grab",
              touchAction: "none",
              userSelect: "none",
              margin: "0 auto",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "50%",
                height: 4,
                transform: "translateY(-50%)",
                borderRadius: 999,
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.65), rgba(255,255,255,0.15))",
                boxShadow: "0 1px 0 var(--glass-border), 0 6px 14px var(--color-surface-overlay-soft)",
              }}
            />
          </div>
          {isError ? (
            <p style={{ margin: 0, color: "var(--color-status-error)", fontSize: "0.82rem" }}>
              {errorText}
            </p>
          ) : null}
          {header}
        </div>
        <div
          data-empty={isListEmpty ? "true" : "false"}
          aria-hidden={sheetState === "peek"}
          style={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            overflowY: isListEmpty ? "hidden" : "auto",
            WebkitOverflowScrolling: "touch",
            padding: "calc(var(--sheet-header-height, 0px) + 12px) 8px 12px",
            opacity: sheetState === "peek" ? 0 : 1,
            visibility: sheetState === "peek" ? "hidden" : "visible",
            transform: sheetState === "peek" ? "translateY(-8px)" : "translateY(0)",
            transition: "opacity 140ms ease, transform 140ms ease",
            pointerEvents: sheetState === "peek" ? "none" : "auto",
          }}
        >
          {children}
        </div>
      </MotionSheet>
    </div>
  );
}
