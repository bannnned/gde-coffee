import useDiscoveryGeolocation from "../../discovery/hooks/useGeolocation";

type LngLat = [number, number];

export default function useGeolocation(initialCenter: LngLat) {
  return useDiscoveryGeolocation(initialCenter);
}
