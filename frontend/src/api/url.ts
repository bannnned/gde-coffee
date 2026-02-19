type ViteLikeMeta = {
  env?: {
    VITE_API_BASE_URL?: string;
  };
};

const API_BASE_URL = String(
  (import.meta as ViteLikeMeta).env?.VITE_API_BASE_URL ?? "",
).replace(/\/$/, "");

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function buildApiUrl(path: string): string {
  if (!API_BASE_URL) return path;
  if (!path) return API_BASE_URL;
  return path.startsWith("/") ? `${API_BASE_URL}${path}` : `${API_BASE_URL}/${path}`;
}

export function buildOAuthStartUrl(provider: "github" | "yandex"): string {
  return buildApiUrl(`/api/auth/${provider}/start`);
}

export function buildOAuthLinkUrl(provider: "github" | "yandex"): string {
  return buildApiUrl(`/api/auth/${provider}/link/start`);
}
