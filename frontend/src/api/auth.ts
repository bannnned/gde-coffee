import { http } from "./http";
import { uploadByPresignedUrl } from "./presignedUpload";
import { buildApiUrl } from "./url";

export type AuthUser = {
  id?: string;
  email?: string;
  displayName?: string;
  name?: string;
  emailVerifiedAt?: string | null;
  avatarUrl?: string | null;
  role?: string;
  reputationBadge?: string;
  trustedParticipant?: boolean;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  displayName: string;
};

export type EmailChangeRequestPayload = {
  newEmail: string;
  currentPassword: string;
};

export type PasswordResetConfirmPayload = {
  token: string;
  newPassword: string;
};

export type UpdateProfileNamePayload = {
  displayName: string;
};

export type ProfileAvatarPresignPayload = {
  contentType: string;
  sizeBytes: number;
};

export type ProfileAvatarPresignResponse = {
  upload_url: string;
  method: string;
  headers: Record<string, string>;
  object_key: string;
  file_url: string;
  expires_at: string;
};

export type AuthIdentity = {
  id?: string;
  provider?: string;
  type?: string;
  name?: string;
  [key: string]: unknown;
};

export type TelegramFlow = "login" | "link";

export type TelegramStartResponse = {
  state: string;
};

export type TelegramConfigResponse = {
  bot_username?: string;
};

export type TelegramCallbackPayload = {
  state: string;
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

type AuthRawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AuthRawRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): AuthRawRecord {
  return isRecord(value) ? value : {};
}

function pickString(record: AuthRawRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

function normalizeUser(data: unknown): AuthUser {
  const payload = asRecord(data);
  const raw = asRecord(payload.user ?? payload);
  const emailVerifiedRaw = raw.email_verified_at ?? raw.emailVerifiedAt ?? raw.email_verified;
  const emailVerifiedAt =
    typeof emailVerifiedRaw === "string"
      ? emailVerifiedRaw
      : emailVerifiedRaw === true
        ? "true"
        : null;

  return {
    id: pickString(raw, "id"),
    email: pickString(raw, "email"),
    name: pickString(raw, "name", "display_name", "displayName"),
    displayName: pickString(raw, "display_name", "displayName", "name"),
    emailVerifiedAt,
    avatarUrl: pickString(raw, "avatar_url", "avatarUrl", "avatar") ?? null,
    role: typeof raw.role === "string" ? raw.role : undefined,
    reputationBadge:
      typeof raw.reputation_badge === "string" ? raw.reputation_badge : undefined,
    trustedParticipant:
      typeof raw.trusted_participant === "boolean" ? raw.trusted_participant : false,
  };
}

function normalizeIdentity(value: unknown): AuthIdentity | null {
  if (!isRecord(value)) return null;
  const out: AuthIdentity = {};
  if (typeof value.id === "string") out.id = value.id;
  if (typeof value.provider === "string") out.provider = value.provider;
  if (typeof value.type === "string") out.type = value.type;
  if (typeof value.name === "string") out.name = value.name;
  for (const [key, fieldValue] of Object.entries(value)) {
    if (key === "id" || key === "provider" || key === "type" || key === "name") continue;
    out[key] = fieldValue;
  }
  return out;
}

export async function me(): Promise<AuthUser> {
  const res = await http.get("/api/auth/me");
  return normalizeUser(res.data);
}

export async function login(payload: LoginPayload): Promise<AuthUser> {
  const res = await http.post("/api/auth/login", payload);
  return normalizeUser(res.data);
}

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const res = await http.post("/api/auth/register", {
    email: payload.email,
    password: payload.password,
    display_name: payload.displayName,
  });
  return normalizeUser(res.data);
}

export async function logout(): Promise<void> {
  await http.post("/api/auth/logout");
}

export async function requestEmailVerification(): Promise<void> {
  await http.post("/api/auth/email/verify/request");
}

export async function confirmEmailVerification(token: string): Promise<void> {
  await http.get("/api/auth/email/verify/confirm", { params: { token } });
}

export async function requestEmailChange(
  payload: EmailChangeRequestPayload,
): Promise<void> {
  await http.post("/api/account/email/change/request", {
    new_email: payload.newEmail,
    current_password: payload.currentPassword,
  });
}

export async function confirmEmailChange(token: string): Promise<void> {
  await http.get("/api/account/email/change/confirm", { params: { token } });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await http.post("/api/auth/password/reset/request", { email });
}

export async function confirmPasswordReset(
  payload: PasswordResetConfirmPayload,
): Promise<void> {
  await http.post("/api/auth/password/reset/confirm", {
    token: payload.token,
    new_password: payload.newPassword,
  });
}

export async function updateProfileName(
  payload: UpdateProfileNamePayload,
): Promise<AuthUser> {
  const res = await http.patch("/api/account/profile/name", {
    display_name: payload.displayName,
  });
  return normalizeUser(res.data);
}

export async function presignProfileAvatarUpload(
  payload: ProfileAvatarPresignPayload,
): Promise<ProfileAvatarPresignResponse> {
  const res = await http.post<ProfileAvatarPresignResponse>(
    "/api/account/profile/avatar/presign",
    {
      content_type: payload.contentType,
      size_bytes: payload.sizeBytes,
    },
  );
  return res.data;
}

export async function uploadProfileAvatarByPresignedUrl(
  uploadUrl: string,
  file: File,
  headers: Record<string, string>,
): Promise<void> {
  await uploadByPresignedUrl(uploadUrl, file, headers);
}

export async function confirmProfileAvatarUpload(objectKey: string): Promise<AuthUser> {
  const res = await http.post("/api/account/profile/avatar/confirm", {
    object_key: objectKey,
  });
  return normalizeUser(res.data);
}

export async function getIdentities(): Promise<AuthIdentity[]> {
  const res = await http.get<unknown>("/api/auth/identities");
  const data = res.data;
  const root = asRecord(data);
  const list = Array.isArray(data) ? data : Array.isArray(root.identities) ? root.identities : [];
  return list
    .map(normalizeIdentity)
    .filter((identity): identity is AuthIdentity => Boolean(identity));
}

export async function telegramStart(
  flow: TelegramFlow,
): Promise<TelegramStartResponse> {
  const res = await http.post<TelegramStartResponse>("/api/auth/telegram/start", {
    flow,
  });
  return res.data;
}

export async function telegramConfig(): Promise<TelegramConfigResponse> {
  const res = await http.get<TelegramConfigResponse>("/api/auth/telegram/config");
  return res.data ?? {};
}

export async function telegramCallback(
  payload: TelegramCallbackPayload,
): Promise<string> {
  const res = await fetch(buildApiUrl("/api/auth/telegram/callback"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/html;q=0.9",
    },
    body: JSON.stringify(payload),
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`telegram callback failed (${res.status})`);
  }

  // Backend redirects to /login or /settings with oauth=result params.
  return res.url;
}
