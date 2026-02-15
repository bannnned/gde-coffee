import { MOSCOW_CENTER, SPB_CENTER } from "../../constants";

export const LOCATION_STORAGE_KEY = "coffeeQuest.location";

export const LOCATION_OPTIONS = [
  { id: "spb", label: "Санкт-Петербург", center: SPB_CENTER },
  { id: "moscow", label: "Москва", center: MOSCOW_CENTER },
] as const;

export type LocationId = (typeof LOCATION_OPTIONS)[number]["id"];

export type LocationChoice =
  | { type: "geolocation" }
  | { type: "city"; id: LocationId }
  | { type: "manual"; center: [number, number] };

export const CITY_RADIUS_M_BY_ID: Record<LocationId, number> = {
  spb: 30000,
  moscow: 35000,
};

export const MANUAL_PIN_NUDGE_PX = 0;
export const CENTER_EPS = 1e-6;
