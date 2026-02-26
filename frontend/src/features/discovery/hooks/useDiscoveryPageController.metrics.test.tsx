/* @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Cafe } from "../../../entities/cafe/model/types";

const reportMetricEventMock = vi.fn();
const createJourneyIDMock = vi.fn((cafeID: string) => `jid-${cafeID}-${Date.now()}`);

const cafesFixture: Cafe[] = [
  {
    id: "cafe-1",
    name: "Cafe One",
    address: "Addr 1",
    latitude: 59.93,
    longitude: 30.31,
    amenities: [],
    distance_m: 320,
    is_favorite: false,
    photos: [],
  },
  {
    id: "cafe-2",
    name: "Cafe Two",
    address: "Addr 2",
    latitude: 59.94,
    longitude: 30.32,
    amenities: [],
    distance_m: 510,
    is_favorite: false,
    photos: [],
  },
];

vi.mock("../../../components/AuthGate", () => ({
  __esModule: true,
  useAuth: () => ({
    user: null,
    openAuthModal: vi.fn(),
  }),
}));

vi.mock("../../../api/cafes", () => ({
  __esModule: true,
  updateCafeDescription: vi.fn(),
}));

vi.mock("../../../api/metrics", () => ({
  __esModule: true,
  createJourneyID: (cafeID: string) => createJourneyIDMock(cafeID),
  reportMetricEvent: (payload: unknown) => reportMetricEventMock(payload),
}));

vi.mock("../../../api/submissions", () => ({
  __esModule: true,
  submitCafeDescription: vi.fn(),
}));

vi.mock("../../../api/tags", () => ({
  __esModule: true,
  getDescriptiveTagOptions: vi.fn().mockResolvedValue({ tags: [] }),
  getDiscoveryDescriptiveTags: vi
    .fn()
    .mockResolvedValue({ tags: [], source: "city_popular" }),
  getMyDescriptiveTagPreferences: vi.fn().mockResolvedValue({ tags: [] }),
  updateMyDescriptiveTagPreferences: vi.fn().mockResolvedValue({ tags: [] }),
}));

vi.mock("./useCafes", () => ({
  __esModule: true,
  default: () => ({
    cafes: cafesFixture,
    cafesQuery: {
      isError: false,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    },
    showFetchingBadge: false,
  }),
}));

vi.mock("./useCafeSelection", async () => {
  const react = await import("react");
  return {
    __esModule: true,
    default: ({ cafes }: { cafes: Cafe[] }) => {
      const [selectedCafeId, setSelectedCafeId] = react.useState<string | null>(
        cafes[0]?.id ?? null,
      );
      const selectedCafe = react.useMemo(
        () => cafes.find((item) => item.id === selectedCafeId) ?? null,
        [cafes, selectedCafeId],
      );
      const itemRefs = react.useRef<Record<string, HTMLButtonElement | null>>({});
      return {
        selectedCafeId,
        selectedCafe,
        selectCafe: setSelectedCafeId,
        itemRefs,
      };
    },
  };
});

vi.mock("../model/location/useDiscoveryLocation", () => ({
  __esModule: true,
  default: () => ({
    userCenter: [30.3158, 59.9343] as [number, number],
    effectiveRadiusM: 5000,
    locationChoice: { type: "city", id: "spb" },
    showFirstChoice: false,
    manualPickMode: false,
    geoStatus: "ok",
    focusLngLat: null,
    needsLocationChoice: false,
    isCityOnlyMode: false,
    isLocating: false,
    manualPickedCenter: null,
    manualPinOffsetY: 0,
    manualCenterProbeOffsetY: 0,
    locationOptions: [{ id: "spb", label: "Санкт-Петербург" }],
    selectedLocationId: "spb",
    locationLabel: "Санкт-Петербург",
    proposalCity: "Санкт-Петербург",
    setFocusLngLat: vi.fn(),
    startManualPick: vi.fn(),
    handleManualCenterChange: vi.fn(),
    handleCancelManualPick: vi.fn(),
    handleConfirmManualPick: vi.fn(),
    handleLocateMe: vi.fn(),
    handleSelectLocation: vi.fn(),
  }),
}));

vi.mock("../model/modals/useDiscoveryModals", () => ({
  __esModule: true,
  default: () => ({
    settingsOpen: false,
    detailsOpen: false,
    photoAdminOpen: false,
    photoAdminKind: "cafe",
    photoSubmitOpen: false,
    photoSubmitKind: "cafe",
    cafeProposalOpen: false,
    setSettingsOpen: vi.fn(),
    setDetailsOpen: vi.fn(),
    setPhotoAdminOpen: vi.fn(),
    setPhotoAdminKind: vi.fn(),
    setPhotoSubmitOpen: vi.fn(),
    setPhotoSubmitKind: vi.fn(),
    setCafeProposalOpen: vi.fn(),
    closePanelsForManualPick: vi.fn(),
  }),
}));

vi.mock("../model/favorites/useDiscoveryFavoriteActions", () => ({
  __esModule: true,
  default: () => ({
    handleToggleFavoritesFilter: vi.fn(),
    handleToggleFavorite: vi.fn(),
  }),
}));

vi.mock("../layout/LayoutMetricsContext", () => ({
  __esModule: true,
  useLayoutMetrics: () => ({
    sheetHeight: 240,
    sheetState: "mid",
    filtersBarHeight: 0,
  }),
}));

vi.mock("../components/cafe-card/CafeCardFooter", () => ({
  __esModule: true,
  invalidateCafeCardRatingSnapshot: vi.fn(),
}));

import useDiscoveryPageController from "./useDiscoveryPageController";

describe("useDiscoveryPageController metrics", () => {
  beforeEach(() => {
    reportMetricEventMock.mockReset();
    createJourneyIDMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not duplicate cafe_card_open for repeated same-cafe selection", async () => {
    const { result } = renderHook(() => useDiscoveryPageController());

    await waitFor(() => {
      const opens = reportMetricEventMock.mock.calls.filter(
        (call) => call[0]?.event_type === "cafe_card_open",
      );
      expect(opens.length).toBe(1);
      expect(opens[0]?.[0]?.cafe_id).toBe("cafe-1");
    });

    act(() => {
      result.current.selectCafe("cafe-1");
    });

    await waitFor(() => {
      const opens = reportMetricEventMock.mock.calls.filter(
        (call) => call[0]?.event_type === "cafe_card_open",
      );
      expect(opens.length).toBe(1);
    });

    act(() => {
      result.current.selectCafe("cafe-2");
    });

    await waitFor(() => {
      const opens = reportMetricEventMock.mock.calls.filter(
        (call) => call[0]?.event_type === "cafe_card_open",
      );
      expect(opens.length).toBe(2);
      expect(opens[1]?.[0]?.cafe_id).toBe("cafe-2");
    });

    act(() => {
      result.current.selectCafe("cafe-2");
    });

    await waitFor(() => {
      const opens = reportMetricEventMock.mock.calls.filter(
        (call) => call[0]?.event_type === "cafe_card_open",
      );
      expect(opens.length).toBe(2);
    });
  });

  it("reports route_click with provider for both route buttons", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { result } = renderHook(() => useDiscoveryPageController());

    await waitFor(() => {
      expect(result.current.visibleCafes.length).toBeGreaterThanOrEqual(2);
    });

    const cafe = result.current.visibleCafes[1];
    act(() => {
      result.current.open2gisRoute(cafe);
      result.current.openYandexRoute(cafe);
    });

    const routeEvents = reportMetricEventMock.mock.calls
      .map((call) => call[0])
      .filter((payload) => payload?.event_type === "route_click");

    expect(routeEvents).toHaveLength(2);
    expect(routeEvents[0]).toMatchObject({
      event_type: "route_click",
      cafe_id: "cafe-2",
      provider: "2gis",
    });
    expect(routeEvents[1]).toMatchObject({
      event_type: "route_click",
      cafe_id: "cafe-2",
      provider: "yandex",
    });
    expect(openSpy).toHaveBeenCalledTimes(2);
  });
});

