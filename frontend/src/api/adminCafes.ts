import { http } from "./http";

export type AdminCafeImportItem = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  description?: string;
  amenities?: string[];
};

export type AdminCafeImportPayload = {
  mode?: "skip_existing" | "upsert";
  dry_run?: boolean;
  cafes: AdminCafeImportItem[];
};

export type AdminCafeImportResult = {
  index: number;
  status: string;
  name: string;
  address: string;
  cafe_id?: string;
  message?: string;
};

export type AdminCafeImportIssue = {
  index: number;
  field?: string;
  message: string;
};

export type AdminCafeImportResponse = {
  mode: string;
  dry_run: boolean;
  summary: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    invalid: number;
    failed: number;
  };
  results: AdminCafeImportResult[];
  issues?: AdminCafeImportIssue[];
};

export type AdminCafeSearchItem = {
  id: string;
  name: string;
  address: string;
};

export type AdminCafeDetails = {
  id: string;
  name: string;
  address: string;
  description: string;
  latitude: number;
  longitude: number;
  amenities: string[];
};

export async function importAdminCafesJSON(
  payload: AdminCafeImportPayload,
): Promise<AdminCafeImportResponse> {
  const res = await http.post<AdminCafeImportResponse>("/api/admin/cafes/import-json", payload);
  return res.data;
}

export async function searchAdminCafesByName(query: string, limit = 12): Promise<AdminCafeSearchItem[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  const res = await http.get<{ items?: AdminCafeSearchItem[] }>("/api/admin/cafes/search", {
    params: {
      q,
      limit,
    },
  });

  const items = Array.isArray(res.data?.items) ? res.data.items : [];
  return items.filter((item) => Boolean(item?.id && item?.name));
}

export async function getAdminCafeByID(cafeId: string): Promise<AdminCafeDetails> {
  const res = await http.get<AdminCafeDetails>(`/api/admin/cafes/${encodeURIComponent(cafeId)}`);
  return res.data;
}

export async function updateAdminCafeByID(
  cafeId: string,
  payload: AdminCafeImportItem,
): Promise<AdminCafeDetails> {
  const res = await http.patch<AdminCafeDetails>(
    `/api/admin/cafes/${encodeURIComponent(cafeId)}`,
    payload,
  );
  return res.data;
}

export async function deleteAdminCafeByID(cafeId: string): Promise<{ deleted: boolean; id: string }> {
  const res = await http.delete<{ deleted: boolean; id: string }>(
    `/api/admin/cafes/${encodeURIComponent(cafeId)}`,
  );
  return res.data;
}
