import { useCallback, useEffect, useMemo, useState } from "react";

import { SPB_CENTER } from "../../constants";
import useGeolocation from "../../hooks/useGeolocation";
import {
  CENTER_EPS,
  CITY_RADIUS_M_BY_ID,
  LOCATION_OPTIONS,
  LOCATION_STORAGE_KEY,
  MANUAL_PIN_NUDGE_PX,
  type LocationChoice,
  type LocationId,
} from "./types";

type UseDiscoveryLocationParams = {
  radiusM: number;
  setRadiusM: (value: number) => void;
  sheetHeight: number;
};

function readInitialLocationChoice(): LocationChoice | null {
  if (typeof window === "undefined") return { type: "city", id: "spb" };
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return { type: "city", id: "spb" };
    const parsed = JSON.parse(raw) as {
      type?: string;
      id?: unknown;
      center?: unknown;
    };
    if (parsed?.type === "geolocation") {
      return { type: "geolocation" };
    }
    if (
      parsed?.type === "city" &&
      typeof parsed.id === "string" &&
      LOCATION_OPTIONS.some((option) => option.id === parsed.id)
    ) {
      return { type: "city", id: parsed.id as LocationId };
    }
    if (
      (parsed?.type === "manual" || parsed?.type === "map") &&
      Array.isArray(parsed.center) &&
      parsed.center.length === 2
    ) {
      const lng = Number(parsed.center[0]);
      const lat = Number(parsed.center[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return { type: "city", id: "spb" };
      }
      return {
        type: "manual",
        center: [lng, lat],
      };
    }
  } catch {
    return { type: "city", id: "spb" };
  }
  return { type: "city", id: "spb" };
}

export default function useDiscoveryLocation({
  radiusM,
  setRadiusM,
  sheetHeight,
}: UseDiscoveryLocationParams) {
  const [locationChoice, setLocationChoice] = useState<LocationChoice | null>(
    readInitialLocationChoice,
  );
  const [manualPickMode, setManualPickMode] = useState(false);
  const [manualPickedCenter, setManualPickedCenter] = useState<[number, number] | null>(
    null,
  );
  const [manualStartCenter, setManualStartCenter] = useState<[number, number] | null>(
    null,
  );

  const initialCenter = useMemo(() => {
    if (locationChoice?.type === "city") {
      const option = LOCATION_OPTIONS.find((item) => item.id === locationChoice.id);
      return option?.center ?? SPB_CENTER;
    }
    if (locationChoice?.type === "manual") {
      return locationChoice.center;
    }
    return SPB_CENTER;
  }, [locationChoice]);

  const {
    userCenter,
    focusLngLat,
    setFocusLngLat,
    locateMe,
    setManualCenter,
    geoStatus,
    isLocating,
  } = useGeolocation(initialCenter, {
    autoLocate: locationChoice?.type === "geolocation",
  });

  const nearestCityId = useMemo(() => {
    const [lngValue, latValue] = userCenter;
    const metersPerLat = 111_320;
    const metersPerLng = Math.max(
      1,
      Math.cos((latValue * Math.PI) / 180) * metersPerLat,
    );

    return LOCATION_OPTIONS.reduce<(typeof LOCATION_OPTIONS)[number]["id"]>(
      (closest, option, index) => {
        if (index === 0) return option.id;
        const current = LOCATION_OPTIONS.find((item) => item.id === closest)!;
        const currentDx = (lngValue - current.center[0]) * metersPerLng;
        const currentDy = (latValue - current.center[1]) * metersPerLat;
        const nextDx = (lngValue - option.center[0]) * metersPerLng;
        const nextDy = (latValue - option.center[1]) * metersPerLat;
        const currentDistSq = currentDx * currentDx + currentDy * currentDy;
        const nextDistSq = nextDx * nextDx + nextDy * nextDy;
        return nextDistSq < currentDistSq ? option.id : closest;
      },
      LOCATION_OPTIONS[0].id,
    );
  }, [userCenter]);

  const effectiveRadiusM = useMemo(() => {
    if (locationChoice?.type === "city") {
      if (radiusM > 0) {
        return radiusM;
      }
      return CITY_RADIUS_M_BY_ID[locationChoice.id];
    }
    if (radiusM === 0) {
      return CITY_RADIUS_M_BY_ID[nearestCityId];
    }
    return radiusM;
  }, [locationChoice, nearestCityId, radiusM]);

  const showFirstChoice = locationChoice === null && !manualPickMode;
  const needsLocationChoice = locationChoice === null;
  const isCityOnlyMode = locationChoice?.type === "city";
  const manualPinOffsetY = MANUAL_PIN_NUDGE_PX;
  const manualCenterProbeOffsetY = Math.round(-sheetHeight / 2 + manualPinOffsetY);

  const locationOptions = useMemo(
    () => LOCATION_OPTIONS.map(({ id, label }) => ({ id, label })),
    [],
  );
  const selectedLocationId = locationChoice?.type === "city" ? locationChoice.id : "";
  const proposalCity = useMemo(() => {
    if (locationChoice?.type !== "city") return "";
    return (
      LOCATION_OPTIONS.find((option) => option.id === locationChoice.id)?.label ?? ""
    );
  }, [locationChoice]);

  const locationLabel = useMemo(() => {
    if (locationChoice?.type === "city") {
      return (
        LOCATION_OPTIONS.find((option) => option.id === locationChoice.id)
          ?.label ?? "Выбранный город"
      );
    }
    if (locationChoice?.type === "manual") {
      return "Выбранная точка";
    }
    if (locationChoice?.type === "geolocation") {
      if (geoStatus === "loading") return "Определяем...";
      if (geoStatus === "ok") return "Мое местоположение";
      return "Геолокация";
    }
    return "Не выбрано";
  }, [geoStatus, locationChoice]);

  useEffect(() => {
    if (!locationChoice) return;
    if (locationChoice.type === "geolocation") return;
    const nextCenter =
      locationChoice.type === "city"
        ? LOCATION_OPTIONS.find((option) => option.id === locationChoice.id)
            ?.center ?? SPB_CENTER
        : locationChoice.center;
    setManualCenter(nextCenter);
    setFocusLngLat(nextCenter);
  }, [locationChoice, setManualCenter, setFocusLngLat]);

  useEffect(() => {
    try {
      if (!locationChoice) {
        window.localStorage.removeItem(LOCATION_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(
        LOCATION_STORAGE_KEY,
        JSON.stringify(locationChoice),
      );
    } catch {
      // ignore storage failures
    }
  }, [locationChoice]);

  const handleSelectLocation = (id: string) => {
    const option = LOCATION_OPTIONS.find((item) => item.id === id);
    if (!option) return;
    setManualPickMode(false);
    setRadiusM(0);
    setLocationChoice({ type: "city", id: option.id });
  };

  const startManualPick = () => {
    setManualStartCenter(userCenter);
    setManualPickedCenter(userCenter);
    setManualPickMode(true);
    setFocusLngLat(userCenter);
  };

  const handleCancelManualPick = () => {
    setManualPickMode(false);
    setManualPickedCenter(null);
    if (manualStartCenter) {
      setFocusLngLat(manualStartCenter);
    }
    setManualStartCenter(null);
  };

  const handleConfirmManualPick = () => {
    if (!manualPickedCenter) return;
    setLocationChoice({ type: "manual", center: manualPickedCenter });
    setManualPickMode(false);
    setManualStartCenter(null);
  };

  const handleLocateMe = () => {
    if (manualPickMode) {
      locateMe(true);
      return;
    }
    setManualPickMode(false);
    setLocationChoice({ type: "geolocation" });
    locateMe(true);
  };

  const handleManualCenterChange = useCallback((lngLat: [number, number]) => {
    setManualPickedCenter((prev) => {
      if (!prev) return lngLat;
      if (
        Math.abs(prev[0] - lngLat[0]) < CENTER_EPS &&
        Math.abs(prev[1] - lngLat[1]) < CENTER_EPS
      ) {
        return prev;
      }
      return lngLat;
    });
  }, []);

  return {
    locationChoice,
    userCenter,
    focusLngLat,
    setFocusLngLat,
    geoStatus,
    isLocating,
    effectiveRadiusM,
    showFirstChoice,
    needsLocationChoice,
    isCityOnlyMode,
    manualPickMode,
    manualPickedCenter,
    manualPinOffsetY,
    manualCenterProbeOffsetY,
    locationOptions,
    selectedLocationId,
    locationLabel,
    proposalCity,
    handleSelectLocation,
    startManualPick,
    handleCancelManualPick,
    handleConfirmManualPick,
    handleLocateMe,
    handleManualCenterChange,
  };
}
