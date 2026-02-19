import useDiscoveryCafes from "../../discovery/hooks/useCafes";
import type { Amenity as DiscoveryAmenity } from "../../discovery/types";

import type { Amenity, Cafe } from "../types";

type UseCafesParams = {
  lat: number;
  lng: number;
  radiusM: number;
  amenities: Amenity[];
};

export default function useCafes({
  lat,
  lng,
  radiusM,
  amenities,
}: UseCafesParams) {
  const { cafes: discoveryCafes, cafesQuery, showFetchingBadge } = useDiscoveryCafes({
    lat,
    lng,
    radiusM,
    amenities: amenities as DiscoveryAmenity[],
  });

  const cafes: Cafe[] = discoveryCafes.map((cafe) => ({
    id: cafe.id,
    name: cafe.name,
    address: cafe.address,
    latitude: cafe.latitude,
    longitude: cafe.longitude,
    amenities: cafe.amenities,
    distance_m: cafe.distance_m,
    work_score: 0,
  }));

  return { cafes, cafesQuery, showFetchingBadge };
}
