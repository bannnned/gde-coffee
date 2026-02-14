import { http } from "./http";
import type { CafePhoto } from "../features/work/types";

export type CafePhotoPresignPayload = {
  contentType: string;
  sizeBytes: number;
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
};

export type CafePhotoConfirmResponse = {
  photo: {
    id: string;
    url: string;
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
    },
  );
  return res.data;
}

export async function uploadCafePhotoByPresignedUrl(
  uploadUrl: string,
  file: File,
  headers: Record<string, string>,
): Promise<void> {
  const filteredHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    const lower = key.toLowerCase();
    if (
      lower === "host" ||
      lower === "content-length" ||
      lower === "user-agent" ||
      lower === "accept-encoding" ||
      lower === "connection"
    ) {
      continue;
    }
    filteredHeaders[key] = value;
  }
  if (!Object.keys(filteredHeaders).some((key) => key.toLowerCase() === "content-type")) {
    filteredHeaders["Content-Type"] = file.type || "application/octet-stream";
  }

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: filteredHeaders,
    body: file,
  });
  if (!response.ok) {
    let details = "";
    try {
      const text = await response.text();
      details = text ? `: ${text.slice(0, 240)}` : "";
    } catch {
      details = "";
    }
    throw new Error(`upload failed (${response.status})${details}`);
  }
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
    },
  );
  return res.data;
}

export async function getCafePhotos(cafeId: string): Promise<CafePhoto[]> {
  const res = await http.get<CafePhotosListResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/photos`,
  );
  return res.data?.photos ?? [];
}

export async function reorderCafePhotos(
  cafeId: string,
  photoIds: string[],
): Promise<CafePhoto[]> {
  const res = await http.patch<CafePhotosListResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/photos/order`,
    { photo_ids: photoIds },
  );
  return res.data?.photos ?? [];
}

export async function setCafePhotoCover(
  cafeId: string,
  photoId: string,
): Promise<CafePhoto[]> {
  const res = await http.patch<CafePhotosListResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/photos/${encodeURIComponent(photoId)}/cover`,
  );
  return res.data?.photos ?? [];
}

export async function deleteCafePhoto(
  cafeId: string,
  photoId: string,
): Promise<CafePhoto[]> {
  const res = await http.delete<CafePhotosListResponse>(
    `/api/cafes/${encodeURIComponent(cafeId)}/photos/${encodeURIComponent(photoId)}`,
  );
  return res.data?.photos ?? [];
}
