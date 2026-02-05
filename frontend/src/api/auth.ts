import { http } from "./http";

export type AuthUser = {
  id?: string;
  email?: string;
  displayName?: string;
  name?: string;
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

function normalizeUser(data: any): AuthUser {
  const raw = data?.user ?? data ?? {};
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name ?? raw.displayName,
    displayName: raw.displayName ?? raw.name,
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
