import type { Cafe } from "../entities/cafe/model/types";
import { http } from "./http";

type FavoriteStatusResponse = {
  cafe_id: string;
  is_favorite: boolean;
};

export async function addCafeToFavorites(cafeId: string): Promise<FavoriteStatusResponse> {
  const res = await http.post<FavoriteStatusResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/favorite`,
  );
  return res.data;
}

export async function removeCafeFromFavorites(cafeId: string): Promise<FavoriteStatusResponse> {
  const res = await http.delete<FavoriteStatusResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/favorite`,
  );
  return res.data;
}

export async function listFavoriteCafes(): Promise<Cafe[]> {
  const res = await http.get<Cafe[]>("/api/account/favorites");
  return Array.isArray(res.data) ? res.data : [];
}
