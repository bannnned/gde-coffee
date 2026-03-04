import { beforeEach, describe, expect, it, vi } from "vitest";

const { httpGetMock } = vi.hoisted(() => ({
  httpGetMock: vi.fn(),
}));

vi.mock("./http", () => ({
  http: {
    get: httpGetMock,
  },
}));

import { getAdminFunnel, getAdminMapPerf, getAdminNorthStar, searchAdminCafesByName } from "./adminMetrics";

describe("adminMetrics api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes cafe_id filter to north-star endpoint and parses summary", async () => {
    httpGetMock.mockResolvedValueOnce({
      data: {
        summary: {
          from: "2026-02-01T00:00:00Z",
          to: "2026-02-15T00:00:00Z",
          days: 14,
          cafe_id: "550e8400-e29b-41d4-a716-446655440000",
          visit_intent_journeys: 12,
          north_star_journeys: 7,
          rate: 0.5833,
        },
        daily: [],
      },
    });

    const report = await getAdminNorthStar({
      days: 14,
      cafe_id: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(httpGetMock).toHaveBeenCalledWith("/api/admin/metrics/north-star", {
      params: {
        days: 14,
        cafe_id: "550e8400-e29b-41d4-a716-446655440000",
      },
    });
    expect(report.summary.cafe_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(report.summary.north_star_journeys).toBe(7);
  });

  it("passes cafe_id filter to funnel endpoint and parses stages", async () => {
    httpGetMock.mockResolvedValueOnce({
      data: {
        summary: {
          from: "2026-02-01T00:00:00Z",
          to: "2026-02-15T00:00:00Z",
          days: 14,
          cafe_id: "550e8400-e29b-41d4-a716-446655440000",
        },
        stages: [
          {
            key: "card_open",
            label: "Карточка открыта",
            journeys: 12,
            conversion_from_prev: 1,
            conversion_from_start: 1,
          },
          {
            key: "review_read",
            label: "Прочитан отзыв",
            journeys: 7,
            conversion_from_prev: 0.58,
            conversion_from_start: 0.58,
          },
        ],
      },
    });

    const report = await getAdminFunnel({
      days: 14,
      cafe_id: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(httpGetMock).toHaveBeenCalledWith("/api/admin/metrics/funnel", {
      params: {
        days: 14,
        cafe_id: "550e8400-e29b-41d4-a716-446655440000",
      },
    });
    expect(report.summary.cafe_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(report.stages[0]?.key).toBe("card_open");
    expect(report.stages[1]?.journeys).toBe(7);
  });

  it("skips cafe search request for short query", async () => {
    const items = await searchAdminCafesByName("a", 15);

    expect(items).toEqual([]);
    expect(httpGetMock).not.toHaveBeenCalled();
  });

  it("loads map perf summary and parses percentiles", async () => {
    httpGetMock.mockResolvedValueOnce({
      data: {
        summary: {
          from: "2026-02-01T00:00:00Z",
          to: "2026-02-15T00:00:00Z",
          days: 14,
          first_render_events: 120,
          first_render_p50_ms: 812.4,
          first_render_p95_ms: 1733.2,
          first_interaction_events: 88,
          first_interaction_p50_ms: 910.1,
          first_interaction_p95_ms: 2012.8,
          interaction_coverage: 0.7333,
        },
      },
    });

    const report = await getAdminMapPerf({ days: 14 });

    expect(httpGetMock).toHaveBeenCalledWith("/api/admin/metrics/map-perf", {
      params: {
        days: 14,
      },
    });
    expect(report.summary.first_render_events).toBe(120);
    expect(report.summary.first_render_p50_ms).toBe(812.4);
    expect(report.summary.interaction_coverage).toBe(0.7333);
  });
});
