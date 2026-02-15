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
  return res.data;
}

export async function getCafePhotos(
  cafeId: string,
  kind: CafePhotoKind = "cafe",
): Promise<CafePhoto[]> {
  const res = await http.get<CafePhotosListResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/photos`,
    { params: { kind } },
  );
  return res.data?.photos ?? [];
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
  return res.data?.photos ?? [];
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
  return res.data?.photos ?? [];
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
  return res.data?.photos ?? [];
}
