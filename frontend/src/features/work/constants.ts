import { IconAdjustments, IconCurrentLocation } from "@tabler/icons-react";

import {
  AMENITY_LABELS as DISCOVERY_AMENITY_LABELS,
  DEFAULT_AMENITIES as DISCOVERY_DEFAULT_AMENITIES,
  DEFAULT_RADIUS_M as DISCOVERY_DEFAULT_RADIUS_M,
  SPB_CENTER as DISCOVERY_SPB_CENTER,
} from "../discovery/constants";
import type { Amenity } from "./types";

export const SPB_CENTER: [number, number] = DISCOVERY_SPB_CENTER;
export const DEFAULT_RADIUS_M = DISCOVERY_DEFAULT_RADIUS_M;
export const DEFAULT_AMENITIES: Amenity[] = DISCOVERY_DEFAULT_AMENITIES as Amenity[];
export const AMENITY_LABELS: Record<Amenity, string> =
  DISCOVERY_AMENITY_LABELS as Record<Amenity, string>;

export const WORK_UI_TEXT = {
  title: "Где кофе",
  settingsAria: "Настройки",
  fetching: "обновляем…",
  locate: "Определить",
  errorLoad: "Не удалось загрузить кофейни.",
  loading: "Загрузка…",
  emptyTitle: "Ничего не нашли рядом",
  emptySubtitle: "Попробуйте увеличить радиус или убрать фильтры.",
  emptyNoGeoTitle: "Не удалось определить местоположение.",
  emptyNoGeoSubtitle: "Разрешите доступ к геопозиции и попробуйте еще раз.",
  emptyErrorTitle: "Не удалось загрузить список.",
  emptyErrorSubtitle: "Проверьте соединение и попробуйте снова.",
  retry: "Повторить",
  resetFilters: "Сбросить фильтры",
  route2gis: "2GIS",
  routeYandex: "Яндекс",
  radiusTitle: "Радиус",
  radiusAll: "Весь",
  filtersTitle: "Фильтры",
  workScorePrefix: "оценка места",
} as const;

export const WORK_ICONS = {
  settings: IconAdjustments,
  locate: IconCurrentLocation,
} as const;
