import { useCallback, useEffect, useState } from "react";

type LngLat = [number, number];

type GeoStatus = "idle" | "loading" | "ok" | "unavailable" | "error";

type GeolocationOptions = {
  autoLocate?: boolean;
};

export default function useGeolocation(
  initialCenter: LngLat,
  options: GeolocationOptions = {},
) {
  const [userCenter, setUserCenter] = useState<LngLat>(initialCenter);
  const [focusLngLat, setFocusLngLat] = useState<LngLat | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>(() =>
    "geolocation" in navigator ? "idle" : "unavailable",
  );
  const [isLocating, setIsLocating] = useState(false);

  const setManualCenter = useCallback((center: LngLat) => {
    setUserCenter(center);
    setGeoStatus("ok");
    setIsLocating(false);
  }, []);

  function locateMe(forceFocus: boolean, showLoading = true) {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unavailable");
      setIsLocating(false);
      return;
    }

    if (showLoading) {
      setGeoStatus("loading");
      setIsLocating(true);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: LngLat = [pos.coords.longitude, pos.coords.latitude];
        setUserCenter(next);
        if (forceFocus) setFocusLngLat(next);
        setGeoStatus("ok");
        setIsLocating(false);
      },
      () => {
        setGeoStatus("error");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  useEffect(() => {
    if (options.autoLocate === false) return;
    locateMe(false, false);
  }, [options.autoLocate]);

  return {
    userCenter,
    focusLngLat,
    setFocusLngLat,
    locateMe,
    setManualCenter,
    geoStatus,
    isLocating,
  };
}
