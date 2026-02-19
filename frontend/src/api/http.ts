import axios from "axios";

import { getApiBaseUrl } from "./url";

const baseURL = getApiBaseUrl();

type NormalizedApiError = {
  status?: number;
  message: string;
};

type HttpErrorLike = Error & {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  normalized?: NormalizedApiError;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeError(error: unknown): NormalizedApiError {
  if (!isRecord(error)) {
    return { message: "Unknown error" };
  }

  const response = isRecord(error.response) ? error.response : undefined;
  const data = response && isRecord(response.data) ? response.data : undefined;
  const status = typeof response?.status === "number" ? response.status : undefined;
  const message =
    typeof data?.message === "string"
      ? data.message
      : typeof error.message === "string"
        ? error.message
        : "Unknown error";

  return { status, message };
}

function withNormalizedError(error: unknown): HttpErrorLike {
  const baseError: HttpErrorLike =
    error instanceof Error ? (error as HttpErrorLike) : new Error("Unknown error");
  baseError.normalized = normalizeError(baseError);
  return baseError;
}

export const http = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  if (import.meta.env.DEV) {
    // Lightweight debug logging for local troubleshooting.
    console.debug("[http]", config.method?.toUpperCase(), config.url);
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const normalizedError = withNormalizedError(error);
    if (import.meta.env.DEV) {
      console.warn("[http:error]", normalizedError.normalized);
    }
    return Promise.reject(normalizedError);
  },
);
