import type { Amenity, Cafe } from "../types";
import { http } from "./http";

export type GetCafesParams = {
  lat: number;
  lng: number;
  radius_m: number;
  amenities?: Amenity[];
  favoritesOnly?: boolean;
  signal?: AbortSignal;
};

export async function getCafes(params: GetCafesParams): Promise<Cafe[]> {
  const { lat, lng, radius_m, amenities, favoritesOnly, signal } = params;

  const res = await http.get<Cafe[]>("/api/cafes", {
    signal,
    params: {
      lat,
      lng,
      radius_m,
      amenities: amenities?.length ? amenities.join(",") : undefined,
      favorites_only: favoritesOnly ? "true" : undefined,
    },
  });

  return res.data;
}

type UpdateCafeDescriptionResponse = {
  description: string;
};

export async function updateCafeDescription(
  cafeId: string,
  description: string,
): Promise<string> {
  const res = await http.patch<UpdateCafeDescriptionResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/description`,
    { description },
  );
  return (res.data?.description ?? "").trim();
}
