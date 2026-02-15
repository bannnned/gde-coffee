export type Amenity =
  | "wifi"
  | "power"
  | "quiet"
  | "toilet"
  | "laptop"
  | "robusta"
  | "arabica"
  | "vortex";

export type Cafe = {
  id: string;
  name: string;
  address: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  amenities: Amenity[];
  distance_m: number;
  cover_photo_url?: string | null;
  photos?: CafePhoto[];
};

export type CafePhotoKind = "cafe" | "menu";

export type CafePhoto = {
  id: string;
  url: string;
  kind: CafePhotoKind;
  is_cover: boolean;
  position: number;
};
