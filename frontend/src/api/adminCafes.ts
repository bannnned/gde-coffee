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

export async function importAdminCafesJSON(
  payload: AdminCafeImportPayload,
): Promise<AdminCafeImportResponse> {
  const res = await http.post<AdminCafeImportResponse>("/api/admin/cafes/import-json", payload);
  return res.data;
}
