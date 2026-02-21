import { http } from "./http";

export type MetricEventType = "review_read" | "route_click" | "checkin_start";
export type RouteProvider = "2gis" | "yandex";

type MetricEventInput = {
  event_type: MetricEventType;
  journey_id: string;
  cafe_id: string;
  review_id?: string;
  provider?: RouteProvider;
  occurred_at?: string;
  meta?: Record<string, unknown>;
};

type MetricEventPayload = MetricEventInput & {
  anon_id: string;
  client_event_id: string;
};

const ANON_ID_STORAGE_KEY = "gdeCoffee.anonId";

function randomToken(size = 16): string {
  const bytes = new Uint8Array(size);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let idx = 0; idx < bytes.length; idx += 1) {
      bytes[idx] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function getOrCreateAnonID(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  const existing = window.localStorage.getItem(ANON_ID_STORAGE_KEY)?.trim();
  if (existing) {
    return existing;
  }

  const next = `anon_${Date.now().toString(36)}_${randomToken(8)}`;
  window.localStorage.setItem(ANON_ID_STORAGE_KEY, next);
  return next;
}

function buildClientEventID(): string {
  return `${Date.now().toString(36)}_${randomToken(6)}`;
}

export function createJourneyID(cafeID: string): string {
  const safeCafeID = (cafeID || "").trim() || "unknown";
  return `journey_${safeCafeID}_${Date.now().toString(36)}_${randomToken(4)}`;
}

export function reportMetricEvent(event: MetricEventInput): void {
  const journeyID = (event.journey_id || "").trim();
  const cafeID = (event.cafe_id || "").trim();
  if (!journeyID || !cafeID) {
    return;
  }

  const payload: MetricEventPayload = {
    ...event,
    journey_id: journeyID,
    cafe_id: cafeID,
    review_id: (event.review_id || "").trim() || undefined,
    provider: event.provider,
    anon_id: getOrCreateAnonID(),
    client_event_id: buildClientEventID(),
  };

  void http
    .post(
      "/metrics/events",
      {
        events: [payload],
      },
      {
        timeout: 2500,
      },
    )
    .catch(() => {
      // Analytics is best-effort and must not block user interactions.
    });
}
