import { useEffect, useMemo, useRef, useState } from "react";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import maplibregl, {
  GeoJSONSource,
  Map as MLMap,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import useAppColorScheme from "../hooks/useAppColorScheme";
import type { Cafe } from "../types";
import pinUrl from "../assets/pin.png";
import cupUrl from "../assets/cup.png";

const MAP_STYLE_URL_RAW =
  (import.meta.env.VITE_MAP_STYLE_URL as string | undefined)?.trim() || "";
const MAP_STYLE_LIGHT_URL_RAW =
  (import.meta.env.VITE_MAP_STYLE_URL_LIGHT as string | undefined)?.trim() ||
  MAP_STYLE_URL_RAW ||
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const MAP_STYLE_DARK_URL_RAW =
  (import.meta.env.VITE_MAP_STYLE_URL_DARK as string | undefined)?.trim() ||
  MAP_STYLE_URL_RAW ||
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

function normalizeMapStyleUrl(raw: string): string {
  return /tiles\.openfreemap\.org/i.test(raw) ? "" : raw;
}

const MAP_STYLE_LIGHT_URL = normalizeMapStyleUrl(MAP_STYLE_LIGHT_URL_RAW);
const MAP_STYLE_DARK_URL = normalizeMapStyleUrl(MAP_STYLE_DARK_URL_RAW);

function createFallbackMapStyle() {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "osm-raster",
        type: "raster",
        source: "osm",
      },
    ],
  } as const;
}

function resolveMapStyleByScheme(scheme: "light" | "dark") {
  if (scheme === "dark") {
    return MAP_STYLE_DARK_URL || MAP_STYLE_LIGHT_URL || createFallbackMapStyle();
  }
  return MAP_STYLE_LIGHT_URL || createFallbackMapStyle();
}

const DARK_LABEL_LAYER_IDS = [
  "waterway_label",
  "place_hamlet",
  "place_suburbs",
  "place_villages",
  "place_town",
  "place_country_2",
  "place_country_1",
  "place_state",
  "place_continent",
  "place_city_r6",
  "place_city_r5",
  "roadname_minor",
  "roadname_sec",
  "roadname_pri",
  "roadname_major",
  "housenumber",
] as const;

function applyBaseStyleTweaks(map: MLMap, scheme: "light" | "dark") {
  if (scheme !== "dark") {
    return;
  }

  for (const layerID of DARK_LABEL_LAYER_IDS) {
    const layer = map.getLayer(layerID);
    if (!layer || layer.type !== "symbol") continue;
    try {
      map.setPaintProperty(layerID, "text-color", "#F4F6FA");
      map.setPaintProperty(layerID, "text-halo-color", "rgba(0, 0, 0, 0.84)");
      map.setPaintProperty(layerID, "text-halo-width", layerID === "housenumber" ? 1 : 0.85);
    } catch {
      // Some third-party styles may not expose all text paint properties.
    }
  }

  if (map.getLayer("housenumber")) {
    try {
      map.setLayerZoomRange("housenumber", 16, 24);
      map.setPaintProperty("housenumber", "text-color", "#FFFFFF");
      map.setPaintProperty("housenumber", "text-halo-color", "rgba(0, 0, 0, 0.9)");
      map.setPaintProperty("housenumber", "text-halo-width", 1);
    } catch {
      // Ignore style incompatibilities and keep default style behavior.
    }
  }
}

const USER_ICON_ID = "user-pin";
const CAFE_ICON_ID = "cafe-cup";
const MARKER_FALLBACK = { user: "#FFFFF0", cafe: "#457E73" };
const CAFE_CLUSTER_RADIUS_PX = 56;
const CAFE_CLUSTER_MAX_ZOOM = 13;
const CAFE_CLUSTER_LAYER_ID = "cafes-clusters";
const CAFE_CLUSTER_COUNT_LAYER_ID = "cafes-cluster-count";
const NON_FATAL_STYLE_MESSAGES = [
  "Expected value to be of type number, but found null instead.",
];

type Props = {
  center: [number, number];
  zoom?: number;
  cafes: Cafe[];
  selectedCafeId?: string | null;
  onCafeSelect?: (id: string) => void;
  onMapClick?: (lngLat: [number, number]) => void;
  onCenterChange?: (lngLat: [number, number]) => void;
  disableCafeClick?: boolean;
  paddingEnabled?: boolean;
  centerProbeOffsetY?: number;
  userLocation?: [number, number] | null;
  focusLngLat?: [number, number] | null;
  filtersBarHeight?: number;
  controlsHidden?: boolean;
};

const FOCUS_EPS = 1e-6;

function isSameLngLat(a: [number, number], b: [number, number]) {
  return (
    Math.abs(a[0] - b[0]) < FOCUS_EPS &&
    Math.abs(a[1] - b[1]) < FOCUS_EPS
  );
}

function asFiniteNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function readMapErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

function loadImage(map: MLMap, id: string, url: string) {
  if (map.hasImage(id)) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        map.addImage(id, img, { pixelRatio: 2 });
        resolve(true);
      } catch (err) {
        console.warn(`Map icon failed to add: ${id}`, err);
        resolve(false);
      }
    };
    img.onerror = (error) => {
      console.warn(`Map icon failed to load: ${id}`, error);
      resolve(false);
    };
    img.src = url;
  });
}

function getGeoJsonSource(map: MLMap, id: string): GeoJSONSource | null {
  const source = map.getSource(id);
  if (!source) return null;
  if ("setData" in source && typeof source.setData === "function") {
    return source as GeoJSONSource;
  }
  return null;
}

function addSources(map: MLMap, geojson: GeoJSON.FeatureCollection) {
  if (!map.getSource("user")) {
    map.addSource("user", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getSource("cafes")) {
    map.addSource("cafes", {
      type: "geojson",
      data: geojson,
      cluster: true,
      clusterRadius: CAFE_CLUSTER_RADIUS_PX,
      clusterMaxZoom: CAFE_CLUSTER_MAX_ZOOM,
    });
  }
}

function addLayers(map: MLMap, selectedCafeId: string | null) {
  const hasUserIcon = map.hasImage(USER_ICON_ID);
  const hasCafeIcon = map.hasImage(CAFE_ICON_ID);
  const unclusteredFilter = ["!", ["has", "point_count"]] as const;

  if (!map.getLayer(CAFE_CLUSTER_LAYER_ID)) {
    map.addLayer({
      id: CAFE_CLUSTER_LAYER_ID,
      type: "circle",
      source: "cafes",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          "#ff6a3a",
          10,
          "#ff4e1f",
          30,
          "#e63f14",
        ],
        "circle-radius": [
          "step",
          ["get", "point_count"],
          16,
          10,
          21,
          30,
          26,
        ],
        "circle-opacity": 0.92,
        "circle-stroke-color": "rgba(255,255,255,0.86)",
        "circle-stroke-width": 1.5,
      },
    });
  }

  if (!map.getLayer(CAFE_CLUSTER_COUNT_LAYER_ID)) {
    map.addLayer({
      id: CAFE_CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: "cafes",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 12,
        "text-font": ["Noto Sans Bold", "Open Sans Bold"],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#fff",
        "text-halo-color": "rgba(0,0,0,0.2)",
        "text-halo-width": 0.8,
      },
    });
  }

  if (!map.getLayer("cafes-layer")) {
    if (hasCafeIcon) {
      map.addLayer({
        id: "cafes-layer",
        type: "symbol",
        source: "cafes",
        filter: unclusteredFilter,
        layout: {
          "icon-image": CAFE_ICON_ID,
          "icon-size": 0.1,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-anchor": "bottom",
        },
      });
    } else {
      map.addLayer({
        id: "cafes-layer",
        type: "circle",
        source: "cafes",
        filter: unclusteredFilter,
        paint: {
          "circle-radius": 6,
          "circle-color": MARKER_FALLBACK.cafe,
          "circle-opacity": 0.95,
          "circle-stroke-color": "rgba(26,26,26,0.25)",
          "circle-stroke-width": 1,
        },
      });
    }
  }

  if (!map.getLayer("cafes-labels")) {
    map.addLayer({
      id: "cafes-labels",
      type: "symbol",
      source: "cafes",
      filter: unclusteredFilter,
      minzoom: 14,
      layout: {
        "text-field": ["get", "name"],
        "text-size": 12,
        "text-font": ["Noto Sans Regular", "Open Sans Regular"],
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-variable-anchor": ["top", "bottom", "left", "right"],
        "text-radial-offset": 0.8,
        "text-padding": 4,
      },
      paint: {
        "text-color": "#1A1A1A",
        "text-halo-color": "rgba(255, 255, 240, 0.9)",
        "text-halo-width": 1.2,
        "text-halo-blur": 0.3,
      },
    });
  }

  if (!map.getLayer("cafes-selected")) {
    if (hasCafeIcon) {
      map.addLayer({
        id: "cafes-selected",
        type: "symbol",
        source: "cafes",
        filter: ["all", unclusteredFilter, ["==", ["get", "id"], selectedCafeId ?? ""]],
        layout: {
          "icon-image": CAFE_ICON_ID,
          "icon-size": 0.12,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-anchor": "bottom",
        },
      });
    } else {
      map.addLayer({
        id: "cafes-selected",
        type: "circle",
        source: "cafes",
        filter: ["all", unclusteredFilter, ["==", ["get", "id"], selectedCafeId ?? ""]],
        paint: {
          "circle-radius": 9,
          "circle-color": MARKER_FALLBACK.cafe,
          "circle-opacity": 1,
          "circle-stroke-color": "rgba(255,255,240,0.9)",
          "circle-stroke-width": 2,
        },
      });
    }
  }

  if (!map.getLayer("user-layer")) {
    if (hasUserIcon) {
      map.addLayer({
        id: "user-layer",
        type: "symbol",
        source: "user",
        layout: {
          "icon-image": USER_ICON_ID,
          "icon-size": 0.11,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-anchor": "bottom",
        },
      });
    } else {
      map.addLayer({
        id: "user-layer",
        type: "circle",
        source: "user",
        paint: {
          "circle-radius": 7,
          "circle-color": MARKER_FALLBACK.user,
          "circle-opacity": 0.95,
          "circle-stroke-color": "rgba(26,26,26,0.4)",
          "circle-stroke-width": 2,
        },
      });
    }
  }
}

function rebuildLayers(map: MLMap, selectedCafeId: string | null) {
  if (map.getLayer(CAFE_CLUSTER_COUNT_LAYER_ID)) map.removeLayer(CAFE_CLUSTER_COUNT_LAYER_ID);
  if (map.getLayer(CAFE_CLUSTER_LAYER_ID)) map.removeLayer(CAFE_CLUSTER_LAYER_ID);
  if (map.getLayer("cafes-layer")) map.removeLayer("cafes-layer");
  if (map.getLayer("cafes-labels")) map.removeLayer("cafes-labels");
  if (map.getLayer("cafes-selected")) map.removeLayer("cafes-selected");
  if (map.getLayer("user-layer")) map.removeLayer("user-layer");
  addLayers(map, selectedCafeId);
  updateSelected(map, selectedCafeId);
}

function updateUserLocation(map: MLMap, userLocation?: [number, number] | null) {
  const src = getGeoJsonSource(map, "user");
  if (!src) return;

  if (!userLocation) {
    src.setData({ type: "FeatureCollection", features: [] });
    return;
  }

  src.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: userLocation },
      },
    ],
  });
}

function updateCafes(map: MLMap, geojson: GeoJSON.FeatureCollection) {
  const src = getGeoJsonSource(map, "cafes");
  if (src) src.setData(geojson);
}

function updateSelected(map: MLMap, selectedCafeId?: string | null) {
  if (map.getLayer("cafes-selected")) {
    map.setFilter("cafes-selected", [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "id"], selectedCafeId ?? ""],
    ]);
  }
}

async function expandClusterOnClick(
  map: MLMap,
  feature: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>,
) {
  const clusterId = asFiniteNumber(feature.properties?.cluster_id);
  if (clusterId == null) return;
  if (feature.geometry.type !== "Point") return;

  const source = getGeoJsonSource(map, "cafes") as GeoJSONSource & {
    getClusterExpansionZoom?: (
      clusterId: number,
      callback: (error: Error | null, zoom: number) => void,
    ) => void;
  };
  if (!source || typeof source.getClusterExpansionZoom !== "function") return;

  const expansionZoom = await new Promise<number>((resolve, reject) => {
    source.getClusterExpansionZoom?.(clusterId, (error, zoom) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(zoom);
    });
  });

  const currentZoom = map.getZoom();
  map.easeTo({
    center: feature.geometry.coordinates as [number, number],
    zoom: Math.max(expansionZoom, currentZoom + 1),
    duration: 260,
  });
}

export default function Map({
  center,
  zoom = 12,
  cafes,
  selectedCafeId,
  onCafeSelect,
  onMapClick,
  onCenterChange,
  disableCafeClick = false,
  paddingEnabled = true,
  userLocation,
  focusLngLat,
  centerProbeOffsetY = 0,
  filtersBarHeight = 0,
  controlsHidden = false,
}: Props) {
  const { colorScheme: scheme } = useAppColorScheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const layerEventsBoundRef = useRef(false);
  const schemeRef = useRef<"light" | "dark">(scheme);
  const onCafeSelectRef = useRef(onCafeSelect);
  const onMapClickRef = useRef(onMapClick);
  const onCenterChangeRef = useRef(onCenterChange);
  const centerProbeOffsetYRef = useRef(centerProbeOffsetY);
  const focusRef = useRef<[number, number] | null>(focusLngLat ?? null);
  const selectedCafeRef = useRef<string | null>(selectedCafeId ?? null);
  const geojsonRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const paddingRef = useRef({ top: 0, bottom: 0 });
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    onCafeSelectRef.current = onCafeSelect;
  }, [onCafeSelect]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    centerProbeOffsetYRef.current = centerProbeOffsetY;
  }, [centerProbeOffsetY]);

  useEffect(() => {
    focusRef.current = focusLngLat ?? null;
  }, [focusLngLat]);

  useEffect(() => {
    selectedCafeRef.current = selectedCafeId ?? null;
  }, [selectedCafeId]);

  useEffect(() => {
    schemeRef.current = scheme;
  }, [scheme]);

  const geojson = useMemo(() => {
    const features = cafes.flatMap((cafe) => {
      const lng = asFiniteNumber(cafe.longitude);
      const lat = asFiniteNumber(cafe.latitude);
      if (lng == null || lat == null) {
        return [];
      }

      return [{
        type: "Feature" as const,
        properties: {
          id: cafe.id,
          name: cafe.name,
          address: cafe.address,
          distance_m: asFiniteNumber(cafe.distance_m) ?? 0,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [lng, lat],
        },
      }];
    });

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [cafes]);

  useEffect(() => {
    geojsonRef.current = geojson;
  }, [geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusLngLat) return;
    map.stop();
    map.easeTo({ center: focusLngLat, duration: 450, essential: true });
  }, [focusLngLat]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveMapStyleByScheme(scheme),
      center,
      zoom,
      attributionControl: false,
      fadeDuration: 0,
    });

    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const id = f?.properties?.id as string | undefined;
      if (id && onCafeSelectRef.current) onCafeSelectRef.current(id);
    };

    const handleClusterClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      if ("stopPropagation" in e.originalEvent) {
        e.originalEvent.stopPropagation();
      }
      void expandClusterOnClick(map, f);
    };

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (!onMapClickRef.current) return;
      onMapClickRef.current([e.lngLat.lng, e.lngLat.lat]);
    };

    const handleMoveEnd = () => {
      if (!onCenterChangeRef.current) return;
      const container = map.getContainer();
      const probeOffsetY = centerProbeOffsetYRef.current;
      if (container && Math.abs(probeOffsetY) > 0.01) {
        const sampled = map.unproject([
          container.clientWidth / 2,
          container.clientHeight / 2 + probeOffsetY,
        ]);
        onCenterChangeRef.current([sampled.lng, sampled.lat]);
        return;
      }
      const next = map.getCenter();
      onCenterChangeRef.current([next.lng, next.lat]);
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    const handleError = (event: { error?: unknown }) => {
      const message = readMapErrorMessage(event.error);
      if (NON_FATAL_STYLE_MESSAGES.some((part) => message.includes(part))) {
        return;
      }
      if (message) {
        console.warn("[MapLibre]", message);
      }
    };

    const runStyleLoad = async () => {
      applyBaseStyleTweaks(map, schemeRef.current);
      addSources(
        map,
        geojsonRef.current ?? geojson,
      );
      addLayers(map, selectedCafeRef.current ?? null);
      updateUserLocation(map, userLocation);
      updateSelected(map, selectedCafeRef.current ?? null);
      if (focusRef.current) {
        map.easeTo({ center: focusRef.current, duration: 450 });
      }
      setIsMapReady(true);

      if (!disableCafeClick && !layerEventsBoundRef.current) {
        map.on("click", "cafes-layer", handleClick);
        map.on("click", CAFE_CLUSTER_LAYER_ID, handleClusterClick);
        map.on("mouseenter", "cafes-layer", handleMouseEnter);
        map.on("mouseleave", "cafes-layer", handleMouseLeave);
        map.on("mouseenter", CAFE_CLUSTER_LAYER_ID, handleMouseEnter);
        map.on("mouseleave", CAFE_CLUSTER_LAYER_ID, handleMouseLeave);
        layerEventsBoundRef.current = true;
      }

      const [userLoaded, cafeLoaded] = await Promise.all([
        loadImage(map, USER_ICON_ID, pinUrl),
        loadImage(map, CAFE_ICON_ID, cupUrl),
      ]);
      if (userLoaded || cafeLoaded) {
        rebuildLayers(map, selectedCafeRef.current ?? null);
      }
    };

    const handleStyleLoad = () => {
      void runStyleLoad();
    };

    map.on("style.load", handleStyleLoad);
    map.on("click", handleMapClick);
    map.on("moveend", handleMoveEnd);
    map.on("error", handleError);
    mapRef.current = map;

    return () => {
      map.off("style.load", handleStyleLoad);
      map.off("click", handleMapClick);
      map.off("moveend", handleMoveEnd);
      map.off("error", handleError);
      if (!disableCafeClick && layerEventsBoundRef.current) {
        map.off("click", "cafes-layer", handleClick);
        map.off("click", CAFE_CLUSTER_LAYER_ID, handleClusterClick);
        map.off("mouseenter", "cafes-layer", handleMouseEnter);
        map.off("mouseleave", "cafes-layer", handleMouseLeave);
        map.off("mouseenter", CAFE_CLUSTER_LAYER_ID, handleMouseEnter);
        map.off("mouseleave", CAFE_CLUSTER_LAYER_ID, handleMouseLeave);
        layerEventsBoundRef.current = false;
      }
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (typeof map.setStyle !== "function") return;
    setIsMapReady(false);
    map.setStyle(resolveMapStyleByScheme(scheme));
  }, [scheme]);

  useEffect(() => {
    if (!isMapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const top =
      paddingEnabled && filtersBarHeight > 0 ? Math.max(0, filtersBarHeight + 12) : 0;
    const bottom = 0;
    const prev = paddingRef.current;
    if (
      Math.abs(prev.top - top) < 1 &&
      Math.abs(prev.bottom - bottom) < 1
    ) {
      return;
    }
    paddingRef.current = { top, bottom };
    map.setPadding({
      top,
      bottom,
      left: 0,
      right: 0,
    });
  }, [filtersBarHeight, isMapReady, paddingEnabled]);

  useEffect(() => {
    if (!isMapReady) return;
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    let raf: number | null = null;
    const scheduleResize = () => {
      if (raf != null) {
        cancelAnimationFrame(raf);
      }
      raf = window.requestAnimationFrame(() => {
        raf = null;
        const nextMap = mapRef.current;
        if (!nextMap) return;
        nextMap.resize();
      });
    };

    const observer = new ResizeObserver(() => {
      scheduleResize();
    });
    observer.observe(container);

    window.addEventListener("resize", scheduleResize);
    window.addEventListener("orientationchange", scheduleResize);
    window.addEventListener("focus", scheduleResize);
    window.addEventListener("pageshow", scheduleResize);
    window.visualViewport?.addEventListener("resize", scheduleResize);
    window.visualViewport?.addEventListener("scroll", scheduleResize);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleResize();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    scheduleResize();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("orientationchange", scheduleResize);
      window.removeEventListener("focus", scheduleResize);
      window.removeEventListener("pageshow", scheduleResize);
      window.visualViewport?.removeEventListener("resize", scheduleResize);
      window.visualViewport?.removeEventListener("scroll", scheduleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (raf != null) {
        cancelAnimationFrame(raf);
      }
    };
  }, [isMapReady]);

  const selectedCafeLngLat = useMemo(() => {
    if (!selectedCafeId) return null;
    const cafe = cafes.find((c) => c.id === selectedCafeId);
    if (!cafe) return null;
    const lng = asFiniteNumber(cafe.longitude);
    const lat = asFiniteNumber(cafe.latitude);
    if (lng == null || lat == null) return null;
    return [lng, lat] as [number, number];
  }, [cafes, selectedCafeId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCafeLngLat) return;
    if (focusLngLat && !isSameLngLat(focusLngLat, selectedCafeLngLat)) return;
    map.stop();
    map.easeTo({ center: selectedCafeLngLat, duration: 450, essential: true });
  }, [focusLngLat, selectedCafeLngLat]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (focusLngLat) return;
    map.easeTo({ center, zoom, duration: 400 });
  }, [center, focusLngLat, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;
    updateCafes(map, geojson);
  }, [geojson, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    updateSelected(map, selectedCafeId ?? null);
  }, [selectedCafeId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    updateUserLocation(map, userLocation);
  }, [userLocation]);


  const handleZoomIn = () => {
    mapRef.current?.zoomIn({ duration: 220 });
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ duration: 220 });
  };

  return (
    <div className="map-wrapper">
      <div
        ref={containerRef}
        className="map-shell"
        style={{ width: "100%", height: "100%" }}
      />
      <div
        className={`map-zoom-controls ${controlsHidden ? "map-zoom-controls--hidden" : ""}`}
      >
        <button
          type="button"
          className="map-zoom-button"
          aria-label="Zoom in"
          onClick={handleZoomIn}
        >
          <IconPlus size={18} stroke={1.8} />
        </button>
        <button
          type="button"
          className="map-zoom-button"
          aria-label="Zoom out"
          onClick={handleZoomOut}
        >
          <IconMinus size={18} stroke={1.8} />
        </button>
      </div>
    </div>
  );
}
