export type PaletteCategory =
  | "brand"
  | "background"
  | "surface"
  | "text"
  | "border"
  | "effect"
  | "status"
  | "map";

export const PALETTE_CATEGORY_GUIDE: Record<PaletteCategory, string> = {
  brand: "Брендовые акценты, CTA и активные состояния",
  background: "Основной фон приложения и фоновые пятна/градиенты",
  surface: "Карточки, стеклянные панели, модалки, overlay",
  text: "Основной, приглушенный и инвертированный текст",
  border: "Границы элементов и разделители",
  effect: "Тени, glow и hover/attention эффекты",
  status: "Семантические цвета (success/warning/error/info)",
  map: "Цвета маркеров и подписей на карте",
};

type PaletteTokens = {
  brandAccent: string;
  brandAccentSoft: string;
  brandAccentStrong: string;
  onAccent: string;

  bgBase: string;
  bgAccent1: string;
  bgAccent2: string;

  cardBg: string;
  surfaceBg: string;
  overlaySoft: string;
  overlayStrong: string;

  textPrimary: string;
  textMuted: string;
  textInverse: string;

  borderSoft: string;
  borderStrong: string;
  glassBorder: string;

  glassBg: string;
  glassShadow: string;
  glassGrad1: string;
  glassGrad2: string;
  glassGradHover1: string;
  glassGradHover2: string;

  shadowLg: string;
  attentionRing: string;
  attentionGlow: string;

  statusSuccess: string;
  statusWarning: string;
  statusError: string;
  statusInfo: string;

  mapUserMarker: string;
  mapCafeMarker: string;
  mapLabelText: string;
  mapLabelHalo: string;
};

type PaletteSet = {
  label: string;
  light: PaletteTokens;
  dark: PaletteTokens;
};

export const APP_PALETTES = {
  coffee: {
    label: "Coffee House",
    light: {
      brandAccent: "#FF6A3D",
      brandAccentSoft: "rgba(255, 106, 61, 0.24)",
      brandAccentStrong: "#E5572E",
      onAccent: "#FFF8F2",

      bgBase: "#FFF8F2",
      bgAccent1: "rgba(255, 106, 61, 0.16)",
      bgAccent2: "rgba(255, 200, 87, 0.2)",

      cardBg: "#FFFFFF",
      surfaceBg: "rgba(255, 255, 255, 0.76)",
      overlaySoft: "rgba(31, 26, 23, 0.1)",
      overlayStrong: "rgba(31, 26, 23, 0.34)",

      textPrimary: "#1F1A17",
      textMuted: "#6B625C",
      textInverse: "#FFF8F2",

      borderSoft: "rgba(31, 26, 23, 0.12)",
      borderStrong: "rgba(255, 255, 255, 0.82)",
      glassBorder: "rgba(255, 255, 255, 0.78)",

      glassBg: "rgba(255, 255, 255, 0.68)",
      glassShadow: "0 12px 30px rgba(31, 26, 23, 0.14)",
      glassGrad1: "rgba(255, 255, 255, 0.96)",
      glassGrad2: "rgba(255, 248, 242, 0.72)",
      glassGradHover1: "rgba(255, 255, 255, 0.99)",
      glassGradHover2: "rgba(255, 248, 242, 0.82)",

      shadowLg: "0 18px 40px rgba(31, 26, 23, 0.16)",
      attentionRing: "rgba(255, 106, 61, 0.42)",
      attentionGlow: "rgba(255, 106, 61, 0.28)",

      statusSuccess: "#22C7A6",
      statusWarning: "#FFC857",
      statusError: "#E24A4A",
      statusInfo: "#0E7C86",

      mapUserMarker: "#FFFFFF",
      mapCafeMarker: "#FF6A3D",
      mapLabelText: "#1F1A17",
      mapLabelHalo: "rgba(255, 248, 242, 0.9)",
    },
    dark: {
      brandAccent: "#FF7D57",
      brandAccentSoft: "rgba(255, 125, 87, 0.3)",
      brandAccentStrong: "#FF9A78",
      onAccent: "#2B1712",

      bgBase: "#1D1715",
      bgAccent1: "rgba(255, 106, 61, 0.24)",
      bgAccent2: "rgba(14, 124, 134, 0.18)",

      cardBg: "rgba(255, 248, 242, 0.08)",
      surfaceBg: "rgba(255, 248, 242, 0.06)",
      overlaySoft: "rgba(22, 16, 14, 0.5)",
      overlayStrong: "rgba(22, 16, 14, 0.68)",

      textPrimary: "#FFF8F2",
      textMuted: "rgba(226, 213, 205, 0.78)",
      textInverse: "#1D1715",

      borderSoft: "rgba(255, 248, 242, 0.16)",
      borderStrong: "rgba(255, 248, 242, 0.22)",
      glassBorder: "rgba(255, 248, 242, 0.16)",

      glassBg: "rgba(24, 18, 16, 0.72)",
      glassShadow: "0 12px 30px rgba(0, 0, 0, 0.62)",
      glassGrad1: "rgba(29, 23, 21, 0.9)",
      glassGrad2: "rgba(29, 23, 21, 0.56)",
      glassGradHover1: "rgba(29, 23, 21, 0.98)",
      glassGradHover2: "rgba(29, 23, 21, 0.66)",

      shadowLg: "0 18px 40px rgba(0, 0, 0, 0.62)",
      attentionRing: "rgba(255, 125, 87, 0.5)",
      attentionGlow: "rgba(255, 125, 87, 0.34)",

      statusSuccess: "#2ED9B5",
      statusWarning: "#FFD36E",
      statusError: "#FF7A7A",
      statusInfo: "#45B8C1",

      mapUserMarker: "#FFF8F2",
      mapCafeMarker: "#FF7D57",
      mapLabelText: "#FFF8F2",
      mapLabelHalo: "rgba(24, 18, 16, 0.92)",
    },
  },
  matcha: {
    label: "Matcha Studio",
    light: {
      brandAccent: "#3f7a4a",
      brandAccentSoft: "rgba(63, 122, 74, 0.28)",
      brandAccentStrong: "#2f5e38",
      onAccent: "#f6fff3",
      bgBase: "#e7efd9",
      bgAccent1: "rgba(63, 122, 74, 0.18)",
      bgAccent2: "rgba(246, 255, 243, 0.32)",
      cardBg: "#f6fff3",
      surfaceBg: "rgba(246, 255, 243, 0.72)",
      overlaySoft: "rgba(25, 35, 27, 0.12)",
      overlayStrong: "rgba(25, 35, 27, 0.35)",
      textPrimary: "#1d2b1f",
      textMuted: "rgba(29, 43, 31, 0.66)",
      textInverse: "#f6fff3",
      borderSoft: "rgba(29, 43, 31, 0.12)",
      borderStrong: "rgba(246, 255, 243, 0.8)",
      glassBorder: "rgba(246, 255, 243, 0.75)",
      glassBg: "rgba(246, 255, 243, 0.64)",
      glassShadow: "0 12px 30px rgba(29, 43, 31, 0.14)",
      glassGrad1: "rgba(246, 255, 243, 0.95)",
      glassGrad2: "rgba(246, 255, 243, 0.66)",
      glassGradHover1: "rgba(246, 255, 243, 0.98)",
      glassGradHover2: "rgba(246, 255, 243, 0.76)",
      shadowLg: "0 18px 40px rgba(29, 43, 31, 0.15)",
      attentionRing: "rgba(63, 122, 74, 0.42)",
      attentionGlow: "rgba(63, 122, 74, 0.28)",
      statusSuccess: "#2b8a3e",
      statusWarning: "#d97706",
      statusError: "#c92a2a",
      statusInfo: "#0c8599",
      mapUserMarker: "#f6fff3",
      mapCafeMarker: "#3f7a4a",
      mapLabelText: "#1d2b1f",
      mapLabelHalo: "rgba(246, 255, 243, 0.9)",
    },
    dark: {
      brandAccent: "#68b477",
      brandAccentSoft: "rgba(104, 180, 119, 0.28)",
      brandAccentStrong: "#86cc94",
      onAccent: "#132018",
      bgBase: "#141a14",
      bgAccent1: "rgba(104, 180, 119, 0.22)",
      bgAccent2: "rgba(231, 239, 217, 0.12)",
      cardBg: "rgba(246, 255, 243, 0.07)",
      surfaceBg: "rgba(246, 255, 243, 0.05)",
      overlaySoft: "rgba(20, 26, 20, 0.45)",
      overlayStrong: "rgba(20, 26, 20, 0.65)",
      textPrimary: "#f6fff3",
      textMuted: "rgba(246, 255, 243, 0.7)",
      textInverse: "#141a14",
      borderSoft: "rgba(246, 255, 243, 0.16)",
      borderStrong: "rgba(246, 255, 243, 0.18)",
      glassBorder: "rgba(246, 255, 243, 0.14)",
      glassBg: "rgba(20, 26, 20, 0.72)",
      glassShadow: "0 12px 30px rgba(0, 0, 0, 0.58)",
      glassGrad1: "rgba(20, 26, 20, 0.88)",
      glassGrad2: "rgba(20, 26, 20, 0.52)",
      glassGradHover1: "rgba(20, 26, 20, 0.96)",
      glassGradHover2: "rgba(20, 26, 20, 0.62)",
      shadowLg: "0 18px 40px rgba(0, 0, 0, 0.62)",
      attentionRing: "rgba(104, 180, 119, 0.5)",
      attentionGlow: "rgba(104, 180, 119, 0.32)",
      statusSuccess: "#40c057",
      statusWarning: "#ffd43b",
      statusError: "#ff6b6b",
      statusInfo: "#66d9e8",
      mapUserMarker: "#f6fff3",
      mapCafeMarker: "#68b477",
      mapLabelText: "#f6fff3",
      mapLabelHalo: "rgba(20, 26, 20, 0.92)",
    },
  },
  terracotta: {
    label: "Terracotta Roast",
    light: {
      brandAccent: "#b85c38",
      brandAccentSoft: "rgba(184, 92, 56, 0.28)",
      brandAccentStrong: "#8f4428",
      onAccent: "#fff7f1",
      bgBase: "#f0d8c8",
      bgAccent1: "rgba(184, 92, 56, 0.18)",
      bgAccent2: "rgba(255, 247, 241, 0.35)",
      cardBg: "#fff7f1",
      surfaceBg: "rgba(255, 247, 241, 0.72)",
      overlaySoft: "rgba(37, 24, 20, 0.12)",
      overlayStrong: "rgba(37, 24, 20, 0.35)",
      textPrimary: "#251814",
      textMuted: "rgba(37, 24, 20, 0.66)",
      textInverse: "#fff7f1",
      borderSoft: "rgba(37, 24, 20, 0.12)",
      borderStrong: "rgba(255, 247, 241, 0.8)",
      glassBorder: "rgba(255, 247, 241, 0.75)",
      glassBg: "rgba(255, 247, 241, 0.66)",
      glassShadow: "0 12px 30px rgba(37, 24, 20, 0.15)",
      glassGrad1: "rgba(255, 247, 241, 0.95)",
      glassGrad2: "rgba(255, 247, 241, 0.67)",
      glassGradHover1: "rgba(255, 247, 241, 0.98)",
      glassGradHover2: "rgba(255, 247, 241, 0.76)",
      shadowLg: "0 18px 40px rgba(37, 24, 20, 0.17)",
      attentionRing: "rgba(184, 92, 56, 0.42)",
      attentionGlow: "rgba(184, 92, 56, 0.28)",
      statusSuccess: "#2f9e44",
      statusWarning: "#f08c00",
      statusError: "#e03131",
      statusInfo: "#1c7ed6",
      mapUserMarker: "#fff7f1",
      mapCafeMarker: "#b85c38",
      mapLabelText: "#251814",
      mapLabelHalo: "rgba(255, 247, 241, 0.9)",
    },
    dark: {
      brandAccent: "#d08260",
      brandAccentSoft: "rgba(208, 130, 96, 0.28)",
      brandAccentStrong: "#e6a283",
      onAccent: "#24140e",
      bgBase: "#1c1513",
      bgAccent1: "rgba(208, 130, 96, 0.22)",
      bgAccent2: "rgba(240, 216, 200, 0.14)",
      cardBg: "rgba(255, 247, 241, 0.07)",
      surfaceBg: "rgba(255, 247, 241, 0.05)",
      overlaySoft: "rgba(28, 21, 19, 0.45)",
      overlayStrong: "rgba(28, 21, 19, 0.66)",
      textPrimary: "#fff7f1",
      textMuted: "rgba(255, 247, 241, 0.72)",
      textInverse: "#1c1513",
      borderSoft: "rgba(255, 247, 241, 0.16)",
      borderStrong: "rgba(255, 247, 241, 0.18)",
      glassBorder: "rgba(255, 247, 241, 0.14)",
      glassBg: "rgba(28, 21, 19, 0.72)",
      glassShadow: "0 12px 30px rgba(0, 0, 0, 0.62)",
      glassGrad1: "rgba(28, 21, 19, 0.88)",
      glassGrad2: "rgba(28, 21, 19, 0.52)",
      glassGradHover1: "rgba(28, 21, 19, 0.96)",
      glassGradHover2: "rgba(28, 21, 19, 0.62)",
      shadowLg: "0 18px 40px rgba(0, 0, 0, 0.62)",
      attentionRing: "rgba(208, 130, 96, 0.5)",
      attentionGlow: "rgba(208, 130, 96, 0.32)",
      statusSuccess: "#51cf66",
      statusWarning: "#ffd43b",
      statusError: "#ff8787",
      statusInfo: "#74c0fc",
      mapUserMarker: "#fff7f1",
      mapCafeMarker: "#d08260",
      mapLabelText: "#fff7f1",
      mapLabelHalo: "rgba(28, 21, 19, 0.92)",
    },
  },
} as const satisfies Record<string, PaletteSet>;

export type PaletteName = keyof typeof APP_PALETTES;
export type PaletteSchemeName = "light" | "dark";

export const PALETTE_STORAGE_KEY = "coffeeQuest.palette";
export const DEFAULT_PALETTE: PaletteName = "coffee";

function toCssVariables(tokens: PaletteTokens) {
  return {
    "--color-brand-accent": tokens.brandAccent,
    "--color-brand-accent-soft": tokens.brandAccentSoft,
    "--color-brand-accent-strong": tokens.brandAccentStrong,
    "--color-on-accent": tokens.onAccent,

    "--color-bg-base": tokens.bgBase,
    "--color-bg-accent-1": tokens.bgAccent1,
    "--color-bg-accent-2": tokens.bgAccent2,

    "--color-surface-card": tokens.cardBg,
    "--color-surface-main": tokens.surfaceBg,
    "--color-surface-overlay-soft": tokens.overlaySoft,
    "--color-surface-overlay-strong": tokens.overlayStrong,

    "--color-text-primary": tokens.textPrimary,
    "--color-text-muted": tokens.textMuted,
    "--color-text-inverse": tokens.textInverse,

    "--color-border-soft": tokens.borderSoft,
    "--color-border-strong": tokens.borderStrong,
    "--color-border-glass": tokens.glassBorder,

    "--color-glass-bg": tokens.glassBg,
    "--color-glass-shadow": tokens.glassShadow,
    "--color-glass-grad-1": tokens.glassGrad1,
    "--color-glass-grad-2": tokens.glassGrad2,
    "--color-glass-grad-hover-1": tokens.glassGradHover1,
    "--color-glass-grad-hover-2": tokens.glassGradHover2,

    "--color-shadow-lg": tokens.shadowLg,
    "--color-attention-ring": tokens.attentionRing,
    "--color-attention-glow": tokens.attentionGlow,

    "--color-status-success": tokens.statusSuccess,
    "--color-status-warning": tokens.statusWarning,
    "--color-status-error": tokens.statusError,
    "--color-status-info": tokens.statusInfo,

    "--color-map-user-marker": tokens.mapUserMarker,
    "--color-map-cafe-marker": tokens.mapCafeMarker,
    "--color-map-label-text": tokens.mapLabelText,
    "--color-map-label-halo": tokens.mapLabelHalo,

    // Backward-compatible app variables currently used in CSS.
    "--coffee": tokens.bgBase,
    "--emerald": tokens.brandAccent,
    "--ink": tokens.textPrimary,
    "--cream": tokens.textInverse,

    "--bg": tokens.bgBase,
    "--card": tokens.cardBg,
    "--surface": tokens.surfaceBg,
    "--border": tokens.borderSoft,
    "--text": tokens.textPrimary,
    "--muted": tokens.textMuted,
    "--accent": tokens.brandAccent,
    "--shadow": tokens.shadowLg,
    "--glass-bg": tokens.glassBg,
    "--glass-border": tokens.glassBorder,
    "--glass-shadow": tokens.glassShadow,
    "--glass-grad-1": tokens.glassGrad1,
    "--glass-grad-2": tokens.glassGrad2,
    "--glass-grad-hover-1": tokens.glassGradHover1,
    "--glass-grad-hover-2": tokens.glassGradHover2,
    "--bg-accent-1": tokens.bgAccent1,
    "--bg-accent-2": tokens.bgAccent2,
    "--mantine-color-text": tokens.textPrimary,
    "--mantine-color-dimmed": tokens.textMuted,

    "--attention-ring": tokens.attentionRing,
    "--attention-glow": tokens.attentionGlow,
  } as const;
}

export function getStoredPalette(): PaletteName {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  const raw = window.localStorage.getItem(PALETTE_STORAGE_KEY);
  if (!raw) return DEFAULT_PALETTE;
  if (raw in APP_PALETTES) return raw as PaletteName;
  return DEFAULT_PALETTE;
}

export function setStoredPalette(name: PaletteName) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PALETTE_STORAGE_KEY, name);
}

export function listPalettes() {
  return (Object.keys(APP_PALETTES) as PaletteName[]).map((name) => ({
    name,
    label: APP_PALETTES[name].label,
  }));
}

export function applyPalette(name: PaletteName, scheme: PaletteSchemeName) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const palette = APP_PALETTES[name] ?? APP_PALETTES[DEFAULT_PALETTE];
  const vars = toCssVariables(palette[scheme]);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.setAttribute("data-app-palette", name);
}
