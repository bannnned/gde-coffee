import { useEffect, useMemo, useRef } from "react";
import {
  useComputedColorScheme,
} from "@mantine/core";
import maplibregl, {
  GeoJSONSource,
  Map as MLMap,
  type CircleLayerSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Cafe } from "../types";

type CirclePaint = NonNullable<CircleLayerSpecification["paint"]>;

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

type Props = {
  center: [number, number];
  zoom?: number;
  cafes: Cafe[];
  selectedCafeId?: string | null;
  onCafeSelect?: (id: string) => void;
  userLocation?: [number, number] | null;
  focusLngLat?: [number, number] | null;
};

type ThemeMode = "light" | "dark";

type PaintSet = {
  user: CirclePaint;
  cafes: CirclePaint;
  selected: CirclePaint;
};

function getPaints(mode: ThemeMode): PaintSet {
  if (mode === "dark") {
    return {
      user: {
        "circle-radius": 7,
        "circle-stroke-width": 2,
        "circle-opacity": 0.95,
        "circle-color": "rgba(94, 234, 212, 0.9)",
        "circle-stroke-color": "rgba(15, 118, 110, 0.9)",
      },
      cafes: {
        "circle-radius": 6,
        "circle-stroke-width": 1,
        "circle-opacity": 0.9,
        "circle-color": "rgba(147, 197, 253, 0.85)",
        "circle-stroke-color": "rgba(59, 130, 246, 0.9)",
      },
      selected: {
        "circle-radius": 10,
        "circle-stroke-width": 2,
        "circle-opacity": 0.95,
        "circle-color": "rgba(248, 250, 252, 0.95)",
        "circle-stroke-color": "rgba(56, 189, 248, 0.9)",
      },
    };
  }

  return {
    user: {
      "circle-radius": 7,
      "circle-stroke-width": 2,
      "circle-opacity": 0.95,
      "circle-color": "rgba(14, 165, 233, 0.9)",
      "circle-stroke-color": "rgba(2, 132, 199, 0.9)",
    },
    cafes: {
      "circle-radius": 6,
      "circle-stroke-width": 1,
      "circle-opacity": 0.9,
      "circle-color": "rgba(59, 130, 246, 0.85)",
      "circle-stroke-color": "rgba(30, 64, 175, 0.9)",
    },
    selected: {
      "circle-radius": 10,
      "circle-stroke-width": 2,
      "circle-opacity": 0.95,
      "circle-color": "rgba(15, 23, 42, 0.95)",
      "circle-stroke-color": "rgba(59, 130, 246, 0.9)",
    },
  };
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
      data: geojson as any,
    });
  }
}

function addLayers(map: MLMap, selectedCafeId: string | null, mode: ThemeMode) {
  const paints = getPaints(mode);

  if (!map.getLayer("user-layer")) {
    map.addLayer({
      id: "user-layer",
      type: "circle",
      source: "user",
      paint: paints.user,
    });
  }

  if (!map.getLayer("cafes-layer")) {
    map.addLayer({
      id: "cafes-layer",
      type: "circle",
      source: "cafes",
      paint: paints.cafes,
    });
  }

  if (!map.getLayer("cafes-selected")) {
    map.addLayer({
      id: "cafes-selected",
      type: "circle",
      source: "cafes",
      filter: ["==", ["get", "id"], selectedCafeId ?? ""],
      paint: paints.selected,
    });
  }
}

function updateUserLocation(map: MLMap, userLocation?: [number, number] | null) {
  const src = map.getSource("user") as GeoJSONSource | undefined;
  if (!src) return;

  if (!userLocation) {
    src.setData({ type: "FeatureCollection", features: [] } as any);
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
  } as any);
}

function updateCafes(map: MLMap, geojson: GeoJSON.FeatureCollection) {
  const src = map.getSource("cafes") as GeoJSONSource | undefined;
  if (src) src.setData(geojson as any);
}

function updateSelected(map: MLMap, selectedCafeId?: string | null) {
  if (map.getLayer("cafes-selected")) {
    map.setFilter("cafes-selected", ["==", ["get", "id"], selectedCafeId ?? ""]);
  }
}

function applyTheme(map: MLMap, mode: ThemeMode) {
  const paints = getPaints(mode);

  if (map.getLayer("user-layer")) {
    Object.entries(paints.user).forEach(([key, value]) => {
      map.setPaintProperty("user-layer", key, value as any);
    });
  }

  if (map.getLayer("cafes-layer")) {
    Object.entries(paints.cafes).forEach(([key, value]) => {
      map.setPaintProperty("cafes-layer", key, value as any);
    });
  }

  if (map.getLayer("cafes-selected")) {
    Object.entries(paints.selected).forEach(([key, value]) => {
      map.setPaintProperty("cafes-selected", key, value as any);
    });
  }
}

export default function Map({
  center,
  zoom = 12,
  cafes,
  selectedCafeId,
  onCafeSelect,
  userLocation,
  focusLngLat,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const onCafeSelectRef = useRef(onCafeSelect);
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  }) as ThemeMode;

  useEffect(() => {
    onCafeSelectRef.current = onCafeSelect;
  }, [onCafeSelect]);

  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: cafes.map((c) => ({
        type: "Feature" as const,
        properties: {
          id: c.id,
          name: c.name,
          address: c.address,
          work_score: c.work_score,
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
    const map = mapRef.current;
    if (!map || !focusLngLat) return;
    map.easeTo({ center: focusLngLat, duration: 450 });
  }, [focusLngLat]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center,
      zoom,
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );

    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const id = f?.properties?.id as string | undefined;
      if (id && onCafeSelectRef.current) onCafeSelectRef.current(id);
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    const handleLoad = () => {
      addSources(map, geojson as unknown as GeoJSON.FeatureCollection);
      addLayers(map, selectedCafeId ?? null, scheme);
      applyTheme(map, scheme);
      updateUserLocation(map, userLocation);

      map.on("click", "cafes-layer", handleClick);
      map.on("mouseenter", "cafes-layer", handleMouseEnter);
      map.on("mouseleave", "cafes-layer", handleMouseLeave);
    };

    map.on("load", handleLoad);
    mapRef.current = map;

    return () => {
      map.off("load", handleLoad);
      map.off("click", "cafes-layer", handleClick);
      map.off("mouseenter", "cafes-layer", handleMouseEnter);
      map.off("mouseleave", "cafes-layer", handleMouseLeave);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center, zoom, duration: 400 });
  }, [center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    updateCafes(map, geojson as unknown as GeoJSON.FeatureCollection);
  }, [geojson]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyTheme(map, scheme);
  }, [scheme]);

  return <div ref={containerRef} className="map-shell" style={{ width: "100%", height: "100%" }} />;
}
