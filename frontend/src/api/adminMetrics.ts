import { http } from "./http";

export type AdminNorthStarSummary = {
  from: string;
  to: string;
  days: number;
  cafe_id?: string;
  visit_intent_journeys: number;
  north_star_journeys: number;
  rate: number;
};

export type AdminNorthStarDailyPoint = {
  date: string;
  visit_intent_journeys: number;
  north_star_journeys: number;
  rate: number;
};

export type AdminNorthStarReport = {
  summary: AdminNorthStarSummary;
  daily: AdminNorthStarDailyPoint[];
};

export type AdminCafeSearchItem = {
  id: string;
  name: string;
  address: string;
};

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): RawRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getAdminNorthStar(params?: { days?: number; cafe_id?: string }): Promise<AdminNorthStarReport> {
  const res = await http.get<unknown>("/api/admin/metrics/north-star", {
    params: {
      days: params?.days,
      cafe_id: params?.cafe_id,
    },
  });

  const root = asRecord(res.data);
  const summaryRaw = asRecord(root.summary);
  const dailyRaw = asArray(root.daily);

  return {
    summary: {
      from: asString(summaryRaw.from),
      to: asString(summaryRaw.to),
      days: asNumber(summaryRaw.days),
      cafe_id: asString(summaryRaw.cafe_id) || undefined,
      visit_intent_journeys: asNumber(summaryRaw.visit_intent_journeys),
      north_star_journeys: asNumber(summaryRaw.north_star_journeys),
      rate: asNumber(summaryRaw.rate),
    },
    daily: dailyRaw.map((item) => {
      const record = asRecord(item);
      return {
        date: asString(record.date),
        visit_intent_journeys: asNumber(record.visit_intent_journeys),
        north_star_journeys: asNumber(record.north_star_journeys),
        rate: asNumber(record.rate),
      };
    }),
  };
}

export async function searchAdminCafesByName(query: string, limit = 12): Promise<AdminCafeSearchItem[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  const res = await http.get<unknown>("/api/admin/cafes/search", {
    params: {
      q,
      limit,
    },
  });

  const root = asRecord(res.data);
  const rawItems = asArray(root.items);

  return rawItems.map((item) => {
    const record = asRecord(item);
    return {
      id: asString(record.id),
      name: asString(record.name),
      address: asString(record.address),
    };
  }).filter((item) => item.id && item.name);
}
