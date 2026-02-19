import { useEffect, useMemo, useRef, useState } from "react";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import maplibregl, {
  GeoJSONSource,
  Map as MLMap,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Cafe } from "../types";
import { useLayoutMetrics } from "../features/work/layout/LayoutMetricsContext";
import pinUrl from "../assets/pin.png";
import cupUrl from "../assets/cup.png";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const USER_ICON_ID = "user-pin";
const CAFE_ICON_ID = "cafe-cup";
const MARKER_FALLBACK = { user: "#FFFFF0", cafe: "#457E73" };

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
};

const FOCUS_EPS = 1e-6;

function isSameLngLat(a: [number, number], b: [number, number]) {
  return (
    Math.abs(a[0] - b[0]) < FOCUS_EPS &&
    Math.abs(a[1] - b[1]) < FOCUS_EPS
  );
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
    });
  }
}

function addLayers(map: MLMap, selectedCafeId: string | null) {
  const hasUserIcon = map.hasImage(USER_ICON_ID);
  const hasCafeIcon = map.hasImage(CAFE_ICON_ID);

  if (!map.getLayer("cafes-layer")) {
    if (hasCafeIcon) {
      map.addLayer({
        id: "cafes-layer",
        type: "symbol",
        source: "cafes",
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
        filter: ["==", ["get", "id"], selectedCafeId ?? ""],
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
        filter: ["==", ["get", "id"], selectedCafeId ?? ""],
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
    map.setFilter("cafes-selected", ["==", ["get", "id"], selectedCafeId ?? ""]);
  }
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
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const onCafeSelectRef = useRef(onCafeSelect);
  const onMapClickRef = useRef(onMapClick);
  const onCenterChangeRef = useRef(onCenterChange);
  const centerProbeOffsetYRef = useRef(centerProbeOffsetY);
  const focusRef = useRef<[number, number] | null>(focusLngLat ?? null);
  const selectedCafeRef = useRef<string | null>(selectedCafeId ?? null);
  const geojsonRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const paddingRef = useRef({ top: 0, bottom: 0 });
  const [isMapReady, setIsMapReady] = useState(false);
  const { filtersBarHeight } = useLayoutMetrics();

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

  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: cafes.map((c) => ({
        type: "Feature" as const,
        properties: {
          id: c.id,
          name: c.name,
          address: c.address,
          distance_m: c.distance_m,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [c.longitude, c.latitude],
        },
      })),
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
      style: MAP_STYLE_URL,
      center,
      zoom,
    });

    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const id = f?.properties?.id as string | undefined;
      if (id && onCafeSelectRef.current) onCafeSelectRef.current(id);
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

    const runLoad = async () => {
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

      map.on("click", "cafes-layer", handleClick);
      map.on("mouseenter", "cafes-layer", handleMouseEnter);
      map.on("mouseleave", "cafes-layer", handleMouseLeave);

      const [userLoaded, cafeLoaded] = await Promise.all([
        loadImage(map, USER_ICON_ID, pinUrl),
        loadImage(map, CAFE_ICON_ID, cupUrl),
      ]);
      if (userLoaded || cafeLoaded) {
        rebuildLayers(map, selectedCafeRef.current ?? null);
      }
    };

    const handleLoad = () => {
      void runLoad();
    };

    map.on("load", handleLoad);
    map.on("click", handleMapClick);
    map.on("moveend", handleMoveEnd);
    mapRef.current = map;

    return () => {
      map.off("load", handleLoad);
      map.off("click", handleMapClick);
      map.off("moveend", handleMoveEnd);
      if (!disableCafeClick) {
        map.off("click", "cafes-layer", handleClick);
        map.off("mouseenter", "cafes-layer", handleMouseEnter);
        map.off("mouseleave", "cafes-layer", handleMouseLeave);
      }
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const selectedCafeLngLat = useMemo(() => {
    if (!selectedCafeId) return null;
    const cafe = cafes.find((c) => c.id === selectedCafeId);
    if (!cafe) return null;
    return [cafe.longitude, cafe.latitude] as [number, number];
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
      <div className="map-zoom-controls">
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
