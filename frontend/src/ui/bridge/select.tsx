import { Select as MantineSelect, type SelectProps as MantineSelectProps } from "@mantine/core";

type BridgeEngine = "mantine" | "radix";

export type AppSelectProps = MantineSelectProps & {
  implementation?: BridgeEngine;
};

export function AppSelect({ implementation = "mantine", ...props }: AppSelectProps) {
  // For STK-BL-010 we keep Mantine Select behavior via bridge.
  // Radix-backed searchable select will replace this in next iteration.
  if (implementation === "radix") {
    return <MantineSelect {...props} />;
  }
  return <MantineSelect {...props} />;
}
