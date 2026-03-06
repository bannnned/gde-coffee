const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on"]);

export function isTasteMapV1Enabled(): boolean {
  const raw =
    (import.meta.env.VITE_TASTE_MAP_V1_ENABLED as string | undefined)?.trim().toLowerCase() ?? "";
  return TRUE_VALUES.has(raw);
}
