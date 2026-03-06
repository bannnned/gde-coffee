export type TasteOnboardingProgress = {
  version: string;
  stepIndex: number;
  answers: Record<string, unknown>;
  updatedAt: string;
};

const STORAGE_PREFIX = "gdeCoffeeTasteOnboardingProgress";

function storageKey(userID: string): string {
  return `${STORAGE_PREFIX}:${userID}`;
}

export function loadTasteOnboardingProgress(userID: string): TasteOnboardingProgress | null {
  if (typeof window === "undefined") return null;
  const normalizedUserID = userID.trim();
  if (!normalizedUserID) return null;

  const raw = window.localStorage.getItem(storageKey(normalizedUserID));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TasteOnboardingProgress;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.version !== "string") return null;
    if (typeof parsed.stepIndex !== "number") return null;
    if (!parsed.answers || typeof parsed.answers !== "object" || Array.isArray(parsed.answers)) {
      return null;
    }
    if (typeof parsed.updatedAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveTasteOnboardingProgress(
  userID: string,
  payload: TasteOnboardingProgress,
): void {
  if (typeof window === "undefined") return;
  const normalizedUserID = userID.trim();
  if (!normalizedUserID) return;
  window.localStorage.setItem(storageKey(normalizedUserID), JSON.stringify(payload));
}

export function clearTasteOnboardingProgress(userID: string): void {
  if (typeof window === "undefined") return;
  const normalizedUserID = userID.trim();
  if (!normalizedUserID) return;
  window.localStorage.removeItem(storageKey(normalizedUserID));
}
