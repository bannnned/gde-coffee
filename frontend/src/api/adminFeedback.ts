import { http } from "./http";

export type AdminFeedbackItem = {
  id: number;
  user_id: string;
  user_email: string;
  user_display_name: string;
  message: string;
  contact: string;
  user_agent: string;
  created_at: string;
};

type ListAdminFeedbackResponse = {
  items?: AdminFeedbackItem[];
  total?: number;
};

export type ListAdminFeedbackParams = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type ListAdminFeedbackResult = {
  items: AdminFeedbackItem[];
  total: number;
};

export async function listAdminFeedback(
  params: ListAdminFeedbackParams = {},
): Promise<ListAdminFeedbackResult> {
  const res = await http.get<ListAdminFeedbackResponse>("/api/admin/feedback", {
    params: {
      q: params.q ?? "",
      limit: params.limit,
      offset: params.offset ?? 0,
    },
  });

  return {
    items: Array.isArray(res.data?.items) ? res.data.items : [],
    total: typeof res.data?.total === "number" ? res.data.total : 0,
  };
}
