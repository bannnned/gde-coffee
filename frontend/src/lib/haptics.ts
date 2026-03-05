import type { HapticInput } from "web-haptics";

type WebHapticsCtor = typeof import("web-haptics")["WebHaptics"];
type WebHapticsInstance = InstanceType<WebHapticsCtor>;

export type AppHapticPreset =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error"
  | "soft"
  | "rigid"
  | "nudge";

export type AppHapticInput = AppHapticPreset | Exclude<HapticInput, string>;

export const APP_HAPTIC_PRESETS: readonly AppHapticPreset[] = [
  "selection",
  "light",
  "medium",
  "heavy",
  "success",
  "warning",
  "error",
  "soft",
  "rigid",
  "nudge",
] as const;

const HAPTICS_STORAGE_KEY = "gdeCoffee.haptics.enabled";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const DEFAULT_PRESET: AppHapticPreset = "selection";
const TRIGGER_COOLDOWN_MS = 36;
const DEFAULT_ENABLED = true;

const FALLBACK_PATTERNS: Record<AppHapticPreset, number | number[]> = {
  selection: 8,
  light: 12,
  medium: 18,
  heavy: 28,
  success: [12, 55, 12],
  warning: [22, 40, 22],
  error: [34, 45, 34, 45, 34],
  soft: 22,
  rigid: 8,
  nudge: [28, 80, 20],
};

function canUseDOM() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function readStoredEnabled(): boolean | null {
  if (!canUseDOM()) return null;
  const raw = window.localStorage.getItem(HAPTICS_STORAGE_KEY);
  if (raw === "1") return true;
  if (raw === "0") return false;
  return null;
}

function writeStoredEnabled(value: boolean) {
  if (!canUseDOM()) return;
  window.localStorage.setItem(HAPTICS_STORAGE_KEY, value ? "1" : "0");
}

function hasVibrationAPI() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

function isLikelyIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  if (/(iphone|ipad|ipod)/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function shouldSkipByReducedMotion() {
  if (!canUseDOM() || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

class AppHapticsEngine {
  private engine: WebHapticsInstance | null = null;
  private loadPromise: Promise<WebHapticsInstance | null> | null = null;
  private enabled: boolean;
  private lastTriggerAt = 0;

  constructor() {
    this.enabled = readStoredEnabled() ?? DEFAULT_ENABLED;
  }

  getEnabled() {
    return this.enabled;
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    writeStoredEnabled(value);
  }

  getIsSupported() {
    return hasVibrationAPI() || isLikelyIOSDevice();
  }

  private async ensureEngine(): Promise<WebHapticsInstance | null> {
    if (!canUseDOM()) return null;
    if (this.engine) return this.engine;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = import("web-haptics")
      .then((module) => {
        const next = new module.WebHaptics({
          showSwitch: false,
        });
        this.engine = next;
        return next;
      })
      .catch(() => null)
      .finally(() => {
        this.loadPromise = null;
      });

    return this.loadPromise;
  }

  private canTriggerNow() {
    if (!canUseDOM()) return false;
    if (!this.enabled) return false;
    if (shouldSkipByReducedMotion()) return false;

    const now = Date.now();
    if (now - this.lastTriggerAt < TRIGGER_COOLDOWN_MS) {
      return false;
    }
    this.lastTriggerAt = now;
    return true;
  }

  private triggerFallback(preset: AppHapticPreset) {
    if (!hasVibrationAPI()) return false;
    const pattern = FALLBACK_PATTERNS[preset];
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }

  async trigger(input: AppHapticInput = DEFAULT_PRESET) {
    if (!this.canTriggerNow()) return false;
    const payload: HapticInput = input;
    const engine = await this.ensureEngine();
    if (engine) {
      try {
        await engine.trigger(payload);
        return true;
      } catch {
        // Fall back to plain vibration patterns if library triggering fails.
      }
    }
    if (typeof payload === "string" && payload in FALLBACK_PATTERNS) {
      return this.triggerFallback(payload as AppHapticPreset);
    }
    return false;
  }

  cancel() {
    if (this.engine) {
      this.engine.cancel();
    } else if (hasVibrationAPI()) {
      navigator.vibrate(0);
    }
  }
}

export const appHaptics = new AppHapticsEngine();
