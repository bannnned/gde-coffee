import { http } from "./http";

export type SubmissionEntityType =
  | "cafe"
  | "cafe_description"
  | "cafe_photo"
  | "menu_photo"
  | "review";

export type SubmissionActionType = "create" | "update" | "delete";

export type SubmissionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_changes"
  | "cancelled";

export type ModerationSubmission = {
  id: string;
  author_user_id: string;
  author_label?: string;
  entity_type: SubmissionEntityType;
  action_type: SubmissionActionType;
  target_id?: string | null;
  target_cafe_name?: string | null;
  target_cafe_address?: string | null;
  target_cafe_latitude?: number | null;
  target_cafe_longitude?: number | null;
  target_cafe_map_url?: string | null;
  payload: Record<string, unknown>;
  status: SubmissionStatus;
  moderator_id?: string | null;
  moderator_comment?: string | null;
  created_at: string;
  updated_at: string;
  decided_at?: string | null;
};

type SubmissionListResponse = {
  items?: ModerationSubmission[];
};

export type SubmissionPhotoPresignPayload = {
  contentType: string;
  sizeBytes: number;
};

export type SubmissionPhotoPresignResponse = {
  upload_url: string;
  method: string;
  headers: Record<string, string>;
  object_key: string;
  file_url: string;
  expires_at: string;
};

export type SubmitCafeCreatePayload = {
  name: string;
  address: string;
  description?: string;
  latitude: number;
  longitude: number;
  amenities?: string[];
  photoObjectKeys?: string[];
  menuPhotoObjectKeys?: string[];
};

export async function presignSubmissionPhotoUpload(
  payload: SubmissionPhotoPresignPayload,
): Promise<SubmissionPhotoPresignResponse> {
  const res = await http.post<SubmissionPhotoPresignResponse>(
    "/api/submissions/photos/presign",
    {
      content_type: payload.contentType,
      size_bytes: payload.sizeBytes,
    },
  );
  return res.data;
}

export async function submitCafeCreate(
  payload: SubmitCafeCreatePayload,
): Promise<ModerationSubmission> {
  const res = await http.post<ModerationSubmission>("/api/submissions/cafes", {
    name: payload.name,
    address: payload.address,
    description: payload.description ?? "",
    latitude: payload.latitude,
    longitude: payload.longitude,
    amenities: payload.amenities ?? [],
    photo_object_keys: payload.photoObjectKeys ?? [],
    menu_photo_object_keys: payload.menuPhotoObjectKeys ?? [],
  });
  return res.data;
}

export async function submitCafeDescription(
  cafeId: string,
  description: string,
): Promise<ModerationSubmission> {
  const res = await http.post<ModerationSubmission>(
    `/api/submissions/cafes/${encodeURIComponent(cafeId)}/description`,
    { description },
  );
  return res.data;
}

export async function submitCafePhotos(
  cafeId: string,
  objectKeys: string[],
): Promise<ModerationSubmission> {
  const res = await http.post<ModerationSubmission>(
    `/api/submissions/cafes/${encodeURIComponent(cafeId)}/photos`,
    { object_keys: objectKeys },
  );
  return res.data;
}

export async function submitMenuPhotos(
  cafeId: string,
  objectKeys: string[],
): Promise<ModerationSubmission> {
  const res = await http.post<ModerationSubmission>(
    `/api/submissions/cafes/${encodeURIComponent(cafeId)}/menu-photos`,
    { object_keys: objectKeys },
  );
  return res.data;
}

export async function listMySubmissions(): Promise<ModerationSubmission[]> {
  const res = await http.get<SubmissionListResponse>("/api/submissions/mine");
  return res.data?.items ?? [];
}

export type ListModerationParams = {
  status?: SubmissionStatus | "";
  entityType?: SubmissionEntityType | "";
};

export async function listModerationSubmissions(
  params: ListModerationParams = {},
): Promise<ModerationSubmission[]> {
  const res = await http.get<SubmissionListResponse>("/api/moderation/submissions", {
    params: {
      status: params.status ?? "pending",
      entity_type: params.entityType ?? "",
    },
  });
  return res.data?.items ?? [];
}

export async function getModerationSubmission(
  id: string,
): Promise<ModerationSubmission> {
  const res = await http.get<ModerationSubmission>(
    `/api/moderation/submissions/${encodeURIComponent(id)}`,
  );
  return res.data;
}

export async function approveModerationSubmission(
  id: string,
  comment?: string,
): Promise<void> {
  await http.post(`/api/moderation/submissions/${encodeURIComponent(id)}/approve`, {
    comment: (comment ?? "").trim(),
  });
}

export async function rejectModerationSubmission(
  id: string,
  comment: string,
): Promise<void> {
  await http.post(`/api/moderation/submissions/${encodeURIComponent(id)}/reject`, {
    comment: comment.trim(),
  });
}
