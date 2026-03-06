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
  state: "active" | "acked" | "snoozed";
  snoozed_until?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  owner?: string;
  comment?: string;
};

export type AdminMapPerfHistoryPoint = {
  date: string;
  status: "good" | "watch" | "risk";
  first_render_p95_ms: number;
  first_interaction_p95_ms: number;
  interaction_coverage: number;
  trend_delta_pct: number;
};

export type AdminMapPerfActionPoint = {
  alert_key: string;
  action: "ack" | "snooze" | "reset";
  actor_user_id?: string;
  snooze_hours?: number;
  created_at: string;
  owner?: string;
  comment?: string;
};

export type AdminMapPerfReport = {
  summary: AdminMapPerfSummary;
  daily: AdminMapPerfDailyPoint[];
  network: AdminMapPerfNetworkPoint[];
  alerts: AdminMapPerfAlert[];
  history: AdminMapPerfHistoryPoint[];
  actions: AdminMapPerfActionPoint[];
};

export type AdminTasteMapSummary = {
  from: string;
  to: string;
  days: number;
  onboarding_started: number;
  onboarding_completed: number;
  onboarding_completion_rate: number;
  hypothesis_shown: number;
  hypothesis_dismissed: number;
  hypothesis_confirmed: number;
  feedback_confirm_rate: number;
  api_errors: number;
  recompute_events: number;
  inference_runs: number;
  inference_failed_runs: number;
  inference_failure_rate: number;
  inference_latency_p50_ms: number;
  inference_latency_p95_ms: number;
};

export type AdminTasteMapDailyPoint = {
  date: string;
  onboarding_started: number;
  onboarding_completed: number;
  hypothesis_shown: number;
  hypothesis_dismissed: number;
  hypothesis_confirmed: number;
  api_errors: number;
  recompute_events: number;
  inference_runs: number;
  inference_failed_runs: number;
  inference_failure_rate: number;
  inference_p95_ms: number;
};

export type AdminTasteMapAlert = {
  key: string;
  severity: "watch" | "risk";
  label: string;
  value: string;
  target: string;
};

export type AdminTasteMapReport = {
  summary: AdminTasteMapSummary;
  daily: AdminTasteMapDailyPoint[];
  alerts: AdminTasteMapAlert[];
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
  const actionsRaw = asArray(root.actions);

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
      const stateRaw = asString(record.state);
      const state: "active" | "acked" | "snoozed" =
        stateRaw === "acked" ? "acked" : stateRaw === "snoozed" ? "snoozed" : "active";
      return {
        key: asString(record.key),
        severity,
        label: asString(record.label),
        value: asString(record.value),
        target: asString(record.target),
        state,
        snoozed_until: asString(record.snoozed_until) || undefined,
        acknowledged_at: asString(record.acknowledged_at) || undefined,
        acknowledged_by: asString(record.acknowledged_by) || undefined,
        owner: asString(record.owner) || undefined,
        comment: asString(record.comment) || undefined,
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
    actions: actionsRaw.map((item) => {
      const record = asRecord(item);
      const actionRaw = asString(record.action);
      const action: "ack" | "snooze" | "reset" =
        actionRaw === "ack" || actionRaw === "snooze" || actionRaw === "reset" ? actionRaw : "ack";
      return {
        alert_key: asString(record.alert_key),
        action,
        actor_user_id: asString(record.actor_user_id) || undefined,
        snooze_hours: asNumber(record.snooze_hours) || undefined,
        created_at: asString(record.created_at),
        owner: asString(record.owner) || undefined,
        comment: asString(record.comment) || undefined,
      };
    }).filter((item) => item.alert_key && item.created_at),
  };
}

export async function setAdminMapPerfAlertState(
  alertKey: string,
  input: { action: "ack" | "snooze" | "reset"; snooze_hours?: number; owner?: string; comment?: string },
): Promise<void> {
  await http.post(`/api/admin/metrics/map-perf/alerts/${encodeURIComponent(alertKey)}/state`, {
    action: input.action,
    snooze_hours: input.snooze_hours,
    owner: input.owner,
    comment: input.comment,
  });
}

export async function getAdminTasteMap(params?: { days?: number }): Promise<AdminTasteMapReport> {
  const res = await http.get<unknown>("/api/admin/metrics/taste-map", {
    params: {
      days: params?.days,
    },
  });

  const root = asRecord(res.data);
  const summaryRaw = asRecord(root.summary);
  const dailyRaw = asArray(root.daily);
  const alertsRaw = asArray(root.alerts);

  return {
    summary: {
      from: asString(summaryRaw.from),
      to: asString(summaryRaw.to),
      days: asNumber(summaryRaw.days),
      onboarding_started: asNumber(summaryRaw.onboarding_started),
      onboarding_completed: asNumber(summaryRaw.onboarding_completed),
      onboarding_completion_rate: asNumber(summaryRaw.onboarding_completion_rate),
      hypothesis_shown: asNumber(summaryRaw.hypothesis_shown),
      hypothesis_dismissed: asNumber(summaryRaw.hypothesis_dismissed),
      hypothesis_confirmed: asNumber(summaryRaw.hypothesis_confirmed),
      feedback_confirm_rate: asNumber(summaryRaw.feedback_confirm_rate),
      api_errors: asNumber(summaryRaw.api_errors),
      recompute_events: asNumber(summaryRaw.recompute_events),
      inference_runs: asNumber(summaryRaw.inference_runs),
      inference_failed_runs: asNumber(summaryRaw.inference_failed_runs),
      inference_failure_rate: asNumber(summaryRaw.inference_failure_rate),
      inference_latency_p50_ms: asNumber(summaryRaw.inference_latency_p50_ms),
      inference_latency_p95_ms: asNumber(summaryRaw.inference_latency_p95_ms),
    },
    daily: dailyRaw
      .map((item) => {
        const record = asRecord(item);
        return {
          date: asString(record.date),
          onboarding_started: asNumber(record.onboarding_started),
          onboarding_completed: asNumber(record.onboarding_completed),
          hypothesis_shown: asNumber(record.hypothesis_shown),
          hypothesis_dismissed: asNumber(record.hypothesis_dismissed),
          hypothesis_confirmed: asNumber(record.hypothesis_confirmed),
          api_errors: asNumber(record.api_errors),
          recompute_events: asNumber(record.recompute_events),
          inference_runs: asNumber(record.inference_runs),
          inference_failed_runs: asNumber(record.inference_failed_runs),
          inference_failure_rate: asNumber(record.inference_failure_rate),
          inference_p95_ms: asNumber(record.inference_p95_ms),
        };
      })
      .filter((item) => item.date),
    alerts: alertsRaw
      .map((item) => {
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
      })
      .filter((item) => item.key && item.label),
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
