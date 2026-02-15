import { http } from "./http";

type GeocodeResponse = {
  found: boolean;
  latitude?: number;
  longitude?: number;
  display_name?: string;
  provider?: string;
};

export type GeocodeAddressParams = {
  address: string;
  city?: string;
  signal?: AbortSignal;
};

export async function geocodeAddress(
  params: GeocodeAddressParams,
): Promise<GeocodeResponse> {
  const { address, city, signal } = params;
  const res = await http.get<GeocodeResponse>("/api/geocode", {
    signal,
    params: {
      address,
      city: city?.trim() || undefined,
    },
  });
  return res.data;
}
