import { getApiBaseUrl } from "../api/url";

export function resolveAvatarUrl(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
  const base = getApiBaseUrl();
  if (!base) return avatarUrl;
  if (avatarUrl.startsWith("/")) return `${base}${avatarUrl}`;
  return `${base}/${avatarUrl}`;
}
