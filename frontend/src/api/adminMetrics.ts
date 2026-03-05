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

export type AdminFunnelSummary = {
  from: string;
  to: string;
  days: number;
  cafe_id?: string;
};

export type AdminFunnelStage = {
  key: string;
  label: string;
  journeys: number;
  conversion_from_prev: number;
  conversion_from_start: number;
};

export type AdminFunnelReport = {
  summary: AdminFunnelSummary;
  stages: AdminFunnelStage[];
};

export type AdminMapPerfSummary = {
  from: string;
  to: string;
  days: number;
  first_render_events: number;
  first_render_p50_ms: number;
  first_render_p95_ms: number;
  first_interaction_events: number;
  first_interaction_p50_ms: number;
  first_interaction_p95_ms: number;
  interaction_coverage: number;
};

export type AdminMapPerfDailyPoint = {
  date: string;
  first_render_events: number;
  first_render_p50_ms: number;
  first_render_p95_ms: number;
  first_interaction_events: number;
  first_interaction_p50_ms: number;
  first_interaction_p95_ms: number;
  interaction_coverage: number;
};

export type AdminMapPerfNetworkPoint = {
  effective_type: string;
  first_render_events: number;
  first_render_p50_ms: number;
  first_render_p95_ms: number;
  first_interaction_events: number;
  first_interaction_p50_ms: number;
  first_interaction_p95_ms: number;
  interaction_coverage: number;
};

export type AdminMapPerfAlert = {
  key: string;
  severity: "watch" | "risk";
  label: string;
  value: string;
  target: string;
};

export type AdminMapPerfHistoryPoint = {
  date: string;
  status: "good" | "watch" | "risk";
  first_render_p95_ms: number;
  first_interaction_p95_ms: number;
  interaction_coverage: number;
  trend_delta_pct: number;
};

export type AdminMapPerfReport = {
  summary: AdminMapPerfSummary;
  daily: AdminMapPerfDailyPoint[];
  network: AdminMapPerfNetworkPoint[];
  alerts: AdminMapPerfAlert[];
  history: AdminMapPerfHistoryPoint[];
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

export async function getAdminFunnel(params?: { days?: number; cafe_id?: string }): Promise<AdminFunnelReport> {
  const res = await http.get<unknown>("/api/admin/metrics/funnel", {
    params: {
      days: params?.days,
      cafe_id: params?.cafe_id,
    },
  });

  const root = asRecord(res.data);
  const summaryRaw = asRecord(root.summary);
  const stagesRaw = asArray(root.stages);

  return {
    summary: {
      from: asString(summaryRaw.from),
      to: asString(summaryRaw.to),
      days: asNumber(summaryRaw.days),
      cafe_id: asString(summaryRaw.cafe_id) || undefined,
    },
    stages: stagesRaw.map((item) => {
      const record = asRecord(item);
      return {
        key: asString(record.key),
        label: asString(record.label),
        journeys: asNumber(record.journeys),
        conversion_from_prev: asNumber(record.conversion_from_prev),
        conversion_from_start: asNumber(record.conversion_from_start),
      };
    }),
  };
}

export async function getAdminMapPerf(params?: { days?: number }): Promise<AdminMapPerfReport> {
  const res = await http.get<unknown>("/api/admin/metrics/map-perf", {
    params: {
      days: params?.days,
    },
  });

  const root = asRecord(res.data);
  const summaryRaw = asRecord(root.summary);
  const dailyRaw = asArray(root.daily);
  const networkRaw = asArray(root.network);
  const alertsRaw = asArray(root.alerts);
  const historyRaw = asArray(root.history);

  return {
    summary: {
      from: asString(summaryRaw.from),
      to: asString(summaryRaw.to),
      days: asNumber(summaryRaw.days),
      first_render_events: asNumber(summaryRaw.first_render_events),
      first_render_p50_ms: asNumber(summaryRaw.first_render_p50_ms),
      first_render_p95_ms: asNumber(summaryRaw.first_render_p95_ms),
      first_interaction_events: asNumber(summaryRaw.first_interaction_events),
      first_interaction_p50_ms: asNumber(summaryRaw.first_interaction_p50_ms),
      first_interaction_p95_ms: asNumber(summaryRaw.first_interaction_p95_ms),
      interaction_coverage: asNumber(summaryRaw.interaction_coverage),
    },
    daily: dailyRaw.map((item) => {
      const record = asRecord(item);
      return {
        date: asString(record.date),
        first_render_events: asNumber(record.first_render_events),
        first_render_p50_ms: asNumber(record.first_render_p50_ms),
        first_render_p95_ms: asNumber(record.first_render_p95_ms),
        first_interaction_events: asNumber(record.first_interaction_events),
        first_interaction_p50_ms: asNumber(record.first_interaction_p50_ms),
        first_interaction_p95_ms: asNumber(record.first_interaction_p95_ms),
        interaction_coverage: asNumber(record.interaction_coverage),
      };
    }),
    network: networkRaw.map((item) => {
      const record = asRecord(item);
      return {
        effective_type: asString(record.effective_type),
        first_render_events: asNumber(record.first_render_events),
        first_render_p50_ms: asNumber(record.first_render_p50_ms),
        first_render_p95_ms: asNumber(record.first_render_p95_ms),
        first_interaction_events: asNumber(record.first_interaction_events),
        first_interaction_p50_ms: asNumber(record.first_interaction_p50_ms),
        first_interaction_p95_ms: asNumber(record.first_interaction_p95_ms),
        interaction_coverage: asNumber(record.interaction_coverage),
      };
    }),
    alerts: alertsRaw.map((item) => {
      const record = asRecord(item);
      const severityRaw = asString(record.severity);
      const severity: "watch" | "risk" = severityRaw === "risk" ? "risk" : "watch";
      return {
        key: asString(record.key),
        severity,
        label: asString(record.label),
        value: asString(record.value),
        target: asString(record.target),
      };
    }).filter((item) => item.key && item.label),
    history: historyRaw.map((item) => {
      const record = asRecord(item);
      const statusRaw = asString(record.status);
      const status: "good" | "watch" | "risk" =
        statusRaw === "risk" ? "risk" : statusRaw === "watch" ? "watch" : "good";
      return {
        date: asString(record.date),
        status,
        first_render_p95_ms: asNumber(record.first_render_p95_ms),
        first_interaction_p95_ms: asNumber(record.first_interaction_p95_ms),
        interaction_coverage: asNumber(record.interaction_coverage),
        trend_delta_pct: asNumber(record.trend_delta_pct),
      };
    }).filter((item) => item.date),
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
