import { http } from "./http";

export type GeoScopeParams = {
  lat: number;
  lng: number;
  radius_m: number;
};

export type DiscoveryTag = {
  label: string;
  category: string;
  score: number;
};

export type DiscoveryTagsResponse = {
  source: string;
  tags: DiscoveryTag[];
};

export type TagOptionsResponse = {
  tags: string[];
};

export type TagPreferencesResponse = {
  category: string;
  tags: string[];
};

function normalizeTag(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function getDiscoveryDescriptiveTags(
  params: GeoScopeParams & { limit?: number },
): Promise<DiscoveryTagsResponse> {
  const res = await http.get<DiscoveryTagsResponse>("/api/tags/descriptive/discovery", {
    params: {
      lat: params.lat,
      lng: params.lng,
      radius_m: params.radius_m,
      limit: params.limit,
    },
  });
  const rawTags = Array.isArray(res.data?.tags) ? res.data.tags : [];
  return {
    source: typeof res.data?.source === "string" ? res.data.source : "city_popular",
    tags: rawTags
      .map((item) => ({
        label: normalizeTag(item?.label),
        category: typeof item?.category === "string" ? item.category : "descriptive",
        score: Number.isFinite(item?.score) ? Number(item.score) : 0,
      }))
      .filter((item) => item.label !== ""),
  };
}

export async function getDescriptiveTagOptions(
  params: GeoScopeParams & { q?: string; limit?: number },
): Promise<TagOptionsResponse> {
  const res = await http.get<TagOptionsResponse>("/api/tags/descriptive/options", {
    params: {
      lat: params.lat,
      lng: params.lng,
      radius_m: params.radius_m,
      q: params.q?.trim() || undefined,
      limit: params.limit,
    },
  });
  const values = Array.isArray(res.data?.tags) ? res.data.tags : [];
  return {
    tags: values.map(normalizeTag).filter((value) => value !== ""),
  };
}

export async function getMyDescriptiveTagPreferences(
  scope: GeoScopeParams,
): Promise<TagPreferencesResponse> {
  const res = await http.get<TagPreferencesResponse>("/api/tags/descriptive/preferences", {
    params: {
      lat: scope.lat,
      lng: scope.lng,
      radius_m: scope.radius_m,
    },
  });
  const values = Array.isArray(res.data?.tags) ? res.data.tags : [];
  return {
    category: typeof res.data?.category === "string" ? res.data.category : "descriptive",
    tags: values.map(normalizeTag).filter((value) => value !== ""),
  };
}

export async function updateMyDescriptiveTagPreferences(
  scope: GeoScopeParams,
  tags: string[],
): Promise<TagPreferencesResponse> {
  const res = await http.put<TagPreferencesResponse>(
    "/api/tags/descriptive/preferences",
    {
      tags,
    },
    {
      params: {
        lat: scope.lat,
        lng: scope.lng,
        radius_m: scope.radius_m,
      },
    },
  );
  const values = Array.isArray(res.data?.tags) ? res.data.tags : [];
  return {
    category: typeof res.data?.category === "string" ? res.data.category : "descriptive",
    tags: values.map(normalizeTag).filter((value) => value !== ""),
  };
}
