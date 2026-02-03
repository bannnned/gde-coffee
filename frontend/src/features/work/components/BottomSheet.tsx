import { Box, Paper, Stack, Text, useComputedColorScheme } from "@mantine/core";
import type { PropsWithChildren, RefObject } from "react";

import classes from "./BottomSheet.module.css";

type BottomSheetProps = PropsWithChildren<{
  sheetRef: RefObject<HTMLDivElement | null>;
  isError: boolean;
  errorText: string;
}>;

export default function BottomSheet({
  sheetRef,
  isError,
  errorText,
  children,
}: BottomSheetProps) {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  return (
    <Box
      pos="absolute"
      ref={sheetRef}
      bottom={0}
      left={0}
      right={0}
      p="sm"
      className={classes.wrapper}
    >
      <Paper
        withBorder
        radius="lg"
        p="sm"
        className={classes.paper}
        style={{
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
        <Stack gap="xs">
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
