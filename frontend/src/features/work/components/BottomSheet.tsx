import { Box, Paper, Text, useComputedColorScheme } from "@mantine/core";
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
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import classes from "./BottomSheet.module.css";
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

const MotionPaper = motion(Paper as any);

export default function BottomSheet({
  sheetRef,
  isError,
  errorText,
  header,
  isListEmpty,
  children,
}: BottomSheetProps) {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
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

  const scheduleSheetHeight = (value: number) => {
    pendingSheetHeightRef.current = value;
    if (sheetHeightRafRef.current != null) return;
    sheetHeightRafRef.current = window.requestAnimationFrame(() => {
      sheetHeightRafRef.current = null;
      const pending = pendingSheetHeightRef.current;
      if (pending == null) return;
      pendingSheetHeightRef.current = null;
      setSheetHeight(pending);
    });
  };

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
  }, [heights, height, setSheetHeight]);

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
    event.preventDefault();
    dragControls.start(event);
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
        radius="lg"
        p="sm"
        className={classes.sheet}
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
          {header}
        </div>
        <div
          className={classes.list}
          data-empty={isListEmpty ? "true" : "false"}
          aria-hidden={sheetState === "peek"}
        >
          {children}
        </div>
      </MotionPaper>
    </Box>
  );
}
