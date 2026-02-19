/* @vitest-environment jsdom */
import { render, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverMock,
  });
}

vi.mock("maplibre-gl", () => {
  type Handler = (...args: unknown[]) => void;

  class MockMap {
    private sources = new Map<string, { setData: (data: unknown) => void }>();
    private layers = new Set<string>();
    private listeners = new Map<string, Set<Handler>>();
    private canvas = { style: {} as Record<string, string> };
    private container: { clientWidth: number; clientHeight: number };

    constructor(options: { container?: { clientWidth?: number; clientHeight?: number } }) {
      this.container = {
        clientWidth: options?.container?.clientWidth ?? 0,
        clientHeight: options?.container?.clientHeight ?? 0,
      };
    }

    on(event: string, layerOrHandler?: string | Handler, maybeHandler?: Handler) {
      const handler = typeof layerOrHandler === "function" ? layerOrHandler : maybeHandler;
      if (!handler) return this;
      const set = this.listeners.get(event) ?? new Set<Handler>();
      set.add(handler);
      this.listeners.set(event, set);
      return this;
    }

    off(event: string, layerOrHandler?: string | Handler, maybeHandler?: Handler) {
      const handler = typeof layerOrHandler === "function" ? layerOrHandler : maybeHandler;
      if (!handler) {
        this.listeners.delete(event);
        return this;
      }
      const set = this.listeners.get(event);
      set?.delete(handler);
      return this;
    }

    hasImage() {
      return false;
    }

    addImage() {}

    getSource(id: string) {
      return this.sources.get(id) ?? null;
    }

    addSource(id: string, source: { data?: unknown }) {
      let currentData = source?.data;
      this.sources.set(id, {
        setData: (data: unknown) => {
          currentData = data;
        },
      });
      return currentData;
    }

    getLayer(id: string) {
      return this.layers.has(id) ? { id } : undefined;
    }

    addLayer(layer: { id: string }) {
      this.layers.add(layer.id);
    }

    removeLayer(id: string) {
      this.layers.delete(id);
    }

    setFilter() {}

    getCanvas() {
      return this.canvas;
    }

    getContainer() {
      return this.container;
    }

    getCenter() {
      return { lng: 0, lat: 0 };
    }

    unproject() {
      return { lng: 0, lat: 0 };
    }

    setPadding() {}

    stop() {}

    easeTo() {}

    zoomIn() {}

    zoomOut() {}

    remove() {}
  }

  return {
    __esModule: true,
    default: { Map: MockMap },
    Map: MockMap,
    GeoJSONSource: class {},
  };
});

vi.mock("./components/AuthGate", () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
  useAuth: () => ({
    user: null,
    status: "guest",
    openAuthModal: vi.fn(),
  }),
}));

vi.mock("./features/discovery/hooks/useDiscoveryPageController", () => {
  const noop = vi.fn();
  const refetch = vi.fn().mockResolvedValue(undefined);

  return {
    __esModule: true,
    default: () => ({
      sheetRef: { current: null },
      sheetHeight: 240,
      sheetState: "mid",
      filtersBarHeight: 0,
      cafesQuery: { isError: false, isLoading: false, refetch },
      visibleCafes: [],
      userCenter: [30.3158, 59.9391] as [number, number],
      focusLngLat: null,
      selectedCafeId: null,
      selectedCafe: null,
      itemRefs: { current: {} },
      showFetchingBadge: false,
      showFirstChoice: false,
      showEmptyState: false,
      needsLocationChoice: false,
      isCityOnlyMode: false,
      emptyState: "no-results",
      isLocating: false,
      settingsOpen: false,
      detailsOpen: false,
      photoAdminOpen: false,
      photoAdminKind: "cafe" as const,
      photoSubmitOpen: false,
      photoSubmitKind: "cafe" as const,
      cafeProposalOpen: false,
      selectedAmenities: [],
      favoritesOnly: false,
      favoriteBusyCafeId: null,
      manualPickMode: false,
      manualPickedCenter: null,
      manualPinOffsetY: 0,
      manualCenterProbeOffsetY: 0,
      locationOptions: [],
      selectedLocationId: null,
      locationLabel: "",
      proposalCity: "",
      isPrivilegedUser: false,
      isPhotoAdmin: false,
      setSettingsOpen: noop,
      setDetailsOpen: noop,
      setPhotoAdminOpen: noop,
      setPhotoSubmitOpen: noop,
      setCafeProposalOpen: noop,
      setSelectedAmenities: noop,
      setRadiusM: noop,
      selectCafe: noop,
      handleManualCenterChange: noop,
      handleCancelManualPick: noop,
      handleConfirmManualPick: noop,
      handleLocateMe: noop,
      handleSelectLocation: noop,
      handleStartManualPick: noop,
      handleToggleFavoritesFilter: noop,
      handleToggleFavorite: noop,
      handleOpenPhotoAdmin: noop,
      handlePhotosChanged: noop,
      handleStartCafeDescriptionEdit: noop,
      handleSaveCafeDescription: vi.fn(),
      handleOpenCafeProposal: noop,
      open2gisRoute: noop,
      openYandexRoute: noop,
      radiusM: 800,
      resetFilters: noop,
    }),
  };
});

import App from "./App";

describe("App home route", () => {
  it("renders / without crashing", async () => {
    window.history.pushState({}, "", "/");

    let renderError: unknown;
    try {
      render(
        <MantineProvider>
          <App />
        </MantineProvider>,
      );
    } catch (error) {
      renderError = error;
    }
    if (renderError instanceof AggregateError) {
      const details = renderError.errors
        .map((item) => {
          if (item instanceof Error) {
            return `${item.name}: ${item.message}`;
          }
          return String(item);
        })
        .join("\n");
      throw new Error(`Aggregate render failure:\n${details}`);
    }
    if (renderError) {
      throw renderError;
    }

    await waitFor(() => {
      expect(document.querySelector(".map-wrapper")).not.toBeNull();
    });
  });
});
