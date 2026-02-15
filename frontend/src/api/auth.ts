import { http } from "./http";

export type AuthUser = {
  id?: string;
  email?: string;
  displayName?: string;
  name?: string;
  emailVerifiedAt?: string | null;
  avatarUrl?: string | null;
  role?: string;
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

function normalizeUser(data: any): AuthUser {
  const raw = data?.user ?? data ?? {};
  const displayName = raw.display_name ?? raw.displayName ?? raw.name;
  const name = raw.name ?? raw.display_name ?? raw.displayName;
  return {
    id: raw.id,
    email: raw.email,
    name,
    displayName,
    emailVerifiedAt:
      raw.email_verified_at ?? raw.emailVerifiedAt ?? raw.email_verified ?? null,
    avatarUrl: raw.avatar_url ?? raw.avatarUrl ?? raw.avatar ?? null,
    role: typeof raw.role === "string" ? raw.role : undefined,
  };
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

export async function getIdentities(): Promise<AuthIdentity[]> {
  const res = await http.get("/api/auth/identities");
  const data = res.data;
  if (Array.isArray(data)) return data as AuthIdentity[];
  if (Array.isArray(data?.identities)) return data.identities as AuthIdentity[];
  return [];
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

function buildApiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
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
