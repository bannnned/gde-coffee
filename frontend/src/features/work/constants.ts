import { IconAdjustments, IconCurrentLocation } from "@tabler/icons-react";

import type { Amenity } from "./types";

export const SPB_CENTER: [number, number] = [30.3158, 59.9343];
export const DEFAULT_RADIUS_M = 2500;
export const DEFAULT_AMENITIES: Amenity[] = ["wifi", "power"];

export const AMENITY_LABELS: Record<Amenity, string> = {
  wifi: "Wi-Fi",
  robusta: "Робуста",
  arabica: "Арабика",
  vortex: "воронка",
  power: "Розетки",
  quiet: "Тихо",
  toilet: "Туалет",
  laptop: "Ноут",
};

export const WORK_UI_TEXT = {
  title: "Где кофе",
  settingsAria: "Настройки",
  fetching: "обновляем…",
  locateAria: "Найти меня",
  locate: "Определить",
  errorLoad: "Не удалось загрузить кофейни.",
  loading: "Загрузка…",
  emptyTitle: "Ничего не нашли рядом.",
  emptySubtitle: "Попробуйте увеличить радиус или убрать фильтры.",
  emptyNoGeoTitle: "Не удалось определить местоположение.",
  emptyNoGeoSubtitle: "Разрешите доступ к геопозиции и попробуйте еще раз.",
  emptyErrorTitle: "Не удалось загрузить список.",
  emptyErrorSubtitle: "Проверьте соединение и попробуйте снова.",
  retry: "Повторить",
  resetFilters: "Сбросить фильтры",
  route2gis: "2GIS",
  routeYandex: "Яндекс",
  workScorePrefix: "work",
  radiusTitle: "Радиус",
  radiusAll: "Весь",
  filtersTitle: "Фильтры",
} as const;

export const WORK_ICONS = {
  settings: IconAdjustments,
  locate: IconCurrentLocation,
} as const;
