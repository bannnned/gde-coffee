import { http } from "./http";

export type TasteSignal = {
  taste_code: string;
  polarity: "positive" | "negative";
  strength: number;
};

export type TasteOnboardingOption = {
  id: string;
  label: string;
  signals?: TasteSignal[];
};

export type TasteOnboardingDimension = {
  id: string;
  label: string;
  min: number;
  max: number;
};

export type TasteOnboardingPairSide = {
  label: string;
  signals?: TasteSignal[];
};

export type TasteOnboardingPair = {
  id: string;
  left: TasteOnboardingPairSide;
  right: TasteOnboardingPairSide;
};

export type TasteOnboardingStep = {
  id: string;
  type: "single_choice" | "multi_choice" | "range" | "paired_preference";
  required: boolean;
  title?: string;
  subtitle?: string;
  min_choices?: number;
  max_choices?: number;
  options?: TasteOnboardingOption[];
  dimensions?: TasteOnboardingDimension[];
  pairs?: TasteOnboardingPair[];
};

export type TasteOnboardingResponse = {
  contract_version: string;
  onboarding_version: string;
  locale: string;
  estimated_duration_sec: number;
  steps: TasteOnboardingStep[];
};

export type TasteOnboardingAnswer = {
  question_id: string;
  value: unknown;
};

export type CompleteTasteOnboardingRequest = {
  onboarding_version: string;
  session_id?: string;
  answers: TasteOnboardingAnswer[];
  client_completed_at: string;
};

export type CompleteTasteOnboardingResponse = {
  contract_version: string;
  inference_version: string;
  session_id: string;
  profile: {
    tags: Array<{
      taste_code: string;
      polarity: "positive" | "negative";
      score: number;
      confidence: number;
      source: string;
    }>;
    updated_at: string;
  };
};

export async function getTasteOnboarding(): Promise<TasteOnboardingResponse> {
  const res = await http.get<TasteOnboardingResponse>("/api/v1/taste/onboarding");
  return res.data;
}

export async function completeTasteOnboarding(
  payload: CompleteTasteOnboardingRequest,
): Promise<CompleteTasteOnboardingResponse> {
  const res = await http.post<CompleteTasteOnboardingResponse>(
    "/api/v1/taste/onboarding/complete",
    payload,
  );
  return res.data;
}
