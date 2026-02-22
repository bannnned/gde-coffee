export type Amenity =
  | "wifi"
  | "power"
  | "quiet"
  | "toilet"
  | "laptop";

export type CafePhotoKind = "cafe" | "menu";

export type CafePhoto = {
  id: string;
  url: string;
  kind: CafePhotoKind;
  is_cover: boolean;
  position: number;
};

export type Cafe = {
  id: string;
  name: string;
  address: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  amenities: Amenity[];
  distance_m: number;
  is_favorite: boolean;
  cover_photo_url?: string | null;
  photos?: CafePhoto[];
};
