import { http } from "./http";

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): RawRecord {
  return isRecord(value) ? value : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export type MyReputationProfile = {
  userId: string;
  score: number;
  badge: string;
  trustedParticipant: boolean;
  eventsCount: number;
  formulaVersion: string;
  trustedThreshold: number;
  level: number;
  levelLabel: string;
  levelProgress: number;
  levelScoreFloor: number;
  nextLevelScore: number;
  pointsToNextLevel: number;
};

export async function getMyReputationProfile(): Promise<MyReputationProfile> {
  const response = await http.get<unknown>("/api/reputation/me");
  const raw = asRecord(response.data);

  return {
    userId: asString(raw.user_id),
    score: asNumber(raw.score),
    badge: asString(raw.badge, "Участник"),
    trustedParticipant: asBoolean(raw.trusted_participant, false),
    eventsCount: asNumber(raw.events_count),
    formulaVersion: asString(raw.formula_version, "reputation_v1_1"),
    trustedThreshold: asNumber(raw.trusted_threshold_v1_1),
    level: asNumber(raw.level, 1),
    levelLabel: asString(raw.level_label, "Участник"),
    levelProgress: asNumber(raw.level_progress),
    levelScoreFloor: asNumber(raw.level_score_floor),
    nextLevelScore: asNumber(raw.next_level_score),
    pointsToNextLevel: asNumber(raw.points_to_next_level),
  };
}
