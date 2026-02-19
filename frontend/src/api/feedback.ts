import { http } from "./http";

export type SubmitAppFeedbackPayload = {
  message: string;
  contact?: string;
};

export async function submitAppFeedback(payload: SubmitAppFeedbackPayload): Promise<void> {
  await http.post("/api/account/feedback", {
    message: payload.message,
    contact: payload.contact?.trim() ?? "",
  });
}
