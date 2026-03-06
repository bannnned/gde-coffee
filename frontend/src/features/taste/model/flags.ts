const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on"]);

export function getTasteMapV1FlagRaw(): string {
  return (import.meta.env.VITE_TASTE_MAP_V1_ENABLED as string | undefined)?.trim() ?? "";
}

export function isTasteMapV1Enabled(): boolean {
  return TRUE_VALUES.has(getTasteMapV1FlagRaw().toLowerCase());
}
