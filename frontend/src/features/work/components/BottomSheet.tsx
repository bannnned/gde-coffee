import { Box, Paper, Text, useComputedColorScheme } from "@mantine/core";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useMotionValueEvent,
} from "framer-motion";
import type {
  PointerEvent as ReactPointerEvent,
  PropsWithChildren,
  ReactNode,
  RefObject,
} from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import classes from "./BottomSheet.module.css";

type BottomSheetProps = PropsWithChildren<{
  sheetRef: RefObject<HTMLDivElement | null>;
  isError: boolean;
  errorText: string;
  header?: ReactNode;
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
  children,
}: BottomSheetProps) {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const dragControls = useDragControls();
  const [sheetState, setSheetState] = useState<SheetState>("mid");
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [topReserved, setTopReserved] = useState(0);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(PEEK_HEIGHT_PX);

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
    const update = () => setViewportHeight(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useLayoutEffect(() => {
    const node = document.querySelector('[data-ui="filters-bar"]') as
      | HTMLElement
      | null;
    if (!node) return undefined;

    const update = () => {
      const rect = node.getBoundingClientRect();
      setTopReserved(Math.max(0, rect.bottom + 12));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const heights = useMemo(() => {
    const chromeReserve = 24;
    const safeViewport = Math.max(0, viewportHeight - chromeReserve);
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
  }, [headerHeight, topReserved, viewportHeight]);

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

  useMotionValueEvent(height, "change", (latest) => {
    const visibleHeight = Math.max(heights.peek, latest);
    document.documentElement.style.setProperty(
      "--sheet-height",
      `${Math.round(visibleHeight)}px`,
    );
  });

  useLayoutEffect(() => {
    const visibleHeight = Math.max(heights.peek, height.get());
    document.documentElement.style.setProperty(
      "--sheet-height",
      `${Math.round(visibleHeight)}px`,
    );
  }, [heights, height]);

  useLayoutEffect(() => {
    document.documentElement.dataset.sheetState = sheetState;
    return () => {
      if (document.documentElement.dataset.sheetState === sheetState) {
        delete document.documentElement.dataset.sheetState;
      }
    };
  }, [sheetState]);

  const pickClosest = (value: number) => {
    const points = [heights.expanded, heights.mid, heights.peek];
    return points.reduce((prev, point) =>
      Math.abs(point - value) < Math.abs(prev - value) ? point : prev,
    );
  };

  const handlePointerDown = (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragControls.start(event);
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
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{
          y: 0,
          height,
          maxHeight: "100%",
          background:
            scheme === "dark"
              ? "rgba(15,18,22,0.60)"
              : "rgba(255,255,255,0.72)",
          border: `1px solid ${
            scheme === "dark"
              ? "rgba(255,255,255,0.12)"
              : "rgba(255,255,255,0.55)"
          }`,
          boxShadow:
            scheme === "dark"
              ? "0 18px 45px rgba(0,0,0,0.45)"
              : "0 18px 45px rgba(20,20,20,0.12)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div ref={headerRef} className={classes.header}>
          <div className={classes.grabber} onPointerDown={handlePointerDown} />
          {isError && (
            <Text c="red" size="sm">
              {errorText}
            </Text>
          )}
          {header}
        </div>
        <div className={classes.list} aria-hidden={sheetState === "peek"}>
          {children}
        </div>
      </MotionPaper>
    </Box>
  );
}
