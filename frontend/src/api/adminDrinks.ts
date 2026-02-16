import { http } from "./http";

export type AdminDrink = {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  category: string;
  popularity_rank: number;
  is_active: boolean;
  updated_at: string;
};

export type UnknownDrinkFormat = {
  id: number;
  name: string;
  mentions_count: number;
  first_seen_at: string;
  last_seen_at: string;
  status: "new" | "mapped" | "ignored";
  mapped_drink_id: string;
  notes: string;
  updated_at: string;
};

type ListAdminDrinksResponse = {
  drinks?: AdminDrink[];
};

type ListUnknownDrinksResponse = {
  unknown?: UnknownDrinkFormat[];
};

type DrinkWrapper = {
  drink: AdminDrink;
};

type UnknownWrapper = {
  unknown: UnknownDrinkFormat;
};

export type ListAdminDrinksParams = {
  q?: string;
  includeInactive?: boolean;
  limit?: number;
};

export type CreateAdminDrinkPayload = {
  id?: string;
  name: string;
  aliases?: string[];
  description?: string;
  category?: string;
  popularity_rank?: number;
  is_active?: boolean;
};

export type UpdateAdminDrinkPayload = {
  name?: string;
  aliases?: string[];
  description?: string;
  category?: string;
  popularity_rank?: number;
  is_active?: boolean;
};

export type UnknownStatusFilter = "" | "new" | "mapped" | "ignored";

export type ListUnknownDrinksParams = {
  status?: UnknownStatusFilter;
  limit?: number;
  offset?: number;
};

export async function listAdminDrinks(
  params: ListAdminDrinksParams = {},
): Promise<AdminDrink[]> {
  const res = await http.get<ListAdminDrinksResponse>("/api/admin/drinks", {
    params: {
      q: params.q ?? "",
      include_inactive: params.includeInactive ?? false,
      limit: params.limit,
    },
  });
  if (!Array.isArray(res.data?.drinks)) {
    return [];
  }
  return res.data.drinks;
}

export async function createAdminDrink(
  payload: CreateAdminDrinkPayload,
): Promise<AdminDrink> {
  const res = await http.post<DrinkWrapper>("/api/admin/drinks", payload);
  return res.data.drink;
}

export async function updateAdminDrink(
  id: string,
  payload: UpdateAdminDrinkPayload,
): Promise<AdminDrink> {
  const res = await http.patch<DrinkWrapper>(`/api/admin/drinks/${encodeURIComponent(id)}`, payload);
  return res.data.drink;
}

export async function listUnknownDrinkFormats(
  params: ListUnknownDrinksParams = {},
): Promise<UnknownDrinkFormat[]> {
  const res = await http.get<ListUnknownDrinksResponse>("/api/admin/drinks/unknown", {
    params: {
      status: params.status ?? "",
      limit: params.limit,
      offset: params.offset ?? 0,
    },
  });
  if (!Array.isArray(res.data?.unknown)) {
    return [];
  }
  return res.data.unknown;
}

export async function mapUnknownDrinkFormat(
  id: number,
  payload: { drink_id: string; add_alias?: boolean },
): Promise<UnknownDrinkFormat> {
  const res = await http.post<UnknownWrapper>(
    `/api/admin/drinks/unknown/${encodeURIComponent(String(id))}/map`,
    payload,
  );
  return res.data.unknown;
}

export async function ignoreUnknownDrinkFormat(id: number): Promise<UnknownDrinkFormat> {
  const res = await http.post<UnknownWrapper>(
    `/api/admin/drinks/unknown/${encodeURIComponent(String(id))}/ignore`,
    {},
  );
  return res.data.unknown;
}
