export function getDiscoveryGlassButtonStyles(active = false) {
  return {
    root: {
      background: active
        ? "var(--color-brand-accent-soft)"
        : "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
      border: active ? "1px solid var(--accent)" : "1px solid var(--glass-border)",
      color: "var(--text)",
      boxShadow: active ? "0 8px 20px var(--attention-glow)" : "var(--glass-shadow)",
      backdropFilter: "blur(16px) saturate(180%)",
      WebkitBackdropFilter: "blur(16px) saturate(180%)",
    },
  } as const;
}

export const discoveryGlassSelectStyles = {
  input: {
    borderRadius: 12,
    border: "1px solid var(--glass-border)",
    background: "color-mix(in srgb, var(--surface) 82%, var(--bg))",
    boxShadow: "var(--glass-shadow)",
    color: "var(--text)",
    backdropFilter: "blur(16px) saturate(180%)",
    WebkitBackdropFilter: "blur(16px) saturate(180%)",
  },
  dropdown: {
    borderRadius: 12,
    border: "1px solid var(--glass-border)",
    background: "color-mix(in srgb, var(--bg) 90%, var(--surface))",
    boxShadow: "var(--shadow)",
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
