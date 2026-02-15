import type {
  ModerationSubmission,
  SubmissionEntityType,
  SubmissionStatus,
} from "../../../api/submissions";
import type { Cafe, CafePhoto } from "../../../entities/cafe/model/types";

export type ModerationTabKey = "all" | SubmissionEntityType;

export const STATUS_OPTIONS: { value: SubmissionStatus | ""; label: string }[] = [
  { value: "pending", label: "В ожидании" },
  { value: "approved", label: "Одобрено" },
  { value: "rejected", label: "Отклонено" },
  { value: "needs_changes", label: "Нужны правки" },
  { value: "cancelled", label: "Отменено" },
  { value: "", label: "Все статусы" },
];

export const TAB_ITEMS: { value: ModerationTabKey; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "cafe", label: "Кофейни" },
  { value: "cafe_description", label: "Описания" },
  { value: "cafe_photo", label: "Фото места" },
  { value: "menu_photo", label: "Фото меню" },
  { value: "review", label: "Отзывы" },
];

const ENTITY_LABELS: Record<SubmissionEntityType, string> = {
  cafe: "Новая кофейня",
  cafe_description: "Описание",
  cafe_photo: "Фото заведения",
  menu_photo: "Фото меню",
  review: "Отзыв",
};

function readString(
  payload: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readNumber(
  payload: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const value = payload?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function buildPhotos(urls: string[], kind: "cafe" | "menu"): CafePhoto[] {
  return urls.map((url, index) => ({
    id: `${kind}-${index + 1}`,
    url,
    kind,
    position: index + 1,
    is_cover: kind === "cafe" && index === 0,
  }));
}

export function getModerationEntityLabel(entity: string): string {
  return ENTITY_LABELS[entity as SubmissionEntityType] ?? entity;
}

export function formatModerationDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function readStringArrayFromPayload(
  payload: Record<string, unknown> | undefined,
  key: string,
): string[] {
  const value = payload?.[key];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function buildPreviewCafe(item: ModerationSubmission): Cafe | null {
  const payload = item.payload ?? {};

  const payloadName = readString(payload, "name");
  const payloadAddress = readString(payload, "address");
  const payloadDescription = readString(payload, "description");
  const payloadLat = readNumber(payload, "latitude");
  const payloadLng = readNumber(payload, "longitude");
  const payloadAmenitiesRaw = payload["amenities"];
  const payloadAmenities = Array.isArray(payloadAmenitiesRaw)
    ? payloadAmenitiesRaw.filter((value): value is string => typeof value === "string")
    : [];

  const photoUrls = readStringArrayFromPayload(payload, "photo_urls");
  const menuPhotoUrls = readStringArrayFromPayload(payload, "menu_photo_urls");
  const photos = [
    ...buildPhotos(photoUrls, "cafe"),
    ...buildPhotos(menuPhotoUrls, "menu"),
  ];

  const name = item.target_cafe_name?.trim() || payloadName || "";
  const address = item.target_cafe_address?.trim() || payloadAddress || "";
  if (!name || !address) return null;

  const latitude =
    typeof item.target_cafe_latitude === "number" && Number.isFinite(item.target_cafe_latitude)
      ? item.target_cafe_latitude
      : payloadLat ?? 0;
  const longitude =
    typeof item.target_cafe_longitude === "number" && Number.isFinite(item.target_cafe_longitude)
      ? item.target_cafe_longitude
      : payloadLng ?? 0;

  const cafeID = (item.target_id ?? "").trim();
  const coverPhoto = photoUrls[0] ?? null;

  return {
    id: cafeID,
    name,
    address,
    description:
      (item.entity_type === "cafe_description"
        ? readString(payload, "description")
        : payloadDescription) ?? null,
    latitude,
    longitude,
    amenities: payloadAmenities as Cafe["amenities"],
    distance_m: 0,
    is_favorite: false,
    cover_photo_url: coverPhoto,
    photos,
  };
}

export function resolveTargetCafeMapUrl(item: ModerationSubmission): string | null {
  const direct = item.target_cafe_map_url?.trim();
  if (direct) return direct;
  if (
    typeof item.target_cafe_latitude === "number" &&
    typeof item.target_cafe_longitude === "number"
  ) {
    return `https://yandex.ru/maps/?pt=${item.target_cafe_longitude},${item.target_cafe_latitude}&z=16&l=map`;
  }
  return null;
}
