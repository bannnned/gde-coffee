import { http } from "./http";
import { uploadByPresignedUrl } from "./presignedUpload";
import type { CafePhoto, CafePhotoKind } from "../entities/cafe/model/types";

export type CafePhotoPresignPayload = {
  contentType: string;
  sizeBytes: number;
  kind: CafePhotoKind;
};

export type CafePhotoPresignResponse = {
  upload_url: string;
  method: string;
  headers: Record<string, string>;
  object_key: string;
  file_url: string;
  expires_at: string;
};

export type CafePhotoConfirmPayload = {
  objectKey: string;
  isCover?: boolean;
  position?: number;
  kind: CafePhotoKind;
};

export type CafePhotoConfirmResponse = {
  photo: {
    id: string;
    url: string;
    kind: CafePhotoKind;
    is_cover: boolean;
    position: number;
  };
};

export type CafePhotosListResponse = {
  photos: CafePhoto[];
};

type GetCafePhotosOptions = {
  force?: boolean;
  maxAgeMs?: number;
};

type PhotoCacheEntry = {
  photos: CafePhoto[];
  cachedAt: number;
};

const PHOTO_LIST_CACHE_DEFAULT_MAX_AGE_MS = 10 * 60_000;
// Session-level cache to avoid refetching unchanged photo lists on tab/screen switches.
const photoListCache = new Map<string, PhotoCacheEntry>();
const inFlightPhotoRequests = new Map<string, Promise<CafePhoto[]>>();

function makePhotoCacheKey(cafeId: string, kind: CafePhotoKind): string {
  return `${cafeId.trim()}|${kind}`;
}

function clonePhotos(photos: CafePhoto[]): CafePhoto[] {
  return photos.map((photo) => ({ ...photo }));
}

function setPhotoListCache(cafeId: string, kind: CafePhotoKind, photos: CafePhoto[]) {
  photoListCache.set(makePhotoCacheKey(cafeId, kind), {
    photos: clonePhotos(photos),
    cachedAt: Date.now(),
  });
}

function invalidatePhotoListCache(cafeId: string, kind?: CafePhotoKind) {
  if (kind) {
    photoListCache.delete(makePhotoCacheKey(cafeId, kind));
    return;
  }
  photoListCache.delete(makePhotoCacheKey(cafeId, "cafe"));
  photoListCache.delete(makePhotoCacheKey(cafeId, "menu"));
}

export async function presignCafePhotoUpload(
  cafeId: string,
  payload: CafePhotoPresignPayload,
): Promise<CafePhotoPresignResponse> {
  const res = await http.post<CafePhotoPresignResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/photos/presign`,
    {
      content_type: payload.contentType,
      size_bytes: payload.sizeBytes,
      kind: payload.kind,
    },
  );
  return res.data;
}

export async function uploadCafePhotoByPresignedUrl(
  uploadUrl: string,
  file: File,
  headers: Record<string, string>,
): Promise<void> {
  await uploadByPresignedUrl(uploadUrl, file, headers);
}

export async function confirmCafePhotoUpload(
  cafeId: string,
  payload: CafePhotoConfirmPayload,
): Promise<CafePhotoConfirmResponse> {
  const res = await http.post<CafePhotoConfirmResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/photos/confirm`,
    {
      object_key: payload.objectKey,
      is_cover: payload.isCover ?? false,
      position: payload.position,
      kind: payload.kind,
    },
  );
  invalidatePhotoListCache(cafeId, payload.kind);
  return res.data;
}

export async function getCafePhotos(
  cafeId: string,
  kind: CafePhotoKind = "cafe",
  options: GetCafePhotosOptions = {},
): Promise<CafePhoto[]> {
  const key = makePhotoCacheKey(cafeId, kind);
  const maxAgeMs = options.maxAgeMs ?? PHOTO_LIST_CACHE_DEFAULT_MAX_AGE_MS;

  if (!options.force) {
    const cached = photoListCache.get(key);
    if (cached && Date.now() - cached.cachedAt <= maxAgeMs) {
      return clonePhotos(cached.photos);
    }
    const pending = inFlightPhotoRequests.get(key);
    if (pending) {
      return pending.then((photos) => clonePhotos(photos));
    }
  }

  const request = http
    .get<CafePhotosListResponse>(`/api/cafes/${encodeURIComponent(cafeId)}/photos`, {
      params: { kind },
    })
    .then((res) => {
      const photos = res.data?.photos ?? [];
      setPhotoListCache(cafeId, kind, photos);
      return clonePhotos(photos);
    })
    .finally(() => {
      inFlightPhotoRequests.delete(key);
    });

  inFlightPhotoRequests.set(key, request);
  return request;
}

export async function reorderCafePhotos(
  cafeId: string,
  photoIds: string[],
  kind: CafePhotoKind = "cafe",
): Promise<CafePhoto[]> {
  const res = await http.patch<CafePhotosListResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/photos/order`,
    { photo_ids: photoIds },
    { params: { kind } },
  );
  const photos = res.data?.photos ?? [];
  setPhotoListCache(cafeId, kind, photos);
  return clonePhotos(photos);
}

export async function setCafePhotoCover(
  cafeId: string,
  photoId: string,
  kind: CafePhotoKind = "cafe",
): Promise<CafePhoto[]> {
  const res = await http.patch<CafePhotosListResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/photos/${encodeURIComponent(photoId)}/cover`,
    undefined,
    { params: { kind } },
  );
  const photos = res.data?.photos ?? [];
  setPhotoListCache(cafeId, kind, photos);
  return clonePhotos(photos);
}

export async function deleteCafePhoto(
  cafeId: string,
  photoId: string,
  kind: CafePhotoKind = "cafe",
): Promise<CafePhoto[]> {
  const res = await http.delete<CafePhotosListResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/photos/${encodeURIComponent(photoId)}`,
    { params: { kind } },
  );
  const photos = res.data?.photos ?? [];
  setPhotoListCache(cafeId, kind, photos);
  return clonePhotos(photos);
}
