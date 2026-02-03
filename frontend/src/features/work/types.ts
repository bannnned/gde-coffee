export type Amenity = "wifi" | "power" | "quiet" | "toilet" | "laptop";

export type Cafe = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  amenities: Amenity[];
  distance_m: number;
  work_score: number;
};

export type SortBy = "distance" | "work";
