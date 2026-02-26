export function getDiscoveryGlassButtonStyles(active = false) {
  return {
    root: {
      minHeight: 36,
      borderRadius: 12,
      paddingInline: 14,
      fontWeight: 600,
      background: active
        ? "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 86%, var(--surface)), color-mix(in srgb, var(--color-brand-accent) 22%, var(--surface)))"
        : "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
      border: active ? "1px solid var(--accent)" : "1px solid var(--glass-border)",
      color: "var(--text)",
      boxShadow: active ? "0 8px 20px var(--attention-glow)" : "var(--glass-shadow)",
      backdropFilter: "blur(16px) saturate(180%)",
      WebkitBackdropFilter: "blur(16px) saturate(180%)",
      transition:
        "transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-base) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)",
    },
  } as const;
}

export function getDiscoveryRadiusPresetButtonStyles(active = false) {
  return {
    root: {
      minHeight: 34,
      borderRadius: 999,
      paddingInline: 12,
      fontWeight: 650,
      letterSpacing: "0.01em",
      border: active
        ? "1px solid color-mix(in srgb, var(--color-brand-accent) 72%, var(--glass-border))"
        : "1px solid var(--glass-border)",
      background: active
        ? "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent) 90%, #ff5e32), color-mix(in srgb, var(--color-brand-accent-strong) 92%, #ef4520))"
        : "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
      color: active ? "var(--color-on-accent)" : "var(--text)",
      boxShadow: active
        ? "0 10px 24px color-mix(in srgb, var(--color-brand-accent-soft) 56%, transparent)"
        : "var(--glass-shadow)",
      backdropFilter: "blur(16px) saturate(180%)",
      WebkitBackdropFilter: "blur(16px) saturate(180%)",
      transition:
        "transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-base) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)",
    },
    label: {
      lineHeight: 1.1,
    },
  } as const;
}

export const discoveryGlassActionIconStyles = {
  root: {
    borderRadius: 999,
    border: "1px solid var(--glass-border)",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--glass-grad-1) 94%, transparent), color-mix(in srgb, var(--glass-grad-2) 86%, transparent))",
    color: "var(--text)",
    boxShadow: "var(--glass-shadow)",
  },
} as const;

export const discoveryGlassSelectStyles = {
  input: {
    minHeight: 40,
    borderRadius: 12,
    paddingInline: 12,
    fontWeight: 500,
    border: "1px solid var(--glass-border)",
    background: "linear-gradient(135deg, color-mix(in srgb, var(--surface) 82%, var(--bg)), color-mix(in srgb, var(--surface) 72%, var(--glass-grad-1)))",
    boxShadow: "var(--glass-shadow)",
    color: "var(--text)",
    backdropFilter: "blur(16px) saturate(180%)",
    WebkitBackdropFilter: "blur(16px) saturate(180%)",
    transition:
      "box-shadow var(--duration-base) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)",
  },
  dropdown: {
    borderRadius: 12,
    border: "1px solid var(--glass-border)",
    background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 92%, var(--surface)), color-mix(in srgb, var(--bg) 86%, var(--glass-grad-1)))",
    boxShadow: "var(--shadow)",
    backdropFilter: "blur(12px) saturate(150%)",
    WebkitBackdropFilter: "blur(12px) saturate(150%)",
  },
  option: {
    borderRadius: 8,
    color: "var(--text)",
    "&[data-checked]": {
      background: "color-mix(in srgb, var(--color-brand-accent-soft) 82%, var(--surface))",
      color: "var(--text)",
    },
    "&[data-hovered]": {
      background: "color-mix(in srgb, var(--color-brand-accent-soft) 62%, var(--surface))",
    },
  },
} as const;

export function createDiscoveryAmenityChipLabelStyles(fontSize: string | number) {
  return {
    base: {
      boxSizing: "border-box",
      minWidth: 72,
      display: "inline-flex",
      justifyContent: "center",
      alignItems: "center",
      fontWeight: 500,
      fontSize,
      lineHeight: 1,
      letterSpacing: 0,
      transform: "none",
      paddingInline: 10,
      paddingBlock: 8,
      border: "1px solid var(--border)",
      color: "var(--text)",
      backdropFilter: "blur(18px) saturate(180%)",
      WebkitBackdropFilter: "blur(18px) saturate(180%)",
      background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
      boxShadow: "var(--glass-shadow)",
      outline: "none",
      "&:active": {
        transform: "none",
      },
    },
    checked: {
      background: "var(--color-brand-accent-soft)",
      borderColor: "var(--accent)",
      boxShadow: "0 8px 20px var(--attention-glow)",
      transform: "none",
    },
  } as const;
}
