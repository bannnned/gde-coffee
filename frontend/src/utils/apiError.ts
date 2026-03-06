type ApiErrorPayload = {
  message?: unknown;
};

type ApiErrorResponse = {
  status?: unknown;
  data?: ApiErrorPayload;
};

type ApiErrorNormalized = {
  status?: unknown;
  message?: unknown;
};

type ApiErrorLike = {
  message?: unknown;
  response?: ApiErrorResponse;
  normalized?: ApiErrorNormalized;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asApiError(error: unknown): ApiErrorLike {
  if (!isRecord(error)) return {};
  return error as ApiErrorLike;
}

export function extractApiErrorStatus(error: unknown): number | null {
  const parsed = asApiError(error);
  const responseStatus = parsed.response?.status;
  if (typeof responseStatus === "number") return responseStatus;

  const normalizedStatus = parsed.normalized?.status;
  if (typeof normalizedStatus === "number") return normalizedStatus;

  return null;
}

export function extractApiErrorMessage(error: unknown, fallback: string): string {
  const parsed = asApiError(error);
  const responseMessage = parsed.response?.data?.message;
  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  const normalizedMessage = parsed.normalized?.message;
  if (typeof normalizedMessage === "string" && normalizedMessage.trim()) {
    return normalizedMessage;
  }

  if (typeof parsed.message === "string" && parsed.message.trim()) {
    return parsed.message;
  }

  return fallback;
}
