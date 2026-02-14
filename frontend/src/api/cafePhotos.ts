import { http } from "./http";

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
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: file,
  });
  if (!response.ok) {
    throw new Error(`upload failed (${response.status})`);
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
