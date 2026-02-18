const OPTIMIZED_MARKER = "/optimized/";
const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"] as const;
const SUPPORTED_FORMAT_VARIANTS = ["webp", "avif"] as const;

function splitBaseAndQuery(rawUrl: string): { baseURL: string; querySuffix: string } {
  const trimmed = rawUrl.trim();
  const [base, query = ""] = trimmed.split("?", 2);
  if (!query) {
    return { baseURL: base, querySuffix: "" };
  }
  return { baseURL: base, querySuffix: `?${query}` };
}

function findSupportedExtension(baseURL: string): string | null {
  const lower = baseURL.toLowerCase();
  for (const ext of SUPPORTED_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return baseURL.slice(baseURL.length - ext.length);
    }
  }
  return null;
}

function buildVariantURL(baseURL: string, querySuffix: string, width: number): string | null {
  const ext = findSupportedExtension(baseURL);
  if (!ext) return null;
  const withoutExt = baseURL.slice(0, -ext.length);
  return `${withoutExt}_w${width}${ext}${querySuffix}`;
}

function buildFormatVariantURL(
  baseURL: string,
  querySuffix: string,
  width: number,
  format: string,
): string | null {
  const ext = findSupportedExtension(baseURL);
  if (!ext) return null;
  const normalized = format.trim().toLowerCase();
  if (!SUPPORTED_FORMAT_VARIANTS.includes(normalized as (typeof SUPPORTED_FORMAT_VARIANTS)[number])) {
    return null;
  }
  const withoutExt = baseURL.slice(0, -ext.length);
  return `${withoutExt}_w${width}.${normalized}${querySuffix}`;
}

export function buildCafePhotoSrcSet(rawURL: string | null | undefined, widths: number[]): string | undefined {
  const value = (rawURL ?? "").trim();
  if (!value || !value.includes(OPTIMIZED_MARKER) || widths.length === 0) {
    return undefined;
  }
  const { baseURL, querySuffix } = splitBaseAndQuery(value);
  const sorted = [...new Set(widths.filter((width) => Number.isFinite(width) && width > 0))].sort(
    (a, b) => a - b,
  );
  if (sorted.length === 0) return undefined;

  const items: string[] = [];
  for (const width of sorted) {
    const candidate = buildVariantURL(baseURL, querySuffix, width);
    if (!candidate) continue;
    items.push(`${candidate} ${width}w`);
  }
  return items.length > 0 ? items.join(", ") : undefined;
}

export function buildCafePhotoFormatSrcSet(
  rawURL: string | null | undefined,
  widths: number[],
  format: "webp" | "avif",
): string | undefined {
  const value = (rawURL ?? "").trim();
  if (!value || !value.includes(OPTIMIZED_MARKER) || widths.length === 0) {
    return undefined;
  }
  const { baseURL, querySuffix } = splitBaseAndQuery(value);
  const sorted = [...new Set(widths.filter((width) => Number.isFinite(width) && width > 0))].sort(
    (a, b) => a - b,
  );
  if (sorted.length === 0) return undefined;

  const items: string[] = [];
  for (const width of sorted) {
    const candidate = buildFormatVariantURL(baseURL, querySuffix, width, format);
    if (!candidate) continue;
    items.push(`${candidate} ${width}w`);
  }
  return items.length > 0 ? items.join(", ") : undefined;
}

export type CafePhotoPictureSources = {
  fallbackSrcSet?: string;
  webpSrcSet?: string;
  avifSrcSet?: string;
};

export function buildCafePhotoPictureSources(
  rawURL: string | null | undefined,
  widths: number[],
): CafePhotoPictureSources {
  return {
    fallbackSrcSet: buildCafePhotoSrcSet(rawURL, widths),
    webpSrcSet: buildCafePhotoFormatSrcSet(rawURL, widths, "webp"),
    avifSrcSet: buildCafePhotoFormatSrcSet(rawURL, widths, "avif"),
  };
}
