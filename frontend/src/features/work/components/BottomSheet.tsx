import { Box, Paper, Stack, Text, useComputedColorScheme } from "@mantine/core";
import type { PointerEvent, PropsWithChildren, RefObject, TouchEvent } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import classes from "./BottomSheet.module.css";

type BottomSheetProps = PropsWithChildren<{
  sheetRef: RefObject<HTMLDivElement | null>;
  scrollRef?: RefObject<HTMLDivElement | null>;
  isError: boolean;
  errorText: string;
}>;

type SheetState = "peek" | "mid" | "expanded";

const SWIPE_THRESHOLD_PX = 60;
const PEEK_HEIGHT_PX = 64;

export default function BottomSheet({
  sheetRef,
  scrollRef,
  isError,
  errorText,
  children,
}: BottomSheetProps) {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const [sheetState, setSheetState] = useState<SheetState>("mid");
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const dragState = useRef({
    active: false,
    startY: 0,
    lastY: 0,
    moved: false,
    originIsGrabber: false,
  });
  const dragPointerId = useRef<number | null>(null);

  useLayoutEffect(() => {
    const update = () => setViewportHeight(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const midHeight = Math.round(viewportHeight * 0.33);
  const expandedHeight = Math.round(viewportHeight * 0.66);
  const sheetHeight =
    sheetState === "peek"
      ? PEEK_HEIGHT_PX
      : sheetState === "expanded"
        ? expandedHeight
        : midHeight;

  const setNextUp = () => {
    setSheetState((prev) =>
      prev === "peek" ? "mid" : prev === "mid" ? "expanded" : prev,
    );
  };

  const setNextDown = () => {
    setSheetState((prev) =>
      prev === "expanded" ? "mid" : prev === "mid" ? "peek" : prev,
    );
  };

  const beginDrag = (clientY: number, target: EventTarget | null) => {
    dragState.current = {
      active: true,
      startY: clientY,
      lastY: clientY,
      moved: false,
      originIsGrabber:
        target instanceof HTMLElement &&
        target.closest(`.${classes.grabber}`) != null,
    };
  };

  const updateDrag = (clientY: number) => {
    if (!dragState.current.active) return false;
    const delta = clientY - dragState.current.startY;
    if (Math.abs(delta) < 6) return false;
    const scrollTop = scrollRef?.current?.scrollTop ?? 0;
    const atTop =
      scrollTop <= 0 || sheetState === "peek" || dragState.current.originIsGrabber;
    if (!atTop) return false;
    const movingUp = delta < 0 && sheetState !== "expanded";
    const movingDown = delta > 0 && sheetState !== "peek";
    if (!movingUp && !movingDown) return false;
    dragState.current.moved = true;
    dragState.current.lastY = clientY;
    return true;
  };

  const finishDrag = () => {
    if (!dragState.current.active) return;
    const delta = dragState.current.lastY - dragState.current.startY;
    const moved = dragState.current.moved;
    dragState.current.active = false;
    if (!moved) return;
    const scrollTop = scrollRef?.current?.scrollTop ?? 0;
    const atTop =
      scrollTop <= 0 || sheetState === "peek" || dragState.current.originIsGrabber;
    if (!atTop) return;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta < 0) {
      setNextUp();
    } else {
      setNextDown();
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    beginDrag(event.clientY, event.target);
    dragPointerId.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // no-op if pointer capture isn't available
    }
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (updateDrag(event.clientY)) {
      event.preventDefault();
    }
  };

  const handlePointerEnd = (event: PointerEvent) => {
    if (dragPointerId.current != null) {
      try {
        event.currentTarget.releasePointerCapture(dragPointerId.current);
      } catch {
        // no-op if capture was not set
      }
      dragPointerId.current = null;
    }
    finishDrag();
  };

  const handleTouchStart = (event: TouchEvent) => {
    if ("PointerEvent" in window) return;
    const touch = event.touches[0];
    if (!touch) return;
    beginDrag(touch.clientY, event.target);
  };

  const handleTouchMove = (event: TouchEvent) => {
    if ("PointerEvent" in window) return;
    const touch = event.touches[0];
    if (!touch) return;
    if (updateDrag(touch.clientY)) {
      event.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if ("PointerEvent" in window) return;
    finishDrag();
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
      <Paper
        withBorder
        radius="lg"
        p="sm"
        className={classes.sheet}
        data-state={sheetState}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          height: sheetHeight,
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
        <Stack gap="xs" className={classes.content}>
          {isError && (
            <Text c="red" size="sm">
              {errorText}
            </Text>
          )}
          {children}
        </Stack>
      </Paper>
    </Box>
  );
}
