import { TagsInput as MantineTagsInput, type TagsInputProps as MantineTagsInputProps } from "@mantine/core";

type BridgeEngine = "mantine" | "radix";

export type AppTagsInputProps = MantineTagsInputProps & {
  implementation?: BridgeEngine;
};

export function AppTagsInput({ implementation = "mantine", ...props }: AppTagsInputProps) {
  // Keep Mantine behavior behind bridge contract until Radix searchable tags input lands.
  if (implementation === "radix") {
    return <MantineTagsInput {...props} />;
  }
  return <MantineTagsInput {...props} />;
}
