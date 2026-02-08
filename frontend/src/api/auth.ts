import { http } from "./http";

export type AuthUser = {
  id?: string;
  email?: string;
  displayName?: string;
  name?: string;
  emailVerifiedAt?: string | null;
  avatarUrl?: string | null;
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

export type AuthIdentity = {
  id?: string;
  provider?: string;
  type?: string;
  name?: string;
  [key: string]: unknown;
};

function normalizeUser(data: any): AuthUser {
  const raw = data?.user ?? data ?? {};
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name ?? raw.displayName,
    displayName: raw.displayName ?? raw.name,
    emailVerifiedAt:
      raw.email_verified_at ?? raw.emailVerifiedAt ?? raw.email_verified ?? null,
    avatarUrl: raw.avatar_url ?? raw.avatarUrl ?? raw.avatar ?? null,
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
  const res = await http.post("/api/auth/register", payload);
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

export async function getIdentities(): Promise<AuthIdentity[]> {
  const res = await http.get("/api/auth/identities");
  const data = res.data;
  if (Array.isArray(data)) return data as AuthIdentity[];
  if (Array.isArray(data?.identities)) return data.identities as AuthIdentity[];
  return [];
}
