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
  RefObject,
} from "react";
import { useLayoutEffect, useMemo, useState } from "react";

import classes from "./BottomSheet.module.css";

type BottomSheetProps = PropsWithChildren<{
  sheetRef: RefObject<HTMLDivElement | null>;
  isError: boolean;
  errorText: string;
}>;

type SheetState = "peek" | "mid" | "expanded";

const SWIPE_VELOCITY = 900;
const PEEK_HEIGHT_PX = 64;

const MotionPaper = motion(Paper);

export default function BottomSheet({
  sheetRef,
  isError,
  errorText,
  children,
}: BottomSheetProps) {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const dragControls = useDragControls();
  const [sheetState, setSheetState] = useState<SheetState>("mid");
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);

  useLayoutEffect(() => {
    const update = () => setViewportHeight(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const heights = useMemo(() => {
    const chromeReserve = 24;
    const safeViewport = Math.max(0, viewportHeight - chromeReserve);
    const expanded = Math.max(PEEK_HEIGHT_PX + 120, Math.round(safeViewport * 0.66));
    const mid = Math.max(PEEK_HEIGHT_PX + 80, Math.round(safeViewport * 0.33));
    return { mid, expanded, peek: PEEK_HEIGHT_PX };
  }, [viewportHeight]);

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

  const pickClosest = (value: number) => {
    const points = [heights.expanded, heights.mid, heights.peek];
    return points.reduce((prev, point) =>
      Math.abs(point - value) < Math.abs(prev - value) ? point : prev,
    );
  };

  const handlePointerDown = (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    const isGrabber = target?.closest(`.${classes.grabber}`) != null;
    if (isGrabber) {
      dragControls.start(event);
    }
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
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onPointerDown={handlePointerDown}
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
        <div className={classes.grabber} />
        <div className={classes.content}>
          {isError && (
            <Text c="red" size="sm">
              {errorText}
            </Text>
          )}
          {children}
        </div>
      </MotionPaper>
    </Box>
  );
}
